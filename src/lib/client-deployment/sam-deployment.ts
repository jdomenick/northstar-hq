/**
 * SAM Core deployment contract (`sam-deployment.v1`).
 *
 * SAM Core reused `public.organizations.northstar_client_id` and the existing
 * shared reporting secret, so this is not a second SAM integration concept in
 * HQ. It is the SAM row of the one client deployment model: the same
 * `client_module_connections` mapping, the same credential, the same
 * ProvisioningStatus vocabulary. Only the endpoint and its richer payload are
 * SAM specific.
 *
 * Selector preference: `northstar_client_id` once the client is mapped,
 * `organization_id` as the fallback for clients whose SAM organization has not
 * been stamped with the canonical id yet.
 *
 * Nothing here performs IO. Parsing and status derivation are pure.
 */

import type { JsonValue, ProvisioningStatus } from "./types";

export const SAM_DEPLOYMENT_PATH = "/api/public/reporting/sam-deployment";
export const SAM_DEPLOYMENT_CONTRACT = "sam-deployment.v1";

/** Health vocabulary SAM Core reports. Anything else is not trusted. */
export const SAM_HEALTH_STATUSES = ["healthy", "degraded", "no_traffic", "blocked"] as const;
export type SamHealthStatus = (typeof SAM_HEALTH_STATUSES)[number];

/** Installation vocabulary SAM Core reports. */
export const SAM_INSTALLATION_STATUSES = [
  "active",
  "suspended",
  "revoked",
  "not_installed",
] as const;
export type SamInstallationStatus = (typeof SAM_INSTALLATION_STATUSES)[number];

export const SAM_HEALTH_LABELS: Record<SamHealthStatus, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  no_traffic: "No traffic",
  blocked: "Blocked",
};

export const SAM_INSTALLATION_LABELS: Record<SamInstallationStatus, string> = {
  active: "Installed",
  suspended: "Suspended",
  revoked: "Revoked",
  not_installed: "Not installed",
};

export interface SamDeploymentReport {
  contract: string | null;
  /** SAM organization id, as SAM knows it. */
  externalId: string | null;
  /** Canonical NorthStar client id SAM has on file for that organization. */
  northstarClientId: string | null;
  /** Whether SAM considers this organization mapped to a NorthStar client. */
  mapped: boolean;
  installation: {
    status: SamInstallationStatus | null;
    registered: boolean;
    authReady: boolean;
    capabilities: string[];
    applicationState: string | null;
  };
  health: {
    status: SamHealthStatus | null;
    lastSuccessAt: string | null;
    lastActivityAt: string | null;
    lastError: string | null;
    lastErrorAt: string | null;
    tasks24h: number | null;
    failedTasks24h: number | null;
  };
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

function bool(value: unknown): boolean {
  return value === true;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const s = str(value);
  return s !== null && (allowed as readonly string[]).includes(s) ? (s as T) : null;
}

/**
 * Normalizes the documented payload. Unknown enum values are dropped rather
 * than guessed, so an unrecognized status never reads as healthy.
 */
export function parseSamDeployment(payload: unknown): SamDeploymentReport {
  const root = obj(payload);
  const client = obj(root["client"]);
  const install = obj(root["installation"]);
  const health = obj(root["health"]);

  return {
    contract: str(root["contract"]) ?? str(root["version"]),
    externalId: str(client["external_id"]),
    northstarClientId: str(client["northstar_client_id"]),
    mapped: bool(client["mapped"]),
    installation: {
      status: oneOf(install["status"], SAM_INSTALLATION_STATUSES),
      registered: bool(install["registered"]),
      authReady: bool(install["auth_ready"]),
      capabilities: strList(install["capabilities"]),
      applicationState: str(install["application_state"]),
    },
    health: {
      status: oneOf(health["status"], SAM_HEALTH_STATUSES),
      lastSuccessAt: str(health["last_success_at"]),
      lastActivityAt: str(health["last_activity_at"]),
      lastError: str(health["last_error"]),
      lastErrorAt: str(health["last_error_at"]),
      tasks24h: num(health["tasks_24h"]),
      failedTasks24h: num(health["failed_tasks_24h"]),
    },
  };
}

/** True when the payload actually claims to be the SAM deployment contract. */
export function isSamDeploymentContract(report: SamDeploymentReport): boolean {
  return report.contract === SAM_DEPLOYMENT_CONTRACT;
}

/* ------------------------------ url building ------------------------------ */

/**
 * Prefers the canonical client id. Falls back to the SAM organization id only
 * when no canonical id is available for the call.
 */
export function buildSamDeploymentUrl(
  baseUrl: string,
  selector: { northstarClientId: string | null; organizationId: string | null },
): string {
  const url = new URL(SAM_DEPLOYMENT_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const clientId = selector.northstarClientId?.trim() || null;
  const orgId = selector.organizationId?.trim() || null;
  if (clientId) {
    url.searchParams.set("northstar_client_id", clientId);
  } else if (orgId) {
    url.searchParams.set("organization_id", orgId);
  } else {
    throw new Error("SAM deployment lookup requires a northstar_client_id or organization_id.");
  }
  return url.toString();
}

/* ------------------------------- derivation ------------------------------- */

export interface SamStatusDerivation {
  status: ProvisioningStatus;
  /** Operator-facing reason, or null when everything is nominal. */
  reason: string | null;
}

/**
 * Maps the SAM contract onto the shared ProvisioningStatus vocabulary.
 *
 * Installation state is checked first: an organization SAM has not installed,
 * suspended, or revoked is never reported as active regardless of health.
 * `no_traffic` is not proof of a working deployment, so it reads as degraded.
 */
export function deriveSamProvisioningStatus(report: SamDeploymentReport): SamStatusDerivation {
  if (!isSamDeploymentContract(report)) {
    return {
      status: "failed",
      reason: `SAM Core returned an unrecognized contract (${report.contract ?? "none"}).`,
    };
  }

  switch (report.installation.status) {
    case "not_installed":
      return { status: "pending", reason: "SAM Core has no installation for this organization." };
    case "suspended":
      return { status: "disabled", reason: "SAM Core installation is suspended." };
    case "revoked":
      return { status: "failed", reason: "SAM Core installation was revoked." };
    case null:
      return { status: "failed", reason: "SAM Core did not report an installation status." };
    case "active":
      break;
  }

  if (!report.installation.registered) {
    return { status: "pending", reason: "SAM Core installation is not registered yet." };
  }
  if (!report.installation.authReady) {
    return { status: "degraded", reason: "SAM Core installation is not authorized yet." };
  }

  const errorNote = report.health.lastError
    ? `SAM Core last error: ${report.health.lastError}`
    : null;

  switch (report.health.status) {
    case "healthy":
      return { status: "active", reason: null };
    case "no_traffic":
      return {
        status: "degraded",
        reason: "SAM Core is installed and authorized but has processed no traffic yet.",
      };
    case "degraded":
      return { status: "degraded", reason: errorNote ?? "SAM Core reports degraded health." };
    case "blocked":
      return { status: "failed", reason: errorNote ?? "SAM Core reports the installation is blocked." };
    default:
      return { status: "degraded", reason: "SAM Core did not report a health status." };
  }
}

/** Mapping mismatch between what HQ believes and what SAM Core has on file. */
export function samMappingMismatch(
  report: SamDeploymentReport,
  expected: { northstarClientId: string; externalId: string | null },
): string | null {
  if (!report.mapped) {
    return "SAM Core does not have this organization mapped to a NorthStar client.";
  }
  if (
    report.northstarClientId &&
    report.northstarClientId !== expected.northstarClientId
  ) {
    return "SAM Core reports a different NorthStar client for this organization.";
  }
  if (
    expected.externalId &&
    report.externalId &&
    report.externalId !== expected.externalId
  ) {
    return "SAM Core organization id does not match the mapped SAM organization id.";
  }
  return null;
}

/** Compact, JSON-safe observation persisted on the mapping row for the UI. */
export function samObservation(report: SamDeploymentReport): Record<string, JsonValue> {
  return {
    contract: report.contract,
    installation_status: report.installation.status,
    registered: report.installation.registered,
    auth_ready: report.installation.authReady,
    capabilities: report.installation.capabilities,
    application_state: report.installation.applicationState,
    health_status: report.health.status,
    last_success_at: report.health.lastSuccessAt,
    last_activity_at: report.health.lastActivityAt,
    last_error: report.health.lastError,
    last_error_at: report.health.lastErrorAt,
    tasks_24h: report.health.tasks24h,
    failed_tasks_24h: report.health.failedTasks24h,
  };
}
