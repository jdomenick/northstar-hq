/**
 * CAM deployment contract (`view=deployment`, contract 1.0.0) served by CAM's
 * existing HQ dashboard endpoint. No new endpoint and no second credential:
 * same `/api/public/reporting/hq-dashboard` surface and the same shared
 * reporting secret HQ already uses for CAM.
 *
 * CAM's canonical tenant remains `organizations.id`. `northstar_client_id` on
 * `public.organizations` is only the cross-product mapping alias, so HQ
 * prefers it as the selector once mapped and falls back to the organization
 * id.
 *
 * Nothing here performs IO. Parsing and status derivation are pure.
 */

import type { JsonValue, ProvisioningStatus } from "./types";

export const CAM_DEPLOYMENT_PATH = "/api/public/reporting/hq-dashboard";
export const CAM_DEPLOYMENT_VIEW = "deployment";
export const CAM_DEPLOYMENT_CONTRACT_VERSION = "1.0.0";

/** Deployment vocabulary CAM reports. Anything else is not trusted. */
export const CAM_DEPLOYMENT_STATUSES = [
  "onboarding",
  "active",
  "idle",
  "degraded",
  "paused",
  "inactive",
] as const;
export type CamDeploymentStatus = (typeof CAM_DEPLOYMENT_STATUSES)[number];

export const CAM_DEPLOYMENT_STATUS_LABELS: Record<CamDeploymentStatus, string> = {
  onboarding: "Onboarding",
  active: "Active",
  idle: "Idle",
  degraded: "Degraded",
  paused: "Paused",
  inactive: "Inactive",
};

/** Capability surfaces CAM reports, in operator display order. */
export const CAM_CAPABILITY_KEYS = [
  "lead_capture",
  "lead_routing",
  "crm_delivery",
  "sam_events",
  "hq_mapping",
] as const;
export type CamCapabilityKey = (typeof CAM_CAPABILITY_KEYS)[number];

export const CAM_CAPABILITY_LABELS: Record<CamCapabilityKey, string> = {
  lead_capture: "Lead capture",
  lead_routing: "Lead routing",
  crm_delivery: "CRM delivery",
  sam_events: "SAM events",
  hq_mapping: "HQ mapping",
};

/** Counts CAM reports for the deployment view. */
export const CAM_COUNT_KEYS = ["campaigns_total", "campaigns_live", "leads_in_window"] as const;
export type CamCountKey = (typeof CAM_COUNT_KEYS)[number];

export const CAM_COUNT_LABELS: Record<CamCountKey, string> = {
  campaigns_total: "Campaigns",
  campaigns_live: "Live campaigns",
  leads_in_window: "Leads in window",
};

export interface CamCapability {
  ready: boolean | null;
  detail: string | null;
}

export interface CamDeploymentReport {
  /** Contract version CAM stamps on the deployment view. */
  contractVersion: string | null;
  module: string | null;
  /** CAM organization id, as CAM knows it. */
  externalId: string | null;
  /** CAM organization slug. */
  externalKey: string | null;
  /** Canonical NorthStar client id CAM has on file for that organization. */
  northstarClientId: string | null;
  /** Whether CAM considers this organization mapped to a NorthStar client. */
  mapped: boolean;
  accountStatus: string | null;
  deploymentStatus: CamDeploymentStatus | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  capabilities: Partial<Record<CamCapabilityKey, CamCapability>>;
  counts: Partial<Record<CamCountKey, number>>;
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

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const s = str(value);
  return s !== null && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

/**
 * A capability arrives as `{ ready, detail }`. A bare boolean is accepted as
 * readiness without detail. Anything else is dropped rather than guessed.
 */
function capability(value: unknown): CamCapability | null {
  if (typeof value === "boolean") return { ready: value, detail: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const ready = typeof o["ready"] === "boolean" ? (o["ready"] as boolean) : null;
  const detail = str(o["detail"]);
  if (ready === null && detail === null) return null;
  return { ready, detail };
}

/**
 * Normalizes the deployment client payload without inventing missing values.
 * Accepts either the client object directly or the enveloped response that
 * carries it under `client`, `deployment`, or `data`.
 */
export function parseCamDeployment(payload: unknown): CamDeploymentReport {
  const root = obj(payload);
  const envelope = obj(root["client"] ?? root["deployment"] ?? root["data"]);
  const body = Object.keys(envelope).length > 0 ? envelope : root;

  const caps = obj(body["capabilities"]);
  const capabilities: Partial<Record<CamCapabilityKey, CamCapability>> = {};
  for (const key of CAM_CAPABILITY_KEYS) {
    const parsed = capability(caps[key]);
    if (parsed) capabilities[key] = parsed;
  }

  const rawCounts = obj(body["counts"]);
  const counts: Partial<Record<CamCountKey, number>> = {};
  for (const key of CAM_COUNT_KEYS) {
    const value = num(rawCounts[key]);
    if (value !== null) counts[key] = value;
  }

  return {
    contractVersion:
      str(body["contract_version"]) ??
      str(root["contract_version"]) ??
      str(root["version"]) ??
      null,
    module: str(body["module"]),
    externalId: str(body["external_id"]) ?? str(body["organization_id"]),
    externalKey: str(body["external_key"]),
    northstarClientId: str(body["northstar_client_id"]),
    mapped: body["mapped"] === true,
    accountStatus: str(body["account_status"]),
    deploymentStatus: oneOf(body["status"], CAM_DEPLOYMENT_STATUSES),
    lastSuccessAt: str(body["last_success_at"]),
    lastError: str(body["last_error"]),
    capabilities,
    counts,
  };
}

/** True when the payload actually claims to be the CAM deployment view. */
export function isCamDeploymentContract(report: CamDeploymentReport): boolean {
  return report.module === "cam" && report.deploymentStatus !== null;
}

/* ------------------------------ url building ------------------------------ */

export interface CamSelector {
  northstarClientId?: string | null;
  organizationId?: string | null;
}

/**
 * Prefers the canonical client id, then the CAM organization id. Exactly one
 * selector is sent so CAM never has to reconcile two.
 */
export function buildCamDeploymentUrl(baseUrl: string, selector: CamSelector): string {
  const url = new URL(CAM_DEPLOYMENT_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const client = selector.northstarClientId?.trim() || selector.organizationId?.trim() || null;
  if (!client) {
    throw new Error("CAM deployment lookup requires a northstar_client_id or organization id.");
  }
  url.searchParams.set("view", CAM_DEPLOYMENT_VIEW);
  url.searchParams.set("client", client);
  return url.toString();
}

/* ------------------------------- derivation ------------------------------- */

export interface CamStatusDerivation {
  status: ProvisioningStatus;
  /** Operator-facing reason, or null when everything is nominal. */
  reason: string | null;
}

/** Capability keys CAM reports as not ready, in display order. */
export function blockedCamCapabilities(report: CamDeploymentReport): CamCapabilityKey[] {
  return CAM_CAPABILITY_KEYS.filter((key) => report.capabilities[key]?.ready === false);
}

/** Capability keys CAM reports as ready, in display order. */
export function readyCamCapabilities(report: CamDeploymentReport): CamCapabilityKey[] {
  return CAM_CAPABILITY_KEYS.filter((key) => report.capabilities[key]?.ready === true);
}

/**
 * Maps the CAM deployment view onto the shared ProvisioningStatus vocabulary.
 * CAM's real status is preserved: idle and paused are truthful operating
 * states, not failures, and are never upgraded to active here.
 */
export function deriveCamProvisioningStatus(report: CamDeploymentReport): CamStatusDerivation {
  if (!isCamDeploymentContract(report)) {
    return {
      status: "failed",
      reason: "CAM did not return a recognizable deployment view payload.",
    };
  }

  const errorNote = report.lastError ? `CAM last error: ${report.lastError}` : null;

  switch (report.deploymentStatus) {
    case "inactive":
      return { status: "not_configured", reason: "CAM organization is inactive." };
    case "onboarding":
      return { status: "pending", reason: "CAM organization is still onboarding." };
    case "paused":
      return { status: "disabled", reason: "CAM organization is paused." };
    case "idle":
      return { status: "degraded", reason: "CAM organization is idle with no recent activity." };
    case "degraded":
      return { status: "degraded", reason: errorNote ?? "CAM reports degraded deployment health." };
    case "active":
      break;
  }

  if (!report.mapped || !report.northstarClientId) {
    return { status: "degraded", reason: "CAM has not mapped this organization to a NorthStar client id." };
  }
  const blocked = blockedCamCapabilities(report);
  if (blocked.length > 0) {
    return {
      status: "degraded",
      reason: `CAM reports capabilities not ready: ${blocked
        .map((key) => CAM_CAPABILITY_LABELS[key])
        .join(", ")}.`,
    };
  }
  if (!report.lastSuccessAt) {
    return { status: "degraded", reason: "CAM has no production success timestamp yet." };
  }
  return { status: "active", reason: null };
}

/** Mapping mismatch between what HQ believes and what CAM has on file. */
export function camMappingMismatch(
  report: CamDeploymentReport,
  expected: { northstarClientId: string; externalId: string | null },
): string | null {
  if (report.northstarClientId && report.northstarClientId !== expected.northstarClientId) {
    return "CAM reports a different NorthStar client for this organization.";
  }
  if (!report.northstarClientId) {
    return "CAM has not stamped this organization with a NorthStar client id.";
  }
  if (expected.externalId && report.externalId && report.externalId !== expected.externalId) {
    return "CAM organization id does not match the mapped CAM organization id.";
  }
  return null;
}

/** Compact, JSON-safe observation persisted on the mapping row for the UI. */
export function camObservation(report: CamDeploymentReport): Record<string, JsonValue> {
  const capabilities: Record<string, JsonValue> = {};
  for (const key of CAM_CAPABILITY_KEYS) {
    const cap = report.capabilities[key];
    capabilities[key] = cap ? { ready: cap.ready, detail: cap.detail } : null;
  }
  const counts: Record<string, JsonValue> = {};
  for (const key of CAM_COUNT_KEYS) {
    counts[key] = report.counts[key] ?? null;
  }
  return {
    contract_version: report.contractVersion,
    external_id: report.externalId,
    external_key: report.externalKey,
    northstar_client_id: report.northstarClientId,
    mapped: report.mapped,
    account_status: report.accountStatus,
    status: report.deploymentStatus,
    last_success_at: report.lastSuccessAt,
    last_error: report.lastError,
    capabilities,
    counts,
  };
}
