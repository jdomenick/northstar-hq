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
    const clientScoped = Boolean(data.clientId);

    if (data.clientId) {
      // RLS-scoped read as the calling operator.
      const { data: rows, error } = await context.supabase
        .from("client_module_connections")
        .select("module,external_id,active")
        .eq("organization_id", data.organizationId)
        .eq("client_id", data.clientId);
      if (error) throw new Error(`Module mapping read failed: ${error.message}`);
      for (const row of rows ?? []) {
        const module = row.module as ModuleKey;
        if (MODULE_KEYS.includes(module) && row.active) {
          externalIds[module] = row.external_id;
        }
      }
    }

    const dashboard = await loadModuleDashboard({
      externalIds,
      clientScoped,
      range: data.range ?? null,
    });

    return { dashboard, externalIds, clientScoped };
  });

export interface ModuleEnvStatus {
  module: ModuleKey;
  urlEnv: string;
  urlConfigured: boolean;
  secretConfigured: boolean;
}

/** Configuration status only. Never returns URLs or secret values. */
export const getModuleEnvStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ModuleEnvStatus[]> => {
    const { readModuleEnvState } = await import("./adapters.server");
    return readModuleEnvState();
  });
