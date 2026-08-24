/**
 * Read-through fetcher for module reporting endpoints.
 *
 * Pure with respect to the environment: every input (base URL, secret, fetch
 * implementation) is injected by the caller, so this is unit testable and never
 * reads process.env itself. Server-only callers live in adapters.server.ts.
 *
 * Failure of one module never affects another: each call resolves to its own
 * ModuleSource with a truthful reason.
 */

import { isUuid, resolveRange, type ResolvedRange } from "./range";
import {
  MODULE_LABELS,
  MODULE_NORMALIZERS,
  REPORTING_PATH,
  REPORTING_SECRET_HEADER,
  moduleNotConnected,
  moduleOk,
  moduleUnavailable,
  normalizeVersion,
  type ModuleKey,
  type ModuleSource,
} from "./types";

export type FetchImpl = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface ModuleFetchConfig {
  module: ModuleKey;
  baseUrl: string | null | undefined;
  secret: string | null | undefined;
  externalId?: string | null;
  /** SAM Core only: optional application scope stored in connection metadata. */
  applicationId?: string | null;
  /** HQ dashboard range key (mtd | 30d | qtd | ytd). */
  range?: string | null;
  /** Pre-resolved window, so all four modules share one clock. */
  resolved?: ResolvedRange;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
}

/**
 * Every source owns a different scope/window contract. This builds the exact
 * query each one documents, rather than a generic external_id + range pair.
 *
 * CAM: optional `client` (org UUID or slug), `period` shorthand where supported,
 *      otherwise explicit `start`/`end`.
 * CCM: requires `tenant_id` (UUID) or `tenant_slug`, plus `from`/`to`.
 * CRM: `business_id` accepting UUID, slug or `all`, plus `from`/`to`.
 * SAM: optional `organization_id`, plus `from`/`to`.
 */
export function buildReportingUrl(
  module: ModuleKey,
  baseUrl: string,
  externalId: string | null,
  resolved: ResolvedRange,
): string {
  const url = new URL(REPORTING_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const q = url.searchParams;
  const id = externalId && externalId.trim() !== "" ? externalId.trim() : null;

  switch (module) {
    case "cam":
      if (id) q.set("client", id);
      if (resolved.camPeriod) {
        q.set("period", resolved.camPeriod);
      } else {
        q.set("start", resolved.startIso);
        q.set("end", resolved.endIso);
      }
      break;
    case "ccm":
      // CCM has no portfolio-wide selector; callers must scope it.
      if (id) q.set(isUuid(id) ? "tenant_id" : "tenant_slug", id);
      q.set("from", resolved.startIso);
      q.set("to", resolved.endIso);
      break;
    case "crm":
      q.set("business_id", id ?? "all");
      q.set("from", resolved.startIso);
      q.set("to", resolved.endIso);
      break;
    case "sam":
      if (id) q.set("organization_id", id);
      q.set("from", resolved.startIso);
      q.set("to", resolved.endIso);
      break;
  }
  return url.toString();
}

export function buildReportingHeaders(secret: string): Record<string, string> {
  return {
    [REPORTING_SECRET_HEADER]: secret,
    Accept: "application/json",
  };
}

export async function fetchModuleReport<T>(
  config: ModuleFetchConfig,
): Promise<ModuleSource<T>> {
  const { module, baseUrl, secret, externalId = null } = config;
  const label = MODULE_LABELS[module];
  const resolved = config.resolved ?? resolveRange(config.range ?? null);

  if (module === "ccm" && !externalId) {
    return moduleNotConnected<T>(
      module,
      `${label} reporting requires a tenant scope. Select a client with a mapped ${label} ID to read live data.`,
    );
  }

  if (!baseUrl) {
    return moduleNotConnected<T>(
      module,
      `${label} reporting URL is not configured. Set the module reporting URL to read live data.`,
    );
  }
  if (!secret) {
    return moduleNotConnected<T>(
      module,
      `${label} reporting secret is not configured. Set the shared reporting secret to read live data.`,
    );
  }

  let url: string;
  try {
    url = buildReportingUrl(module, baseUrl, externalId, resolved);
  } catch {
    return moduleUnavailable<T>(module, `${label} reporting URL is not a valid URL.`);
  }

  const doFetch = config.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 8000);

  try {
    const res = await doFetch(url, {
      method: "GET",
      headers: buildReportingHeaders(secret),
      signal: controller.signal,
    });

    if (!res.ok) {
      const reason =
        res.status === 401 || res.status === 403
          ? `${label} rejected the reporting credential (HTTP ${res.status}).`
          : res.status === 404
            ? `${label} does not expose the reporting endpoint yet (HTTP 404).`
            : `${label} reporting request failed (HTTP ${res.status}).`;
      return moduleUnavailable<T>(module, reason, externalId);
    }

    const payload = await res.json();
    const normalize = MODULE_NORMALIZERS[module] as (
      p: unknown,
      ctx: { externalId: string | null },
    ) => T;
    return moduleOk<T>(
      module,
      normalize(payload, { externalId }),
      normalizeVersion(payload),
      externalId,
    );
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `${label} reporting request timed out.`
        : err instanceof Error
          ? `${label} reporting request failed: ${err.message}`
          : `${label} reporting request failed.`;
    return moduleUnavailable<T>(module, message, externalId);
  } finally {
    clearTimeout(timer);
  }
}
