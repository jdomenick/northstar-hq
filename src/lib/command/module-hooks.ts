// Client-side data hooks for cross-app module reporting.
//
// Reads are read-through: the server functions call CAM, CCM, CRM and SAM Core
// live. Nothing is cached into HQ storage. Mapping rows (client to external
// tenant id) are the only HQ-owned records here.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  getModuleDashboard,
  getModuleEnvStatus,
  type ModuleDashboardResult,
  type ModuleEnvStatus,
} from "@/lib/module-reporting/module-reporting.functions";
import type { ModuleKey } from "@/lib/module-reporting/types";

export interface ClientModuleConnection {
  id: string;
  client_id: string;
  module: ModuleKey;
  external_id: string;
  external_name: string | null;
  active: boolean;
  updated_at: string;
}

export function useModuleDashboard(
  orgId: string | null,
  clientId: string | null,
  range: string,
) {
  const fetchDashboard = useServerFn(getModuleDashboard);
  return useQuery<ModuleDashboardResult>({
    enabled: !!orgId,
    queryKey: ["command.modules", orgId, clientId, range],
    staleTime: 60_000,
    queryFn: () =>
      fetchDashboard({
        data: { organizationId: orgId as string, clientId: clientId ?? null, range },
      }),
  });
}

export function useModuleEnvStatus(enabled = true) {
  const fetchStatus = useServerFn(getModuleEnvStatus);
  return useQuery<ModuleEnvStatus[]>({
    enabled,
    queryKey: ["command.modules.env"],
    staleTime: 5 * 60_000,
    queryFn: () => fetchStatus(),
  });
}

export function useClientModuleConnections(orgId: string | null) {
  return useQuery<ClientModuleConnection[]>({
    enabled: !!orgId,
    queryKey: ["command.modules.mapping", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_module_connections")
        .select("id,client_id,module,external_id,external_name,active,updated_at")
        .eq("organization_id", orgId as string);
      if (error) throw error;
      return (data ?? []) as ClientModuleConnection[];
    },
  });
}

export interface SaveModuleConnectionInput {
  organizationId: string;
  clientId: string;
  module: ModuleKey;
  externalId: string;
  externalName?: string | null;
  active?: boolean;
}

export function useSaveModuleConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveModuleConnectionInput) => {
      const { error } = await supabase.from("client_module_connections").upsert(
        {
          organization_id: input.organizationId,
          client_id: input.clientId,
          module: input.module,
          external_id: input.externalId.trim(),
          external_name: input.externalName?.trim() || null,
          active: input.active ?? true,
        },
        { onConflict: "client_id,module" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command.modules.mapping"] });
      void qc.invalidateQueries({ queryKey: ["command.modules"] });
    },
  });
}

export function useDeleteModuleConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("client_module_connections")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["command.modules.mapping"] });
      void qc.invalidateQueries({ queryKey: ["command.modules"] });
    },
  });
}
