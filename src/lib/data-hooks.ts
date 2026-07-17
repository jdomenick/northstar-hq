import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Venture = Database["public"]["Tables"]["ventures"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Decision = Database["public"]["Tables"]["decisions"]["Row"];
export type Commitment = Database["public"]["Tables"]["commitments"]["Row"];
export type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];
export type ExecutiveInsight = Database["public"]["Tables"]["executive_insights"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];

export function useVentures(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["ventures", orgId],
    queryFn: async (): Promise<Venture[]> => {
      const { data, error } = await supabase
        .from("ventures")
        .select("*")
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useVenture(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["venture", id],
    queryFn: async (): Promise<Venture | null> => {
      const { data, error } = await supabase
        .from("ventures")
        .select("*")
        .eq("id", id!)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useProjects(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["projects", orgId],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDecisions(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["decisions", orgId],
    queryFn: async (): Promise<Decision[]> => {
      const { data, error } = await supabase
        .from("decisions")
        .select("*")
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActivity(orgId: string | null, limit = 12) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["activity", orgId, limit],
    queryFn: async (): Promise<ActivityEvent[]> => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInsights(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["insights", orgId],
    queryFn: async (): Promise<ExecutiveInsight[]> => {
      const { data, error } = await supabase
        .from("executive_insights")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("status", "active")
        .order("generated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateVenture(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      mission?: string;
      website_url?: string;
      status?: Database["public"]["Enums"]["venture_status"];
      current_focus?: string;
    }) => {
      if (!orgId) throw new Error("No active organization");
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("ventures")
        .insert({
          organization_id: orgId,
          name: input.name,
          description: input.description ?? null,
          mission: input.mission ?? null,
          website_url: input.website_url ?? null,
          status: input.status ?? "active",
          current_focus: input.current_focus ?? null,
          created_by: user.user?.id ?? null,
          owner_user_id: user.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ventures", orgId] });
    },
  });
}

export function useArchiveVenture(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ventures")
        .update({ deleted_at: new Date().toISOString(), status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ventures", orgId] });
    },
  });
}