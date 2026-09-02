/**
 * Server-only helpers for the client deployment layer.
 *
 * Health checks reuse the existing module reporting mechanism: the same base
 * URL resolution (env override, deployed default, optional per-client endpoint
 * override) and the same shared credential from Supabase Vault. No parallel
 * credential or URL setting is introduced here, and neither value is ever
 * returned to the browser.
 */

import { buildReportingHeaders, buildReportingUrl } from "@/lib/module-reporting/fetcher";
import { resolveRange } from "@/lib/module-reporting/range";
import { moduleBaseUrl } from "@/lib/module-reporting/adapters.server";
import { resolveReportingSecret } from "@/lib/module-reporting/secret.server";
import {
  MODULE_PROVISIONING_MODE,
  emptyInstallation,
  isProvisioningStatus,
  type ClientModuleInstallation,
  type JsonValue,
  type ModuleKey,
  type ProvisioningStatus,
} from "./types";
import {
  buildSamDeploymentUrl,
  deriveSamProvisioningStatus,
  parseSamDeployment,
  samMappingMismatch,
  type SamDeploymentReport,
} from "./sam-deployment";
import { MODULE_KEYS } from "@/lib/module-reporting/types";

export interface RawConnectionRow {
  id: string;
  organization_id: string;
  client_id: string;
  module: string;
  external_id: string;
  external_name: string | null;
  endpoint_url: string | null;
  provisioning_status: string;
  active: boolean;
  metadata: unknown;
  last_health_check_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export const CONNECTION_COLUMNS =
  "id,organization_id,client_id,module,external_id,external_name,endpoint_url,provisioning_status,active,metadata,last_health_check_at,last_success_at,last_error,created_at,updated_at";

function configOf(value: unknown): Record<string, JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : {};
}

export function toInstallation(row: RawConnectionRow): ClientModuleInstallation {
  const module = row.module as ModuleKey;
  return {
    id: row.id,
    northstarClientId: row.client_id,
    organizationId: row.organization_id,
    module,
    externalId: row.external_id,
    externalName: row.external_name,
    endpointUrl: row.endpoint_url,
    status: !row.active
      ? "disabled"
      : isProvisioningStatus(row.provisioning_status)
        ? row.provisioning_status
        : "pending",
    provisioningMode: MODULE_PROVISIONING_MODE[module],
    configuration: configOf(row.metadata),
    lastHealthCheckAt: row.last_health_check_at,
    lastSuccessAt: row.last_success_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All four modules, always, with unmapped ones as truthful placeholders. */
export function completeInstallations(
  organizationId: string,
  northstarClientId: string,
  rows: RawConnectionRow[],
): ClientModuleInstallation[] {
  const byModule = new Map<ModuleKey, ClientModuleInstallation>();
  for (const row of rows) {
    if ((MODULE_KEYS as string[]).includes(row.module)) {
      byModule.set(row.module as ModuleKey, toInstallation(row));
    }
  }
  return MODULE_KEYS.map(
    (m) => byModule.get(m) ?? emptyInstallation(organizationId, northstarClientId, m),
  );
}

export interface HealthCheckOutcome {
  module: ModuleKey;
  ok: boolean;
  httpStatus: number | null;
  checkedAt: string;
  error: string | null;
  /** Status the source itself reported, when it exposes a deployment contract. */
  reportedStatus: ProvisioningStatus | null;
  /** Timestamp of the last real success as reported by the source. */
  reportedLastSuccessAt: string | null;
  /** SAM Core deployment observation, persisted for the operator UI. */
  samDeployment: SamDeploymentReport | null;
}

/**
 * SAM Core exposes a dedicated deployment contract (`sam-deployment.v1`) that
 * reports installation and health directly, so HQ reads that instead of
 * inferring liveness from a dashboard payload. Selector preference is the
 * canonical northstar_client_id, with the SAM organization id as fallback.
 */
export async function checkSamDeployment(params: {
  northstarClientId: string | null;
  externalId: string | null;
  endpointUrl: string | null;
  timeoutMs?: number;
}): Promise<HealthCheckOutcome> {
  const checkedAt = new Date().toISOString();
  const base = {
    module: "sam" as const,
    ok: false,
    httpStatus: null as number | null,
    checkedAt,
    reportedStatus: null as ProvisioningStatus | null,
    reportedLastSuccessAt: null as string | null,
    samDeployment: null as SamDeploymentReport | null,
  };

  if (!params.northstarClientId && !params.externalId) {
    return { ...base, error: "No SAM organization ID is mapped for this client." };
  }

  const { secret } = await resolveReportingSecret();
  if (!secret) {
    return { ...base, error: "Shared reporting credential is not configured." };
  }

  const baseUrl = params.endpointUrl?.trim() || moduleBaseUrl("sam");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 10_000);
  try {
    const res = await fetch(
      buildSamDeploymentUrl(baseUrl, {
        northstarClientId: params.northstarClientId,
        organizationId: params.externalId,
      }),
      { method: "GET", headers: buildReportingHeaders(secret), signal: controller.signal },
    );
    if (!res.ok) {
      return {
        ...base,
        httpStatus: res.status,
        error:
          res.status === 401 || res.status === 403
            ? "SAM Core rejected the shared reporting credential."
            : res.status === 404
              ? "SAM Core has no deployment record for this selector."
              : `SAM Core responded HTTP ${res.status}.`,
      };
    }

    const report = parseSamDeployment(await res.json());
    const derived = deriveSamProvisioningStatus(report);
    const mismatch = params.northstarClientId
      ? samMappingMismatch(report, {
          northstarClientId: params.northstarClientId,
          externalId: params.externalId,
        })
      : null;

    const status: ProvisioningStatus = mismatch ? "degraded" : derived.status;
    const ok = status === "active";
    return {
      ...base,
      ok,
      httpStatus: res.status,
      error: mismatch ?? (ok ? null : derived.reason),
      reportedStatus: status,
      reportedLastSuccessAt: report.health.lastSuccessAt,
      samDeployment: report,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown transport error.";
    return {
      ...base,
      error: message.toLowerCase().includes("abort") ? "SAM Core timed out." : message,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Real connectivity check against the module's reporting endpoint. Success
 * means the endpoint answered 200 with parseable JSON for this client's
 * external ID. Nothing else is treated as connected.
 *
 * SAM is routed to its deployment contract, which reports its own truth.
 */
export async function checkModuleHealth(params: {
  module: ModuleKey;
  externalId: string | null;
  endpointUrl: string | null;
  northstarClientId?: string | null;
  applicationId?: string | null;
  timeoutMs?: number;
}): Promise<HealthCheckOutcome> {
  if (params.module === "sam") {
    return checkSamDeployment({
      northstarClientId: params.northstarClientId ?? null,
      externalId: params.externalId,
      endpointUrl: params.endpointUrl,
      timeoutMs: params.timeoutMs,
    });
  }

  const checkedAt = new Date().toISOString();
  const base = {
    module: params.module,
    ok: false,
    httpStatus: null as number | null,
    checkedAt,
    reportedStatus: null as ProvisioningStatus | null,
    reportedLastSuccessAt: null as string | null,
    samDeployment: null as SamDeploymentReport | null,
  };

  if (!params.externalId || params.externalId.trim() === "") {
    return { ...base, error: "No external tenant ID is mapped for this module." };
  }

  const { secret } = await resolveReportingSecret();
  if (!secret) {
    return { ...base, error: "Shared reporting credential is not configured." };
  }

  const baseUrl = params.endpointUrl?.trim() || moduleBaseUrl(params.module);
  const resolved = resolveRange("30d");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), params.timeoutMs ?? 10_000);
  try {
    const res = await fetch(
      buildReportingUrl(
        params.module,
        baseUrl,
        params.externalId.trim(),
        resolved,
        params.applicationId ?? null,
      ),
      { method: "GET", headers: buildReportingHeaders(secret), signal: controller.signal },
    );
    if (!res.ok) {
      return { ...base, httpStatus: res.status, error: `Endpoint responded HTTP ${res.status}.` };
    }
    await res.json();
    return { ...base, ok: true, httpStatus: res.status, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown transport error.";
    return {
      ...base,
      error: message.includes("abort") ? "Endpoint timed out." : message,
    };
  } finally {
    clearTimeout(timer);
  }
}


/** Whether the shared reporting credential exists. Boolean only, never the value. */
export async function reportingCredentialConfigured(): Promise<boolean> {
  const { secret } = await resolveReportingSecret();
  return secret !== null;
}
