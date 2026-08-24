/**
 * Server-only adapters. Base URLs come from the environment with deployed
 * production defaults; the shared credential comes from Supabase Vault with an
 * environment fallback. Neither is ever returned to the browser.
 */

import { fetchModuleReport } from "./fetcher";
import { resolveRange, type ResolvedRange } from "./range";
import { resolveReportingSecret } from "./secret.server";
import {
  MODULE_KEYS,
  MODULE_URL_DEFAULT,
  MODULE_URL_ENV,
  moduleNotConnected,
  moduleOk,
  moduleUnavailable,
  type CamReport,
  type CcmReport,
  type CrmReport,
  type ModuleDashboard,
  type ModuleKey,
  type ModuleSource,
  type SamReport,
} from "./types";

function envValue(name: string): string | null {
  const raw = process.env[name];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
}

/** Env override first, deployed production default second. */
export function moduleBaseUrl(module: ModuleKey): string {
  return envValue(MODULE_URL_ENV[module]) ?? MODULE_URL_DEFAULT[module];
}

export interface ModuleEnvState {
  module: ModuleKey;
  urlEnv: string;
  urlConfigured: boolean;
  secretConfigured: boolean;
  /** Where the base URL came from. */
  urlSource: "env" | "default";
  /** Where the credential came from. Never the credential itself. */
  secretSource: "vault" | "env" | null;
}

export async function readModuleEnvState(): Promise<ModuleEnvState[]> {
  const { secret, source } = await resolveReportingSecret();
  return MODULE_KEYS.map((module) => ({
    module,
    urlEnv: MODULE_URL_ENV[module],
    urlConfigured: true,
    urlSource: envValue(MODULE_URL_ENV[module]) ? ("env" as const) : ("default" as const),
    secretConfigured: secret !== null,
    secretSource: source,
  }));
}

export interface DashboardRequest {
  /** External tenant/business/org id per module. Missing entries stay unmapped. */
  externalIds: Partial<Record<ModuleKey, string | null>>;
  /** SAM Core optional application scope, from connection metadata. */
  samApplicationId?: string | null;
  /** True when a specific client is selected, so an unmapped module is truthful. */
  clientScoped: boolean;
  /**
   * Portfolio view only. CCM has no portfolio-wide selector, so HQ fans out
   * across every mapped active tenant and sums the results.
   */
  ccmPortfolioIds?: string[];
  range?: string | null;
}

async function loadModule<T>(
  module: ModuleKey,
  req: DashboardRequest,
  resolved: ResolvedRange,
  secret: string | null,
): Promise<ModuleSource<T>> {
  const externalId = req.externalIds[module] ?? null;
  if (req.clientScoped && !externalId) {
    return moduleNotConnected<T>(
      module,
      "This client has no external ID mapped for this module. Add the mapping in Settings.",
    );
  }
  return fetchModuleReport<T>({
    module,
    baseUrl: moduleBaseUrl(module),
    secret,
    externalId,
    applicationId: module === "sam" ? (req.samApplicationId ?? null) : null,
    resolved,
  });
}

/** Sums a list of nullable numbers, returning null when nothing was reported. */
function addNullable(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return a + b;
}

/**
 * Merges per-tenant CCM reports into one portfolio figure. Counts are summed,
 * average response time is weighted by conversation volume, and trends are
 * summed per label. Nothing is invented: a field none of the tenants reported
 * stays null.
 */
export function mergeCcmReports(reports: CcmReport[]): CcmReport {
  const merged: CcmReport = {
    conversations: null,
    avgResponseSeconds: null,
    appointments: null,
    bookingFailures: null,
    trend: [],
    activity: [],
  };

  let weightedResponse = 0;
  let responseWeight = 0;
  const trend = new Map<string, number>();

  for (const r of reports) {
    merged.conversations = addNullable(merged.conversations, r.conversations);
    merged.appointments = addNullable(merged.appointments, r.appointments);
    merged.bookingFailures = addNullable(merged.bookingFailures, r.bookingFailures);
    if (r.avgResponseSeconds !== null) {
      const weight = r.conversations && r.conversations > 0 ? r.conversations : 1;
      weightedResponse += r.avgResponseSeconds * weight;
      responseWeight += weight;
    }
    for (const point of r.trend) {
      trend.set(point.label, (trend.get(point.label) ?? 0) + point.value);
    }
    merged.activity.push(...r.activity);
  }

  merged.avgResponseSeconds = responseWeight > 0 ? weightedResponse / responseWeight : null;
  merged.trend = [...trend.entries()].map(([label, value]) => ({ label, value }));
  return merged;
}

/** Portfolio CCM: fan out across mapped tenants and merge. */
async function loadCcmPortfolio(
  ids: string[],
  resolved: ResolvedRange,
  secret: string | null,
): Promise<ModuleSource<CcmReport>> {
  const results = await Promise.all(
    ids.map((externalId) =>
      fetchModuleReport<CcmReport>({
        module: "ccm",
        baseUrl: moduleBaseUrl("ccm"),
        secret,
        externalId,
        resolved,
      }),
    ),
  );

  const okReports = results
    .filter((r) => r.status === "ok" && r.data !== null)
    .map((r) => r.data as CcmReport);

  if (okReports.length === 0) {
    const firstReason = results.find((r) => r.reason)?.reason ?? null;
    const anyUnavailable = results.some((r) => r.status === "unavailable");
    return anyUnavailable
      ? moduleUnavailable<CcmReport>(
          "ccm",
          firstReason ?? "No mapped CCM tenant answered the reporting request.",
        )
      : moduleNotConnected<CcmReport>(
          "ccm",
          firstReason ?? "No mapped CCM tenant answered the reporting request.",
        );
  }

  return moduleOk<CcmReport>(
    "ccm",
    mergeCcmReports(okReports),
    results.find((r) => r.version)?.version ?? null,
    null,
  );
}

/** Fetches all four modules concurrently. One failure never blocks the rest. */
export async function loadModuleDashboard(
  req: DashboardRequest,
): Promise<ModuleDashboard> {
  // One clock for all four sources so the windows line up.
  const resolved = resolveRange(req.range ?? null);
  const { secret } = await resolveReportingSecret();
  const portfolioCcm = !req.clientScoped && (req.ccmPortfolioIds?.length ?? 0) > 0;
  const [cam, ccm, crm, sam] = await Promise.all([
    loadModule<CamReport>("cam", req, resolved, secret),
    portfolioCcm
      ? loadCcmPortfolio(req.ccmPortfolioIds as string[], resolved, secret)
      : loadModule<CcmReport>("ccm", req, resolved, secret),
    loadModule<CrmReport>("crm", req, resolved, secret),
    loadModule<SamReport>("sam", req, resolved, secret),
  ]);
  return { cam, ccm, crm, sam };
}


export interface ModuleProbeResult {
  module: ModuleKey;
  /** True only when the production endpoint answered 200 and parsed. */
  live: boolean;
  httpStatus: number | null;
  version: string | null;
  source: string | null;
  /** Small, non-sensitive shape counts proving the payload parsed. */
  counts: Record<string, number>;
  reason: string | null;
}

function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Acceptance probe. Calls each source with the Vault credential and returns
 * only status, version and basic counts. Never returns payload data or the
 * credential.
 */
export async function probeModuleSources(
  scope: Partial<Record<ModuleKey, string | null>> = {},
): Promise<ModuleProbeResult[]> {
  const resolved = resolveRange("30d");
  const { secret } = await resolveReportingSecret();

  const { buildReportingHeaders, buildReportingUrl } = await import("./fetcher");

  return Promise.all(
    MODULE_KEYS.map(async (module): Promise<ModuleProbeResult> => {
      const base: ModuleProbeResult = {
        module,
        live: false,
        httpStatus: null,
        version: null,
        source: null,
        counts: {},
        reason: null,
      };
      const externalId = scope[module] ?? null;
      if (!secret) {
        return { ...base, reason: "Shared reporting credential is not configured." };
      }
      if (module === "ccm" && !externalId) {
        return {
          ...base,
          reason: "CCM requires a tenant scope; probe it with a mapped tenant ID.",
        };
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          buildReportingUrl(module, moduleBaseUrl(module), externalId, resolved),
          {
            method: "GET",
            headers: buildReportingHeaders(secret),
            signal: controller.signal,
          },
        );
        if (!res.ok) {
          return {
            ...base,
            httpStatus: res.status,
            reason: `Source responded HTTP ${res.status}.`,
          };
        }
        const payload = (await res.json()) as Record<string, unknown>;
        const counts: Record<string, number> = {};
        if (module === "cam") {
          counts.clients = countOf(payload.clients);
          counts.unavailable = countOf(payload.unavailable);
        } else if (module === "ccm") {
          const metrics = (payload.metrics ?? {}) as Record<string, unknown>;
          counts.channel_trend = countOf(metrics.channel_trend);
          counts.recent_activity = countOf(metrics.recent_activity);
        } else if (module === "crm") {
          counts.businesses = countOf(payload.businesses);
          counts.recent_activity = countOf(payload.recent_activity);
        } else {
          counts.applications = countOf(payload.applications);
          counts.organizations = countOf(payload.organizations);
          counts.recent_failures = countOf(payload.recent_failures);
        }
        return {
          ...base,
          live: true,
          httpStatus: res.status,
          version:
            typeof payload.contract_version === "string"
              ? payload.contract_version
              : typeof payload.version === "string"
                ? payload.version
                : null,
          source: typeof payload.source === "string" ? payload.source : null,
          counts,
        };
      } catch (err) {
        return {
          ...base,
          reason:
            err instanceof Error && err.name === "AbortError"
              ? "Source request timed out."
              : err instanceof Error
                ? `Source request failed: ${err.message}`
                : "Source request failed.",
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}
