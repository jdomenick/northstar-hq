import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MODULE_KEYS,
  type ModuleDashboard,
  type ModuleKey,
} from "./types";

const dashboardInput = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
  range: z.string().max(16).nullable().optional(),
});

export interface ModuleDashboardResult {
  dashboard: ModuleDashboard;
  /** Mapped external IDs used for this read, when a client was selected. */
  externalIds: Partial<Record<ModuleKey, string | null>>;
  clientScoped: boolean;
}

/**
 * Read-through dashboard. HQ stores nothing from the sources; every call
 * fetches live and returns truthful per-module states.
 */
export const getModuleDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => dashboardInput.parse(input))
  .handler(async ({ data, context }): Promise<ModuleDashboardResult> => {
    const { loadModuleDashboard } = await import("./adapters.server");

    const externalIds: Partial<Record<ModuleKey, string | null>> = {};
    let samApplicationId: string | null = null;
    const clientScoped = Boolean(data.clientId);
    let ccmPortfolioIds: string[] = [];

    if (data.clientId) {
      // RLS-scoped read as the calling operator.
      const { data: rows, error } = await context.supabase
        .from("client_module_connections")
        .select("module,external_id,active,metadata")
        .eq("organization_id", data.organizationId)
        .eq("client_id", data.clientId);
      if (error) throw new Error(`Module mapping read failed: ${error.message}`);
      for (const row of rows ?? []) {
        const module = row.module as ModuleKey;
        if (MODULE_KEYS.includes(module) && row.active) {
          externalIds[module] = row.external_id;
          if (module === "sam") {
            const meta = (row.metadata ?? null) as { application_id?: unknown } | null;
            samApplicationId =
              meta && typeof meta.application_id === "string" && meta.application_id.trim() !== ""
                ? meta.application_id.trim()
                : null;
          }
        }
      }
    } else {
      // Portfolio view: CCM has no all-tenant selector, so fan out across the
      // mapped tenants of every client still on the roster.
      const { data: clients, error: clientError } = await context.supabase
        .from("revenue_clients")
        .select("id")
        .eq("organization_id", data.organizationId)
        .is("archived_at", null);
      if (clientError) throw new Error(`Client roster read failed: ${clientError.message}`);
      const activeIds = (clients ?? []).map((c) => c.id);

      if (activeIds.length > 0) {
        const { data: rows, error } = await context.supabase
          .from("client_module_connections")
          .select("client_id,module,external_id,active")
          .eq("organization_id", data.organizationId)
          .eq("module", "ccm")
          .in("client_id", activeIds);
        if (error) throw new Error(`Module mapping read failed: ${error.message}`);
        ccmPortfolioIds = [
          ...new Set(
            (rows ?? [])
              .filter((r) => r.active && typeof r.external_id === "string" && r.external_id.trim())
              .map((r) => r.external_id.trim()),
          ),
        ];
      }
    }

    const dashboard = await loadModuleDashboard({
      externalIds,
      samApplicationId,
      clientScoped,
      ccmPortfolioIds,
      range: data.range ?? null,
    });

    return { dashboard, externalIds, clientScoped };
  });

export interface ModuleEnvStatus {
  module: ModuleKey;
  urlEnv: string;
  urlConfigured: boolean;
  secretConfigured: boolean;
  urlSource: "env" | "default";
  secretSource: "vault" | "env" | null;
}

/** Configuration status only. Never returns URLs or secret values. */
export const getModuleEnvStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ModuleEnvStatus[]> => {
    const { readModuleEnvState } = await import("./adapters.server");
    return readModuleEnvState();
  });

export interface ModuleProbeRow {
  module: ModuleKey;
  live: boolean;
  httpStatus: number | null;
  version: string | null;
  source: string | null;
  counts: Record<string, number>;
  reason: string | null;
}

const probeInput = z.object({
  organizationId: z.string().uuid(),
  clientId: z.string().uuid().nullable().optional(),
});

/**
 * Acceptance probe against the four production endpoints. Returns status,
 * contract version and basic counts only. The credential is never exposed.
 */
export const probeModuleReporting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => probeInput.parse(input))
  .handler(async ({ data, context }): Promise<ModuleProbeRow[]> => {
    const { probeModuleSources } = await import("./adapters.server");
    const scope: Partial<Record<ModuleKey, string | null>> = {};
    if (data.clientId) {
      const { data: rows, error } = await context.supabase
        .from("client_module_connections")
        .select("module,external_id,active")
        .eq("organization_id", data.organizationId)
        .eq("client_id", data.clientId);
      if (error) throw new Error(`Module mapping read failed: ${error.message}`);
      for (const row of rows ?? []) {
        const module = row.module as ModuleKey;
        if (MODULE_KEYS.includes(module) && row.active) scope[module] = row.external_id;
      }
    }
    return probeModuleSources(scope);
  });

