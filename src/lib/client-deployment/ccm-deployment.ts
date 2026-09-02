/**
 * CCM deployment contract (`ccm.deployment.v1`).
 *
 * CCM reused `public.tenants` and added only a nullable unique
 * `northstar_client_id`, so this is the CCM row of the one client deployment
 * model in HQ: same `client_module_connections` mapping, same shared reporting
 * credential, same ProvisioningStatus vocabulary. Only the endpoint and its
 * capability payload are CCM specific.
 *
 * Selector preference: `northstar_client_id` once the tenant is mapped, then
 * `tenant_id`, `tenant_slug`, `organization_id` as fallbacks.
 *
 * Nothing here performs IO. Parsing and status derivation are pure.
 */

import type { JsonValue, ProvisioningStatus } from "./types";

export const CCM_DEPLOYMENT_PATH = "/api/public/reporting/hq-deployment";
export const CCM_DEPLOYMENT_CONTRACT = "ccm.deployment.v1";

/** Deployment vocabulary CCM reports. Anything else is not trusted. */
export const CCM_DEPLOYMENT_STATUSES = ["healthy", "degraded", "not_configured"] as const;
export type CcmDeploymentStatus = (typeof CCM_DEPLOYMENT_STATUSES)[number];

/** Capability vocabulary CCM reports per surface. */
export const CCM_CAPABILITY_STATES = [
  "connected",
  "configured",
  "blocked",
  "not_configured",
] as const;
export type CcmCapabilityState = (typeof CCM_CAPABILITY_STATES)[number];

/** The capability surfaces CCM reports, in operator display order. */
export const CCM_CAPABILITY_KEYS = [
  "phone_voice",
  "sms",
  "calendar_booking",
  "crm_sync",
  "notifications",
  "business_config",
  "northstar_link",
] as const;
export type CcmCapabilityKey = (typeof CCM_CAPABILITY_KEYS)[number];

export const CCM_CAPABILITY_LABELS: Record<CcmCapabilityKey, string> = {
  phone_voice: "Phone / voice",
  sms: "SMS",
  calendar_booking: "Calendar booking",
  crm_sync: "CRM sync",
  notifications: "Notifications",
  business_config: "Business config",
  northstar_link: "NorthStar link",
};

export const CCM_CAPABILITY_STATE_LABELS: Record<CcmCapabilityState, string> = {
  connected: "Connected",
  configured: "Configured",
  blocked: "Blocked",
  not_configured: "Not configured",
};

export const CCM_DEPLOYMENT_STATUS_LABELS: Record<CcmDeploymentStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  not_configured: "Not configured",
};

export interface CcmDeploymentReport {
  contract: string | null;
  module: string | null;
  /** CCM tenant id, as CCM knows it. */
  externalId: string | null;
  /** Canonical NorthStar client id CCM has on file for that tenant. */
  northstarClientId: string | null;
  northstarOrganizationId: string | null;
  deploymentStatus: CcmDeploymentStatus | null;
  /** True when CCM runs standalone rather than linked to NorthStar HQ. */
  standalone: boolean;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** Only recognized capability keys with recognized states are kept. */
  capabilities: Partial<Record<CcmCapabilityKey, CcmCapabilityState>>;
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
 * A capability may arrive as a bare state string or as an object carrying a
 * `state` (or `status`) field. Anything else is dropped rather than guessed.
 */
function capabilityState(value: unknown): CcmCapabilityState | null {
  const direct = oneOf(value, CCM_CAPABILITY_STATES);
  if (direct) return direct;
  const nested = obj(value);
  return (
    oneOf(nested["state"], CCM_CAPABILITY_STATES) ??
    oneOf(nested["status"], CCM_CAPABILITY_STATES)
  );
}

/** Normalizes the documented payload without inventing missing values. */
export function parseCcmDeployment(payload: unknown): CcmDeploymentReport {
  const root = obj(payload);
  const caps = obj(root["capabilities"]);

  const capabilities: Partial<Record<CcmCapabilityKey, CcmCapabilityState>> = {};
  for (const key of CCM_CAPABILITY_KEYS) {
    const state = capabilityState(caps[key]);
    if (state) capabilities[key] = state;
  }

  return {
    contract: str(root["contract"]) ?? str(root["contract_version"]) ?? str(root["version"]),
    module: str(root["module"]),
    externalId: str(root["external_id"]) ?? str(root["tenant_id"]),
    northstarClientId: str(root["northstar_client_id"]),
    northstarOrganizationId: str(root["northstar_organization_id"]),
    deploymentStatus: oneOf(root["deployment_status"], CCM_DEPLOYMENT_STATUSES),
    standalone: root["standalone"] === true,
    lastSuccessAt: str(root["last_success_at"]),
    lastError: str(root["last_error"]),
    capabilities,
  };
}

/** True when the payload actually claims to be the CCM deployment contract. */
export function isCcmDeploymentContract(report: CcmDeploymentReport): boolean {
  return report.contract === CCM_DEPLOYMENT_CONTRACT && (report.module === "ccm" || report.module === null);
}

/* ------------------------------ url building ------------------------------ */

export interface CcmSelector {
  northstarClientId?: string | null;
  tenantId?: string | null;
  tenantSlug?: string | null;
  organizationId?: string | null;
}

/**
 * Prefers the canonical client id, then tenant id, tenant slug, organization
 * id. Exactly one selector is sent so CCM never has to reconcile two.
 */
export function buildCcmDeploymentUrl(baseUrl: string, selector: CcmSelector): string {
  const url = new URL(CCM_DEPLOYMENT_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const ordered: Array<[string, string | null]> = [
    ["northstar_client_id", selector.northstarClientId?.trim() || null],
    ["tenant_id", selector.tenantId?.trim() || null],
    ["tenant_slug", selector.tenantSlug?.trim() || null],
    ["organization_id", selector.organizationId?.trim() || null],
  ];
  const picked = ordered.find(([, value]) => value !== null);
  if (!picked) {
    throw new Error(
      "CCM deployment lookup requires a northstar_client_id, tenant_id, tenant_slug or organization_id.",
    );
  }
  url.searchParams.set(picked[0], picked[1] as string);
  return url.toString();
}

/* ------------------------------- derivation ------------------------------- */

export interface CcmStatusDerivation {
  status: ProvisioningStatus;
  /** Operator-facing reason, or null when everything is nominal. */
  reason: string | null;
}

/** Capability keys CCM reports as blocked, in display order. */
export function blockedCapabilities(report: CcmDeploymentReport): CcmCapabilityKey[] {
  return CCM_CAPABILITY_KEYS.filter((key) => report.capabilities[key] === "blocked");
}

/** Capability keys CCM reports as genuinely connected, in display order. */
export function connectedCapabilities(report: CcmDeploymentReport): CcmCapabilityKey[] {
  return CCM_CAPABILITY_KEYS.filter((key) => report.capabilities[key] === "connected");
}

/**
 * Maps the CCM contract onto the shared ProvisioningStatus vocabulary.
 *
 * `not_configured` is a truthful pre-provisioning state, not a failure.
 * `healthy` still degrades when CCM reports a blocked capability or says it is
 * running standalone, because neither of those is a fully wired deployment.
 */
export function deriveCcmProvisioningStatus(report: CcmDeploymentReport): CcmStatusDerivation {
  if (!isCcmDeploymentContract(report)) {
    return {
      status: "failed",
      reason: `CCM returned an unrecognized contract (${report.contract ?? "none"}).`,
    };
  }

  const errorNote = report.lastError ? `CCM last error: ${report.lastError}` : null;

  switch (report.deploymentStatus) {
    case "not_configured":
      return { status: "not_configured", reason: "CCM tenant is not configured yet." };
    case "degraded":
      return { status: "degraded", reason: errorNote ?? "CCM reports degraded deployment health." };
    case "healthy":
      break;
    default:
      return { status: "degraded", reason: "CCM did not report a deployment status." };
  }

  const blocked = blockedCapabilities(report);
  if (blocked.length > 0) {
    return {
      status: "degraded",
      reason: `CCM reports blocked capabilities: ${blocked
        .map((key) => CCM_CAPABILITY_LABELS[key])
        .join(", ")}.`,
    };
  }
  if (report.standalone) {
    return { status: "degraded", reason: "CCM is running standalone, not linked to NorthStar HQ." };
  }
  if (!report.lastSuccessAt) {
    return { status: "degraded", reason: "CCM has no production success timestamp yet." };
  }
  return { status: "active", reason: null };
}

/** Mapping mismatch between what HQ believes and what CCM has on file. */
export function ccmMappingMismatch(
  report: CcmDeploymentReport,
  expected: { northstarClientId: string; externalId: string | null },
): string | null {
  if (report.northstarClientId && report.northstarClientId !== expected.northstarClientId) {
    return "CCM reports a different NorthStar client for this tenant.";
  }
  if (!report.northstarClientId) {
    return "CCM has not stamped this tenant with a NorthStar client id.";
  }
  if (expected.externalId && report.externalId && report.externalId !== expected.externalId) {
    return "CCM tenant id does not match the mapped CCM tenant id.";
  }
  return null;
}

/** Compact, JSON-safe observation persisted on the mapping row for the UI. */
export function ccmObservation(report: CcmDeploymentReport): Record<string, JsonValue> {
  const capabilities: Record<string, JsonValue> = {};
  for (const key of CCM_CAPABILITY_KEYS) {
    capabilities[key] = report.capabilities[key] ?? null;
  }
  return {
    contract: report.contract,
    external_id: report.externalId,
    northstar_client_id: report.northstarClientId,
    northstar_organization_id: report.northstarOrganizationId,
    deployment_status: report.deploymentStatus,
    standalone: report.standalone,
    last_success_at: report.lastSuccessAt,
    last_error: report.lastError,
    capabilities,
  };
}
