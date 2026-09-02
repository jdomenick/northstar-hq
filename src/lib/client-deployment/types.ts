/**
 * NorthStar shared client deployment contract.
 *
 * Canonical identifier: `northstar_client_id`. HQ does not introduce a new id
 * column for this. The canonical value is `public.revenue_clients.id`, the
 * client record every HQ surface (billing, proposals, delivery, reporting)
 * already keys on. Every module integration contract aliases that value as
 * `northstar_client_id`.
 *
 * Storage: `public.client_module_connections`, one row per
 * (northstar_client_id, module). That existing mapping table is the single
 * client deployment record. No parallel installation table exists.
 *
 * Nothing in this file performs IO. Everything is a pure derivation so the
 * contract is unit tested without a database or network.
 */

import { MODULE_KEYS, MODULE_LABELS, type ModuleKey } from "@/lib/module-reporting/types";

export { MODULE_KEYS, MODULE_LABELS };
export type { ModuleKey };

/** Provisioning state of one module for one client. */
export type ProvisioningStatus =
  | "not_configured"
  | "pending"
  | "active"
  | "degraded"
  | "failed"
  | "disabled";

export const PROVISIONING_STATUSES: ProvisioningStatus[] = [
  "not_configured",
  "pending",
  "active",
  "degraded",
  "failed",
  "disabled",
];

export const PROVISIONING_LABELS: Record<ProvisioningStatus, string> = {
  not_configured: "Not configured",
  pending: "Pending",
  active: "Active",
  degraded: "Degraded",
  failed: "Failed",
  disabled: "Disabled",
};

export function isProvisioningStatus(value: unknown): value is ProvisioningStatus {
  return typeof value === "string" && (PROVISIONING_STATUSES as string[]).includes(value);
}

/**
 * Remote provisioning capability. No NorthStar module exposes a remote
 * tenant-create API to HQ today, so every module is `requires_setup`: the
 * tenant is created inside the module, then its external ID is mapped here.
 * Flip a module to `api` only when a real supported provisioning API exists.
 */
export type ProvisioningMode = "api" | "requires_setup";

export const MODULE_PROVISIONING_MODE: Record<ModuleKey, ProvisioningMode> = {
  cam: "requires_setup",
  ccm: "requires_setup",
  crm: "requires_setup",
  sam: "requires_setup",
};

/** The scope value each source expects as its tenant selector. */
export const MODULE_EXTERNAL_ID_HINT: Record<ModuleKey, string> = {
  cam: "CAM client (organization slug or UUID)",
  ccm: "CCM tenant_id (UUID)",
  crm: "CRM business_id (UUID or slug)",
  sam: "SAM organization_id (UUID)",
};

/** One module installation for one canonical NorthStar client. */
export interface ClientModuleInstallation {
  id: string | null;
  northstarClientId: string;
  organizationId: string;
  module: ModuleKey;
  externalId: string | null;
  externalName: string | null;
  /** Per-client endpoint / reporting base URL override, when the module needs one. */
  endpointUrl: string | null;
  status: ProvisioningStatus;
  provisioningMode: ProvisioningMode;
  configuration: Record<string, unknown>;
  lastHealthCheckAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** An unmapped module still appears, truthfully, as not configured. */
export function emptyInstallation(
  organizationId: string,
  northstarClientId: string,
  module: ModuleKey,
): ClientModuleInstallation {
  return {
    id: null,
    northstarClientId,
    organizationId,
    module,
    externalId: null,
    externalName: null,
    endpointUrl: null,
    status: "not_configured",
    provisioningMode: MODULE_PROVISIONING_MODE[module],
    configuration: {},
    lastHealthCheckAt: null,
    lastSuccessAt: null,
    lastError: null,
    createdAt: null,
    updatedAt: null,
  };
}

/* ------------------------------ derivations ------------------------------- */

/**
 * Effective status of an installation. Stored status is authoritative for
 * operator intent (disabled, pending), observed health decides the rest.
 * A row with no external ID is never anything but not_configured.
 */
export function deriveModuleStatus(
  install: Pick<
    ClientModuleInstallation,
    "externalId" | "status" | "lastError" | "lastSuccessAt" | "lastHealthCheckAt"
  >,
): ProvisioningStatus {
  if (!install.externalId || install.externalId.trim() === "") return "not_configured";
  if (install.status === "disabled") return "disabled";
  if (install.lastError && install.lastError.trim() !== "") {
    return install.lastSuccessAt ? "degraded" : "failed";
  }
  if (install.lastSuccessAt) return "active";
  if (install.lastHealthCheckAt) return "degraded";
  return install.status === "active" ? "pending" : install.status;
}

export type DeploymentHealth = "healthy" | "degraded" | "failed" | "not_configured";

/** Shared health derived only from observed module state. Never optimistic. */
export function deriveDeploymentHealth(
  installs: ClientModuleInstallation[],
): DeploymentHealth {
  const considered = installs.filter((i) => deriveModuleStatus(i) !== "disabled");
  const statuses = considered.map(deriveModuleStatus);
  const configured = statuses.filter((s) => s !== "not_configured");
  if (configured.length === 0) return "not_configured";
  if (configured.some((s) => s === "failed")) return "failed";
  if (configured.some((s) => s === "degraded" || s === "pending")) return "degraded";
  return "healthy";
}

export type DeploymentStage =
  | "create_client"
  | "map_modules"
  | "connect_systems"
  | "validate"
  | "active";

export const DEPLOYMENT_STAGES: DeploymentStage[] = [
  "create_client",
  "map_modules",
  "connect_systems",
  "validate",
  "active",
];

export const DEPLOYMENT_STAGE_LABELS: Record<DeploymentStage, string> = {
  create_client: "Create client",
  map_modules: "Map modules",
  connect_systems: "Connect required systems",
  validate: "Validate",
  active: "Active",
};

export interface ChecklistStep {
  stage: DeploymentStage;
  label: string;
  state: "done" | "current" | "blocked" | "todo";
  detail: string;
}

export interface DeploymentSummaryInput {
  clientExists: boolean;
  /** Shared reporting credential resolved server-side. Boolean only. */
  reportingCredentialConfigured: boolean;
  installations: ClientModuleInstallation[];
}

export interface DeploymentSummary {
  northstarClientId: string | null;
  health: DeploymentHealth;
  stage: DeploymentStage;
  checklist: ChecklistStep[];
  mappedModules: number;
  activeModules: number;
  failingModules: ModuleKey[];
  requiresSetup: ModuleKey[];
}

/**
 * Provisioning checklist. Purely derived from real state: a step is only
 * `done` when the underlying fact is true, never because an operator
 * clicked something.
 */
export function buildDeploymentSummary(
  input: DeploymentSummaryInput,
  northstarClientId: string | null = null,
): DeploymentSummary {
  const installs = input.installations;
  const statuses = new Map(installs.map((i) => [i.module, deriveModuleStatus(i)] as const));
  const mapped = installs.filter((i) => (statuses.get(i.module) ?? "not_configured") !== "not_configured");
  const active = installs.filter((i) => statuses.get(i.module) === "active");
  const failing = installs
    .filter((i) => {
      const s = statuses.get(i.module);
      return s === "failed" || s === "degraded";
    })
    .map((i) => i.module);
  const requiresSetup = installs
    .filter(
      (i) =>
        statuses.get(i.module) === "not_configured" &&
        MODULE_PROVISIONING_MODE[i.module] === "requires_setup",
    )
    .map((i) => i.module);

  const health = deriveDeploymentHealth(installs);
  const checked = installs.filter((i) => i.lastHealthCheckAt !== null);

  let stage: DeploymentStage = "create_client";
  if (input.clientExists) stage = "map_modules";
  if (input.clientExists && mapped.length > 0) stage = "connect_systems";
  if (stage === "connect_systems" && input.reportingCredentialConfigured) stage = "validate";
  if (stage === "validate" && checked.length > 0 && health === "healthy") stage = "active";

  const reached = DEPLOYMENT_STAGES.indexOf(stage);
  const checklist: ChecklistStep[] = DEPLOYMENT_STAGES.map((s, i) => {
    const state: ChecklistStep["state"] =
      i < reached ? "done" : i === reached ? (stage === "active" ? "done" : "current") : "todo";
    return { stage: s, label: DEPLOYMENT_STAGE_LABELS[s], state, detail: "" };
  });

  checklist[0].detail = input.clientExists
    ? "Client record exists in NorthStar HQ."
    : "No canonical client record.";
  checklist[1].detail =
    mapped.length > 0
      ? `${mapped.length} of ${installs.length} modules mapped to an external tenant.`
      : "No module mapped yet. Create the tenant inside the module, then map its ID here.";
  checklist[2].detail = input.reportingCredentialConfigured
    ? "Shared reporting credential is configured."
    : "Shared reporting credential is not configured.";
  checklist[3].detail =
    checked.length > 0
      ? `${checked.length} module${checked.length === 1 ? "" : "s"} health checked. ${active.length} reporting successfully.`
      : "No health check has been run against a mapped module yet.";
  checklist[4].detail =
    health === "healthy" && active.length > 0
      ? `${active.length} module${active.length === 1 ? "" : "s"} active.`
      : "Not all mapped modules are reporting successfully.";

  if (failing.length > 0) {
    checklist[3].state = "blocked";
    checklist[3].detail = `Failing or degraded: ${failing.map((m) => MODULE_LABELS[m]).join(", ")}.`;
  }

  return {
    northstarClientId,
    health,
    stage,
    checklist,
    mappedModules: mapped.length,
    activeModules: active.length,
    failingModules: failing,
    requiresSetup,
  };
}
