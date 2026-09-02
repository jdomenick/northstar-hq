/**
 * NorthStar CRM deployment contract (`northstar.crm.deployment.v1`).
 *
 * CRM reused `public.businesses` and added only a nullable unique
 * `northstar_client_id`, so this is the CRM row of the one client deployment
 * model in HQ: same `client_module_connections` mapping, same shared reporting
 * credential, same ProvisioningStatus vocabulary. Only the endpoint and its
 * readiness payload are CRM specific.
 *
 * Tenant isolation gate (deliberate, not a placeholder):
 * CRM's audit found that business scoping is enforced in the UI but not by
 * per-business RLS for external users, SAM inbound mappings are still
 * NorthStar-Labs-specific, and user access provisioning is manual. Until CRM
 * reports isolation readiness as verified, HQ never shows CRM as active for an
 * external-client deployment. It reports "Requires setup" (pending) with the
 * blocker stated. Internal NorthStar Labs deployments (mapping metadata
 * `internal_deployment: true`) are allowed to reach active because the
 * single-tenant blast radius is the operator's own data.
 *
 * Nothing here performs IO. Parsing and status derivation are pure.
 */

import type { JsonValue, ProvisioningStatus } from "./types";

export const CRM_DEPLOYMENT_PATH = "/api/public/reporting/deployment-status";
export const CRM_DEPLOYMENT_CONTRACT = "northstar.crm.deployment.v1";

/** Deployment vocabulary CRM reports. Anything else is not trusted. */
export const CRM_DEPLOYMENT_STATUSES = [
  "operational",
  "degraded",
  "unmapped",
  "not_configured",
] as const;
export type CrmDeploymentStatus = (typeof CRM_DEPLOYMENT_STATUSES)[number];

export const CRM_DEPLOYMENT_STATUS_LABELS: Record<CrmDeploymentStatus, string> = {
  operational: "Operational",
  degraded: "Degraded",
  unmapped: "Unmapped",
  not_configured: "Not configured",
};

/**
 * Readiness flags CRM reports today, plus the two isolation flags CRM is
 * adding as part of the multi-tenant fix. Unknown keys are ignored; missing
 * keys stay unknown rather than being assumed true.
 */
export const CRM_READINESS_KEYS = [
  "auth",
  "data_access",
  "sam_event_integration",
  "reporting",
  "tenant_isolation",
  "user_provisioning",
] as const;
export type CrmReadinessKey = (typeof CRM_READINESS_KEYS)[number];

export const CRM_READINESS_LABELS: Record<CrmReadinessKey, string> = {
  auth: "Auth",
  data_access: "Data access",
  sam_event_integration: "SAM event integration",
  reporting: "Reporting",
  tenant_isolation: "Tenant isolation (RLS)",
  user_provisioning: "User provisioning",
};

/** Readiness keys required before any deployment can be called active. */
export const CRM_CORE_READINESS: CrmReadinessKey[] = [
  "auth",
  "data_access",
  "sam_event_integration",
  "reporting",
];

/** Readiness keys required before an external-client deployment is safe. */
export const CRM_ISOLATION_READINESS: CrmReadinessKey[] = ["tenant_isolation", "user_provisioning"];

export interface CrmDeploymentReport {
  contract: string | null;
  module: string | null;
  /** CRM business UUID, as CRM knows it. */
  externalId: string | null;
  /** Canonical NorthStar client id CRM has on file for that business. */
  northstarClientId: string | null;
  /** Tenant label/slug CRM reports, when present. */
  tenant: string | null;
  deploymentStatus: CrmDeploymentStatus | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** Only recognized readiness keys with boolean values are kept. */
  readiness: Partial<Record<CrmReadinessKey, boolean>>;
}

/* -------------------------------- parsing --------------------------------- */

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const s = str(value);
  return s !== null && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

/**
 * A readiness flag may arrive as a bare boolean, as "ready"/"ok"/"blocked"
 * strings, or as an object carrying `ready`/`state`. Anything unrecognized is
 * dropped rather than guessed.
 */
function readinessFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  const s = str(value)?.toLowerCase();
  if (s === "ready" || s === "ok" || s === "true" || s === "verified") return true;
  if (s === "blocked" || s === "not_ready" || s === "false" || s === "pending") return false;
  const nested = obj(value);
  if (nested["ready"] !== undefined) return readinessFlag(nested["ready"]);
  if (nested["state"] !== undefined) return readinessFlag(nested["state"]);
  if (nested["status"] !== undefined) return readinessFlag(nested["status"]);
  return null;
}

/** Normalizes the documented payload without inventing missing values. */
export function parseCrmDeployment(payload: unknown): CrmDeploymentReport {
  const root = obj(payload);
  const rd = obj(root["readiness"]);

  const readiness: Partial<Record<CrmReadinessKey, boolean>> = {};
  for (const key of CRM_READINESS_KEYS) {
    const flag = readinessFlag(rd[key]);
    if (flag !== null) readiness[key] = flag;
  }

  return {
    contract: str(root["contract"]) ?? str(root["contract_version"]) ?? str(root["version"]),
    module: str(root["module"]),
    externalId: str(root["external_id"]) ?? str(root["business_id"]),
    northstarClientId: str(root["northstar_client_id"]),
    tenant: str(root["tenant"]),
    deploymentStatus: oneOf(root["status"], CRM_DEPLOYMENT_STATUSES),
    lastSuccessAt: str(root["last_success_at"]),
    lastError: str(root["last_error"]),
    readiness,
  };
}

/** True when the payload actually claims to be the CRM deployment contract. */
export function isCrmDeploymentContract(report: CrmDeploymentReport): boolean {
  return (
    report.contract === CRM_DEPLOYMENT_CONTRACT &&
    (report.module === "crm" || report.module === null)
  );
}

/* ------------------------------ url building ------------------------------ */

export interface CrmSelector {
  northstarClientId?: string | null;
  businessId?: string | null;
}

/**
 * Prefers the canonical client id, then the CRM business UUID. Exactly one
 * selector is sent so CRM never has to reconcile two.
 */
export function buildCrmDeploymentUrl(baseUrl: string, selector: CrmSelector): string {
  const url = new URL(CRM_DEPLOYMENT_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const ordered: Array<[string, string | null]> = [
    ["northstar_client_id", selector.northstarClientId?.trim() || null],
    ["business_id", selector.businessId?.trim() || null],
  ];
  const picked = ordered.find(([, value]) => value !== null);
  if (!picked) {
    throw new Error("CRM deployment lookup requires a northstar_client_id or business_id.");
  }
  url.searchParams.set(picked[0], picked[1] as string);
  return url.toString();
}

/* ------------------------------- derivation ------------------------------- */

export interface CrmStatusDerivation {
  status: ProvisioningStatus;
  /** Operator-facing reason, or null when everything is nominal. */
  reason: string | null;
}

/** Readiness keys CRM explicitly reports as not ready, in display order. */
export function blockedReadiness(report: CrmDeploymentReport): CrmReadinessKey[] {
  return CRM_READINESS_KEYS.filter((key) => report.readiness[key] === false);
}

/**
 * True only when CRM affirmatively reports both isolation readiness flags.
 * Missing flags mean "not proven yet", which is treated as not isolated.
 */
export function crmTenantIsolationVerified(report: CrmDeploymentReport): boolean {
  return CRM_ISOLATION_READINESS.every((key) => report.readiness[key] === true);
}

/**
 * Maps the CRM contract onto the shared ProvisioningStatus vocabulary, then
 * applies the tenant-isolation gate for external-client deployments.
 */
export function deriveCrmProvisioningStatus(
  report: CrmDeploymentReport,
  options: { internalDeployment?: boolean } = {},
): CrmStatusDerivation {
  if (!isCrmDeploymentContract(report)) {
    return {
      status: "failed",
      reason: `NorthStar CRM returned an unrecognized contract (${report.contract ?? "none"}).`,
    };
  }

  const external = options.internalDeployment !== true;
  const isolated = crmTenantIsolationVerified(report);
  const isolationBlocker =
    "NorthStar CRM does not yet enforce per-business RLS and secure user provisioning for external users. Requires setup before external-client activation.";

  const errorNote = report.lastError ? `CRM last error: ${report.lastError}` : null;

  switch (report.deploymentStatus) {
    case "not_configured":
      return { status: "not_configured", reason: "CRM business is not configured yet." };
    case "unmapped":
      return {
        status: "pending",
        reason: "CRM has no business mapped to this NorthStar client id.",
      };
    case "degraded":
      return {
        status: external && !isolated ? "pending" : "degraded",
        reason:
          external && !isolated
            ? isolationBlocker
            : (errorNote ?? "CRM reports degraded deployment health."),
      };
    case "operational":
      break;
    default:
      return { status: "degraded", reason: "CRM did not report a deployment status." };
  }

  // Operational path.
  if (external && !isolated) {
    return { status: "pending", reason: isolationBlocker };
  }

  const missingCore = CRM_CORE_READINESS.filter((key) => report.readiness[key] !== true);
  if (missingCore.length > 0) {
    return {
      status: "degraded",
      reason: `CRM readiness incomplete: ${missingCore
        .map((key) => CRM_READINESS_LABELS[key])
        .join(", ")}.`,
    };
  }
  if (!report.lastSuccessAt) {
    return { status: "degraded", reason: "CRM has no production success timestamp yet." };
  }
  return { status: "active", reason: null };
}

/** Mapping mismatch between what HQ believes and what CRM has on file. */
export function crmMappingMismatch(
  report: CrmDeploymentReport,
  expected: { northstarClientId: string; externalId: string | null },
): string | null {
  if (report.northstarClientId && report.northstarClientId !== expected.northstarClientId) {
    return "CRM reports a different NorthStar client for this business.";
  }
  if (!report.northstarClientId) {
    return "CRM has not stamped this business with a NorthStar client id.";
  }
  if (expected.externalId && report.externalId && report.externalId !== expected.externalId) {
    return "CRM business id does not match the mapped CRM business id.";
  }
  return null;
}

/** Compact, JSON-safe observation persisted on the mapping row for the UI. */
export function crmObservation(
  report: CrmDeploymentReport,
  options: { internalDeployment?: boolean } = {},
): Record<string, JsonValue> {
  const readiness: Record<string, JsonValue> = {};
  for (const key of CRM_READINESS_KEYS) {
    readiness[key] = report.readiness[key] ?? null;
  }
  return {
    contract: report.contract,
    external_id: report.externalId,
    northstar_client_id: report.northstarClientId,
    tenant: report.tenant,
    status: report.deploymentStatus,
    last_success_at: report.lastSuccessAt,
    last_error: report.lastError,
    readiness,
    tenant_isolation_verified: crmTenantIsolationVerified(report),
    internal_deployment: options.internalDeployment === true,
  };
}
