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
  /** Reporting window passed through to the source, when known. */
  range?: string | null;
  timeoutMs?: number;
  fetchImpl?: FetchImpl;
}

export function buildReportingUrl(
  baseUrl: string,
  externalId?: string | null,
  range?: string | null,
): string {
  const url = new URL(REPORTING_PATH, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (externalId) url.searchParams.set("external_id", externalId);
  if (range) url.searchParams.set("range", range);
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
  const { module, baseUrl, secret, externalId = null, range = null } = config;
  const label = MODULE_LABELS[module];

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
    url = buildReportingUrl(baseUrl, externalId, range);
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
    const normalize = MODULE_NORMALIZERS[module] as (p: unknown) => T;
    return moduleOk<T>(module, normalize(payload), normalizeVersion(payload), externalId);
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
