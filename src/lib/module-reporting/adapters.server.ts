/**
 * Server-only adapters. Secrets and base URLs are read from the environment
 * inside function bodies (never at module scope, never in the browser).
 */

import { fetchModuleReport } from "./fetcher";
import {
  MODULE_KEYS,
  MODULE_URL_ENV,
  REPORTING_SECRET_ENV,
  moduleNotConnected,
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

export interface ModuleEnvState {
  module: ModuleKey;
  urlEnv: string;
  urlConfigured: boolean;
  secretConfigured: boolean;
}

export function readModuleEnvState(): ModuleEnvState[] {
  const secretConfigured = envValue(REPORTING_SECRET_ENV) !== null;
  return MODULE_KEYS.map((module) => ({
    module,
    urlEnv: MODULE_URL_ENV[module],
    urlConfigured: envValue(MODULE_URL_ENV[module]) !== null,
    secretConfigured,
  }));
}

export interface DashboardRequest {
  /** External tenant/business/org id per module. Missing entries stay unmapped. */
  externalIds: Partial<Record<ModuleKey, string | null>>;
  /** True when a specific client is selected, so an unmapped module is truthful. */
  clientScoped: boolean;
  range?: string | null;
}

async function loadModule<T>(
  module: ModuleKey,
  req: DashboardRequest,
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
    baseUrl: envValue(MODULE_URL_ENV[module]),
    secret: envValue(REPORTING_SECRET_ENV),
    externalId,
    range: req.range ?? null,
  });
}

/** Fetches all four modules concurrently. One failure never blocks the rest. */
export async function loadModuleDashboard(
  req: DashboardRequest,
): Promise<ModuleDashboard> {
  const [cam, ccm, crm, sam] = await Promise.all([
    loadModule<CamReport>("cam", req),
    loadModule<CcmReport>("ccm", req),
    loadModule<CrmReport>("crm", req),
    loadModule<SamReport>("sam", req),
  ]);
  return { cam, ccm, crm, sam };
}
