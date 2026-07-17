import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logActivity } from "./activity";

export type Venture = Database["public"]["Tables"]["ventures"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Decision = Database["public"]["Tables"]["decisions"]["Row"];
export type Commitment = Database["public"]["Tables"]["commitments"]["Row"];
export type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];
export type ExecutiveInsight = Database["public"]["Tables"]["executive_insights"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type Priority = Database["public"]["Enums"]["priority_level"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];

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

// ─────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────

export function useProject(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["project", id],
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type NewProjectInput = {
  name: string;
  venture_id: string;
  objective?: string;
  desired_outcome?: string;
  status?: ProjectStatus;
  priority?: Priority;
  owner_user_id?: string | null;
  goal_id?: string | null;
  start_date?: string | null;
  deadline?: string | null;
  next_action?: string;
  risk_summary?: string;
  blocker_summary?: string;
  progress_percentage?: number;
};

export function useCreateProject(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewProjectInput) => {
      if (!orgId) throw new Error("No active organization");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("projects")
        .insert({
          organization_id: orgId,
          venture_id: input.venture_id,
          name: input.name,
          objective: input.objective ?? null,
          desired_outcome: input.desired_outcome ?? null,
          status: input.status ?? "planned",
          priority: input.priority ?? "normal",
          owner_user_id: input.owner_user_id ?? userRes.user?.id ?? null,
          goal_id: input.goal_id ?? null,
          start_date: input.start_date ?? null,
          deadline: input.deadline ?? null,
          next_action: input.next_action ?? null,
          risk_summary: input.risk_summary ?? null,
          blocker_summary: input.blocker_summary ?? null,
          progress_percentage: input.progress_percentage ?? 0,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        organizationId: orgId,
        ventureId: data.venture_id,
        action: "project.created",
        entityType: "project",
        entityId: data.id,
        summary: `Project created: ${data.name}`,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useUpdateProject(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["projects"]["Update"];
      prev?: Project | null;
    }) => {
      const patch = { ...input.patch };
      if (patch.progress_percentage != null) {
        patch.progress_percentage = Math.max(0, Math.min(100, patch.progress_percentage));
      }
      // If completing and no explicit progress, force 100
      if (patch.status === "completed" && patch.progress_percentage == null) {
        patch.progress_percentage = 100;
      }
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;

      if (orgId && input.prev && patch.status && patch.status !== input.prev.status) {
        const isCompleted = patch.status === "completed";
        const isRisk = patch.status === "at_risk" || patch.status === "blocked";
        if (isCompleted || isRisk) {
          await logActivity({
            organizationId: orgId,
            ventureId: data.venture_id,
            action: isCompleted ? "project.completed" : "project.status_changed",
            entityType: "project",
            entityId: data.id,
            summary: isCompleted
              ? `Project completed: ${data.name}`
              : `Project ${data.name} moved to ${patch.status.replaceAll("_", " ")}`,
            metadata: { from: input.prev.status, to: patch.status },
          });
        }
      }
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["projects", orgId] });
      qc.invalidateQueries({ queryKey: ["project", data.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useArchiveProject(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ status: "archived", deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useRestoreProject(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ status: "planned", deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", orgId] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Tasks
// ─────────────────────────────────────────────────────────────

export function useTasks(opts: {
  orgId: string | null;
  projectId?: string;
  ventureId?: string;
}) {
  const { orgId, projectId, ventureId } = opts;
  return useQuery({
    enabled: !!orgId,
    queryKey: ["tasks", orgId, projectId ?? null, ventureId ?? null],
    queryFn: async (): Promise<Task[]> => {
      let q = supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", orgId!)
        .is("deleted_at", null);
      if (projectId) q = q.eq("project_id", projectId);
      if (ventureId) q = q.eq("venture_id", ventureId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateTask(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      project_id?: string;
      venture_id?: string;
      parent_task_id?: string;
      priority?: Priority;
      status?: TaskStatus;
      due_date?: string | null;
      assigned_to?: string | null;
    }) => {
      if (!orgId) throw new Error("No active organization");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          organization_id: orgId,
          title: input.title,
          description: input.description ?? null,
          project_id: input.project_id ?? null,
          venture_id: input.venture_id ?? null,
          parent_task_id: input.parent_task_id ?? null,
          priority: input.priority ?? "normal",
          status: input.status ?? "ready",
          due_date: input.due_date ?? null,
          assigned_to: input.assigned_to ?? userRes.user?.id ?? null,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", orgId] });
      if (vars.project_id) qc.invalidateQueries({ queryKey: ["tasks", orgId, vars.project_id, null] });
    },
  });
}

export function useUpdateTask(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["tasks"]["Update"];
      prev?: Task | null;
    }) => {
      const patch = { ...input.patch };
      // Auto-manage completed_at
      if (patch.status === "completed" && !patch.completed_at) {
        patch.completed_at = new Date().toISOString();
      }
      if (
        input.prev?.status === "completed" &&
        patch.status &&
        patch.status !== "completed"
      ) {
        patch.completed_at = null;
      }
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;

      if (orgId && input.prev && patch.status && patch.status !== input.prev.status) {
        if (patch.status === "completed") {
          await logActivity({
            organizationId: orgId,
            ventureId: data.venture_id ?? null,
            action: "task.completed",
            entityType: "task",
            entityId: data.id,
            summary: `Task completed: ${data.title}`,
          });
        } else if (input.prev.status === "completed") {
          await logActivity({
            organizationId: orgId,
            ventureId: data.venture_id ?? null,
            action: "task.reopened",
            entityType: "task",
            entityId: data.id,
            summary: `Task reopened: ${data.title}`,
          });
        }
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useArchiveTask(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", orgId] }),
  });
}