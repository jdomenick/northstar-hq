import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logActivity } from "./activity";
import { LIMITS } from "./constants";

export type Venture = Database["public"]["Tables"]["ventures"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Decision = Database["public"]["Tables"]["decisions"]["Row"];
export type Commitment = Database["public"]["Tables"]["commitments"]["Row"];
export type ActivityEvent = Database["public"]["Tables"]["activity_events"]["Row"];
export type ExecutiveInsight = Database["public"]["Tables"]["executive_insights"]["Row"];
export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type Priority = Database["public"]["Enums"]["priority_level"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type DecisionStatus = Database["public"]["Enums"]["decision_status"];
export type CommitmentStatus = Database["public"]["Enums"]["commitment_status"];
export type GoalStatus = Database["public"]["Enums"]["goal_status"];
export type KnowledgeRecord = Database["public"]["Tables"]["knowledge_records"]["Row"];
export type KnowledgeType = Database["public"]["Enums"]["knowledge_type"];
export type VerificationStatus = Database["public"]["Enums"]["verification_status"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentProcessingStatus = Database["public"]["Enums"]["document_processing_status"];
export type OrgRole = Database["public"]["Enums"]["org_role"];
export type MemberStatus = Database["public"]["Enums"]["member_status"];

// ─────────────────────────────────────────────────────────────
// SAM Memory & related hooks (Phase 3B). Server-side functions
// are called through TanStack `useServerFn` in the route file;
// these are cache helpers only.
// ─────────────────────────────────────────────────────────────
export type SamMemoryItem = Database["public"]["Tables"]["sam_memory_items"]["Row"];
export type SamMemoryConflict = Database["public"]["Tables"]["sam_memory_conflicts"]["Row"];
export type SamMemoryVersion = Database["public"]["Tables"]["sam_memory_versions"]["Row"];
export type SamMemoryLayer = Database["public"]["Enums"]["sam_memory_layer"];
export type SamMemoryStatus = Database["public"]["Enums"]["sam_memory_status"];
export type SamSettingsRow = Database["public"]["Tables"]["sam_settings"]["Row"];
export type SamResponseFeedbackRow = Database["public"]["Tables"]["sam_response_feedback"]["Row"];

export function useSamSettings(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["sam.settings", orgId],
    queryFn: async (): Promise<SamSettingsRow | null> => {
      const { data, error } = await supabase
        .from("sam_settings")
        .select("*")
        .eq("organization_id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpsertSamSettings(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<SamSettingsRow>) => {
      if (!orgId) throw new Error("No active organization");
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("sam_settings")
        .upsert(
          { organization_id: orgId, ...patch, updated_by: userRes.user?.id ?? null },
          { onConflict: "organization_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sam.settings", orgId] }),
  });
}

export function useMessageResponseFeedback(orgId: string | null, conversationId: string | null) {
  return useQuery({
    enabled: !!orgId && !!conversationId,
    queryKey: ["sam.feedback", orgId, conversationId],
    queryFn: async (): Promise<SamResponseFeedbackRow[]> => {
      const { data } = await supabase
        .from("sam_response_feedback")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("conversation_id", conversationId!);
      return data ?? [];
    },
  });
}

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

export function useRestoreVenture(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("ventures")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ventures", orgId] }),
  });
}

export function useRestoreGoal(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("goals")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals", orgId] }),
  });
}

export function useRestoreDecision(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("decisions")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decisions", orgId] }),
  });
}

export function useRestoreCommitment(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("commitments")
        .update({ deleted_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commitments", orgId] }),
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
// ─────────────────────────────────────────────────────────────
// Org members / profiles
// ─────────────────────────────────────────────────────────────

export type OrgMember = {
  id: string;
  user_id: string;
  role: Database["public"]["Enums"]["org_role"];
  status: Database["public"]["Enums"]["member_status"];
  profile: Pick<Profile, "id" | "full_name" | "preferred_name" | "email" | "avatar_url"> | null;
};

export function useOrgMembers(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["org-members", orgId],
    queryFn: async (): Promise<OrgMember[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id,user_id,role,status,profile:profiles!organization_members_user_id_fkey(id,full_name,preferred_name,email,avatar_url)")
        .eq("organization_id", orgId!)
        .eq("status", "active");
      if (error) {
        // Fallback if FK alias not present  -  plain join
        const alt = await supabase
          .from("organization_members")
          .select("id,user_id,role,status")
          .eq("organization_id", orgId!)
          .eq("status", "active");
        if (alt.error) throw alt.error;
        return (alt.data ?? []).map((m) => ({ ...m, profile: null }));
      }
      return (data ?? []) as unknown as OrgMember[];
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Decisions (extended CRUD + detail)
// ─────────────────────────────────────────────────────────────

export function useDecision(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["decision", id],
    queryFn: async (): Promise<Decision | null> => {
      const { data, error } = await supabase
        .from("decisions")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type NewDecisionInput = {
  title: string;
  question?: string;
  context?: string;
  venture_id?: string | null;
  project_id?: string | null;
  owner_user_id?: string | null;
  status?: DecisionStatus;
  review_date?: string | null;
};

export function useCreateDecision(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewDecisionInput) => {
      if (!orgId) throw new Error("No active organization");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("decisions")
        .insert({
          organization_id: orgId,
          title: input.title,
          question: input.question ?? null,
          context: input.context ?? null,
          venture_id: input.venture_id ?? null,
          project_id: input.project_id ?? null,
          owner_user_id: input.owner_user_id ?? userRes.user?.id ?? null,
          status: input.status ?? "draft",
          review_date: input.review_date ?? null,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        organizationId: orgId,
        ventureId: data.venture_id,
        entityType: "decision",
        entityId: data.id,
        action: "decision.created",
        summary: `Decision created: ${data.title}`,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decisions", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useUpdateDecision(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["decisions"]["Update"];
      prev?: Decision | null;
    }) => {
      const patch = { ...input.patch };
      // Finalization requirements
      if (patch.status === "decided") {
        const finalDecision = (patch.final_decision ?? input.prev?.final_decision ?? "").toString().trim();
        const rationale = (patch.rationale ?? input.prev?.rationale ?? "").toString().trim();
        if (!finalDecision) throw new Error("Add a final decision before marking as decided.");
        if (!rationale) throw new Error("Add a rationale before marking as decided.");
        if (!patch.decision_date && !input.prev?.decision_date) {
          patch.decision_date = new Date().toISOString().slice(0, 10);
        }
      }

      const { data, error } = await supabase
        .from("decisions")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;

      if (orgId && input.prev && patch.status && patch.status !== input.prev.status) {
        const isFinal = patch.status === "decided";
        const wasFinal = input.prev.status === "decided";
        await logActivity({
          organizationId: orgId,
          ventureId: data.venture_id,
          entityType: "decision",
          entityId: data.id,
          action: isFinal
            ? "decision.finalized"
            : wasFinal
              ? "decision.reopened"
              : "decision.status_changed",
          summary: isFinal
            ? `Decision finalized: ${data.title}`
            : wasFinal
              ? `Decision reopened: ${data.title}`
              : `Decision ${data.title} → ${patch.status.replaceAll("_", " ")}`,
          metadata: { from: input.prev.status, to: patch.status },
        });
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["decisions", orgId] });
      qc.invalidateQueries({ queryKey: ["decision", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useArchiveDecision(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("decisions")
        .update({ deleted_at: new Date().toISOString(), status: "closed" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decisions", orgId] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Commitments
// ─────────────────────────────────────────────────────────────

export function useCommitments(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["commitments", orgId],
    queryFn: async (): Promise<Commitment[]> => {
      const { data, error } = await supabase
        .from("commitments")
        .select("*")
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCommitment(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["commitment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commitments")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Commitment | null;
    },
  });
}

export type NewCommitmentInput = {
  title: string;
  description?: string;
  venture_id?: string | null;
  project_id?: string | null;
  owner_user_id?: string | null;
  priority?: Priority;
  status?: CommitmentStatus;
  due_date?: string | null;
  notes?: string;
};

export function useCreateCommitment(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewCommitmentInput) => {
      if (!orgId) throw new Error("No active organization");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("commitments")
        .insert({
          organization_id: orgId,
          title: input.title,
          description: input.description ?? null,
          venture_id: input.venture_id ?? null,
          project_id: input.project_id ?? null,
          owner_user_id: input.owner_user_id ?? userRes.user?.id ?? null,
          priority: input.priority ?? "normal",
          status: input.status ?? "open",
          due_date: input.due_date ?? null,
          original_due_date: input.due_date ?? null,
          notes: input.notes ?? null,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        organizationId: orgId,
        ventureId: data.venture_id,
        entityType: "commitment",
        entityId: data.id,
        action: "commitment.created",
        summary: `Commitment created: ${data.title}`,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commitments", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useUpdateCommitment(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["commitments"]["Update"];
      prev: Commitment;
      /** If true, this update is a user-initiated Postpone. */
      postpone?: boolean;
      reason?: string;
    }) => {
      const patch = { ...input.patch };
      const prev = input.prev;

      // Postpone logic: preserve original_due_date the first extension, increment count once
      if (input.postpone) {
        if (!patch.due_date) throw new Error("New due date required to postpone.");
        if (prev.due_date && new Date(patch.due_date) <= new Date(prev.due_date)) {
          throw new Error("Postponement must move the due date later.");
        }
        if (!prev.original_due_date) {
          patch.original_due_date = prev.due_date ?? patch.due_date;
        }
        patch.postponement_count = (prev.postponement_count ?? 0) + 1;
      }

      // Completion side-effects
      if (patch.status === "completed" && !patch.completed_at) {
        patch.completed_at = new Date().toISOString();
      }
      if (prev.status === "completed" && patch.status && patch.status !== "completed") {
        patch.completed_at = null;
      }

      const { data, error } = await supabase
        .from("commitments")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;

      if (orgId) {
        if (input.postpone) {
          await logActivity({
            organizationId: orgId,
            ventureId: data.venture_id,
            entityType: "commitment",
            entityId: data.id,
            action: "commitment.postponed",
            summary: `Commitment postponed: ${data.title}`,
            metadata: {
              from: prev.due_date,
              to: data.due_date,
              postponement_count: data.postponement_count,
              reason: input.reason ?? null,
            },
          });
        } else if (patch.status && patch.status !== prev.status) {
          const action =
            patch.status === "completed"
              ? "commitment.completed"
              : prev.status === "completed"
                ? "commitment.reopened"
                : patch.status === "canceled"
                  ? "commitment.canceled"
                  : "commitment.status_changed";
          await logActivity({
            organizationId: orgId,
            ventureId: data.venture_id,
            entityType: "commitment",
            entityId: data.id,
            action,
            summary: `${data.title} → ${patch.status.replaceAll("_", " ")}`,
            metadata: { from: prev.status, to: patch.status },
          });
        }
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["commitments", orgId] });
      qc.invalidateQueries({ queryKey: ["commitment", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useArchiveCommitment(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("commitments")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commitments", orgId] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Goals
// ─────────────────────────────────────────────────────────────

export function useGoals(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["goals", orgId],
    queryFn: async (): Promise<Goal[]> => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("organization_id", orgId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGoal(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["goal", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Goal | null;
    },
  });
}

export type NewGoalInput = {
  title: string;
  description?: string;
  venture_id?: string | null;
  goal_type?: string | null;
  owner_user_id?: string | null;
  priority?: Priority;
  status?: GoalStatus;
  start_date?: string | null;
  target_date?: string | null;
  target_value?: number | null;
  current_value?: number | null;
  unit?: string | null;
};

export function useCreateGoal(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewGoalInput) => {
      if (!orgId) throw new Error("No active organization");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("goals")
        .insert({
          organization_id: orgId,
          title: input.title,
          description: input.description ?? null,
          venture_id: input.venture_id ?? null,
          goal_type: input.goal_type ?? null,
          owner_user_id: input.owner_user_id ?? userRes.user?.id ?? null,
          priority: input.priority ?? "normal",
          status: input.status ?? "active",
          start_date: input.start_date ?? null,
          target_date: input.target_date ?? null,
          target_value: input.target_value ?? null,
          current_value: input.current_value ?? null,
          unit: input.unit ?? null,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        organizationId: orgId,
        ventureId: data.venture_id,
        entityType: "goal",
        entityId: data.id,
        action: "goal.created",
        summary: `Goal created: ${data.title}`,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useUpdateGoal(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["goals"]["Update"];
      prev: Goal;
    }) => {
      const { data, error } = await supabase
        .from("goals")
        .update(input.patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;

      if (orgId) {
        const p = input.patch;
        const prev = input.prev;
        if (p.status && p.status !== prev.status) {
          const isAchieved = p.status === "achieved";
          await logActivity({
            organizationId: orgId,
            ventureId: data.venture_id,
            entityType: "goal",
            entityId: data.id,
            action: isAchieved ? "goal.achieved" : "goal.status_changed",
            summary: isAchieved
              ? `Goal achieved: ${data.title}`
              : `${data.title} → ${p.status.replaceAll("_", " ")}`,
            metadata: { from: prev.status, to: p.status },
          });
        } else if (
          p.current_value != null &&
          p.current_value !== prev.current_value &&
          prev.target_value
        ) {
          const oldPct = Math.round(((prev.current_value ?? 0) / prev.target_value) * 100);
          const newPct = Math.round((p.current_value / prev.target_value) * 100);
          // Log only if crossed a 10-point band
          if (Math.floor(oldPct / 10) !== Math.floor(newPct / 10)) {
            await logActivity({
              organizationId: orgId,
              ventureId: data.venture_id,
              entityType: "goal",
              entityId: data.id,
              action: "goal.progress_updated",
              summary: `${data.title}: ${p.current_value}${data.unit ? " " + data.unit : ""} of ${prev.target_value}`,
              metadata: { from: prev.current_value, to: p.current_value },
            });
          }
        }
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["goals", orgId] });
      qc.invalidateQueries({ queryKey: ["goal", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useArchiveGoal(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("goals")
        .update({ deleted_at: new Date().toISOString(), status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["goals", orgId] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Ventures (update + settings)
// ─────────────────────────────────────────────────────────────

export function useUpdateVenture(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["ventures"]["Update"];
    }) => {
      const { data, error } = await supabase
        .from("ventures")
        .update(input.patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          ventureId: data.id,
          entityType: "venture",
          entityId: data.id,
          action: "venture.updated",
          summary: `${data.name} was updated.`,
        });
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["ventures", orgId] });
      qc.invalidateQueries({ queryKey: ["venture", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Knowledge
// ─────────────────────────────────────────────────────────────

const KNOWLEDGE_MATERIAL_FIELDS: (keyof KnowledgeRecord)[] = [
  "title",
  "knowledge_type",
  "venture_id",
  "content",
  "source",
  "source_url",
  "effective_date",
  "expiration_date",
];

export function knowledgeMaterialChanged(
  prev: KnowledgeRecord,
  patch: Database["public"]["Tables"]["knowledge_records"]["Update"],
): boolean {
  return KNOWLEDGE_MATERIAL_FIELDS.some(
    (k) => k in patch && (patch as Record<string, unknown>)[k as string] !== prev[k],
  );
}

export function useKnowledge(orgId: string | null, opts?: { ventureId?: string | null; includeArchived?: boolean }) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["knowledge", orgId, opts?.ventureId ?? null, !!opts?.includeArchived],
    queryFn: async (): Promise<KnowledgeRecord[]> => {
      let q = supabase.from("knowledge_records").select("*").eq("organization_id", orgId!);
      if (!opts?.includeArchived) q = q.is("deleted_at", null);
      if (opts?.ventureId) q = q.eq("venture_id", opts.ventureId);
      const { data, error } = await q.order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useKnowledgeRecord(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["knowledge-record", id],
    queryFn: async (): Promise<KnowledgeRecord | null> => {
      const { data, error } = await supabase
        .from("knowledge_records")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export type NewKnowledgeInput = {
  title: string;
  knowledge_type: KnowledgeType;
  content?: string;
  venture_id?: string | null;
  source?: string;
  source_url?: string;
  tags?: string[];
  importance?: Priority;
  effective_date?: string | null;
  expiration_date?: string | null;
};

export function useCreateKnowledge(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewKnowledgeInput) => {
      if (!orgId) throw new Error("No active organization");
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("knowledge_records")
        .insert({
          organization_id: orgId,
          title: input.title,
          knowledge_type: input.knowledge_type,
          content: input.content ?? null,
          venture_id: input.venture_id ?? null,
          source: input.source ?? null,
          source_url: input.source_url ?? null,
          tags: input.tags ?? [],
          importance: input.importance ?? "normal",
          effective_date: input.effective_date ?? null,
          expiration_date: input.expiration_date ?? null,
          created_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        organizationId: orgId,
        ventureId: data.venture_id,
        entityType: "knowledge",
        entityId: data.id,
        action: "knowledge.created",
        summary: `Knowledge created: ${data.title}`,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useUpdateKnowledge(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["knowledge_records"]["Update"];
      prev: KnowledgeRecord;
    }) => {
      const patch = { ...input.patch };
      const material = knowledgeMaterialChanged(input.prev, patch);
      const wasVerified = input.prev.verification_status === "verified";
      const resetVerification =
        material && wasVerified && patch.verification_status === undefined;
      if (resetVerification) {
        patch.verification_status = "unverified";
        patch.verified_by = null;
        patch.verified_at = null;
      }
      const { data, error } = await supabase
        .from("knowledge_records")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      if (orgId && material) {
        await logActivity({
          organizationId: orgId,
          ventureId: data.venture_id,
          entityType: "knowledge",
          entityId: data.id,
          action: "knowledge.updated",
          summary: `Knowledge updated: ${data.title}${resetVerification ? " (reverification required)" : ""}`,
          metadata: { reverification_required: resetVerification },
        });
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["knowledge", orgId] });
      qc.invalidateQueries({ queryKey: ["knowledge-record", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useSetKnowledgeVerification(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: VerificationStatus;
      note?: string;
    }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const patch: Database["public"]["Tables"]["knowledge_records"]["Update"] = {
        verification_status: input.status,
      };
      if (input.status === "verified") {
        patch.verified_by = userRes.user?.id ?? null;
        patch.verified_at = new Date().toISOString();
      }
      // outdated & disputed: preserve prior verified_by/verified_at
      const { data, error } = await supabase
        .from("knowledge_records")
        .update(patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      if (orgId) {
        const action =
          input.status === "verified"
            ? "knowledge.verified"
            : input.status === "outdated"
              ? "knowledge.marked_outdated"
              : input.status === "disputed"
                ? "knowledge.disputed"
                : "knowledge.unverified";
        const summary =
          input.status === "verified"
            ? `Verified "${data.title}"`
            : input.status === "outdated"
              ? `"${data.title}" was marked outdated`
              : input.status === "disputed"
                ? `"${data.title}" was marked disputed`
                : `"${data.title}" verification cleared`;
        await logActivity({
          organizationId: orgId,
          ventureId: data.venture_id,
          entityType: "knowledge",
          entityId: data.id,
          action,
          summary,
          metadata: input.note ? { note: input.note } : undefined,
        });
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["knowledge", orgId] });
      qc.invalidateQueries({ queryKey: ["knowledge-record", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useArchiveKnowledge(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; venture_id: string | null }) => {
      const { error } = await supabase
        .from("knowledge_records")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          ventureId: input.venture_id,
          entityType: "knowledge",
          entityId: input.id,
          action: "knowledge.archived",
          summary: `Archived "${input.title}"`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["knowledge", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useRestoreKnowledge(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; venture_id: string | null }) => {
      const { error } = await supabase
        .from("knowledge_records")
        .update({ deleted_at: null })
        .eq("id", input.id);
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          ventureId: input.venture_id,
          entityType: "knowledge",
          entityId: input.id,
          action: "knowledge.restored",
          summary: `Restored "${input.title}"`,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["knowledge", orgId] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Documents
// ─────────────────────────────────────────────────────────────

export function useDocuments(orgId: string | null, opts?: { ventureId?: string | null; includeArchived?: boolean; knowledgeRecordId?: string | null }) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["documents", orgId, opts?.ventureId ?? null, !!opts?.includeArchived, opts?.knowledgeRecordId ?? null],
    queryFn: async (): Promise<DocumentRow[]> => {
      let q = supabase.from("documents").select("*").eq("organization_id", orgId!);
      if (!opts?.includeArchived) q = q.is("deleted_at", null);
      if (opts?.ventureId) q = q.eq("venture_id", opts.ventureId);
      if (opts?.knowledgeRecordId) q = q.eq("knowledge_record_id", opts.knowledgeRecordId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["document", id],
    queryFn: async (): Promise<DocumentRow | null> => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateDocument(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      patch: Database["public"]["Tables"]["documents"]["Update"];
    }) => {
      const { data, error } = await supabase
        .from("documents")
        .update(input.patch)
        .eq("id", input.id)
        .select()
        .single();
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          ventureId: data.venture_id,
          entityType: "document",
          entityId: data.id,
          action: "document.updated",
          summary: `Document updated: ${data.title}`,
        });
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["documents", orgId] });
      qc.invalidateQueries({ queryKey: ["document", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useArchiveDocument(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; venture_id: string | null }) => {
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", input.id);
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          ventureId: input.venture_id,
          entityType: "document",
          entityId: input.id,
          action: "document.archived",
          summary: `Archived document "${input.title}"`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useRestoreDocument(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; venture_id: string | null }) => {
      const { error } = await supabase
        .from("documents")
        .update({ deleted_at: null })
        .eq("id", input.id);
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          ventureId: input.venture_id,
          entityType: "document",
          entityId: input.id,
          action: "document.restored",
          summary: `Restored document "${input.title}"`,
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", orgId] }),
  });
}

// ─────────────────────────────────────────────────────────────
// Members (full: all statuses) + role/status changes
// ─────────────────────────────────────────────────────────────

export type OrgMemberFull = {
  id: string;
  user_id: string;
  role: OrgRole;
  status: MemberStatus;
  joined_at: string | null;
  invited_by: string | null;
  profile: Pick<Profile, "id" | "full_name" | "preferred_name" | "email" | "avatar_url" | "title"> | null;
};

export function useOrgMembersFull(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["org-members-full", orgId],
    queryFn: async (): Promise<OrgMemberFull[]> => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id,user_id,role,status,joined_at,invited_by,profile:profiles!organization_members_user_id_fkey(id,full_name,preferred_name,email,avatar_url,title)")
        .eq("organization_id", orgId!)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as OrgMemberFull[];
    },
  });
}

export function useUpdateMemberRole(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string; role: OrgRole; prevRole: OrgRole; memberName: string }) => {
      const { data, error } = await supabase
        .from("organization_members")
        .update({ role: input.role })
        .eq("id", input.membershipId)
        .select()
        .single();
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          entityType: "member",
          entityId: input.membershipId,
          action: "member.role_changed",
          summary: `${input.memberName}'s role changed from ${input.prevRole} to ${input.role}.`,
          metadata: { from: input.prevRole, to: input.role, user_id: data.user_id },
        });
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members-full", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useUpdateMemberStatus(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { membershipId: string; status: MemberStatus; memberName: string }) => {
      const { data, error } = await supabase
        .from("organization_members")
        .update({ status: input.status })
        .eq("id", input.membershipId)
        .select()
        .single();
      if (error) throw error;
      if (orgId) {
        const action =
          input.status === "suspended"
            ? "member.suspended"
            : input.status === "active"
              ? "member.reactivated"
              : input.status === "removed"
                ? "member.removed"
                : "member.status_changed";
        const summary =
          input.status === "suspended"
            ? `${input.memberName} was suspended.`
            : input.status === "active"
              ? `${input.memberName} was reactivated.`
              : input.status === "removed"
                ? `${input.memberName} was removed.`
                : `${input.memberName} status changed.`;
        await logActivity({
          organizationId: orgId,
          entityType: "member",
          entityId: input.membershipId,
          action,
          summary,
          metadata: { to: input.status, user_id: data.user_id },
        });
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members-full", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Organization + Profile settings
// ─────────────────────────────────────────────────────────────

export function useOrganization(orgId: string | null) {
  return useQuery({
    enabled: !!orgId,
    queryKey: ["organization", orgId],
    queryFn: async (): Promise<Organization | null> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateOrganization(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      patch: Database["public"]["Tables"]["organizations"]["Update"];
    }) => {
      if (!orgId) throw new Error("No active organization");
      const { data, error } = await supabase
        .from("organizations")
        .update(input.patch)
        .eq("id", orgId)
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        organizationId: orgId,
        entityType: "organization",
        entityId: orgId,
        action: "organization.updated",
        summary: `${data.name} settings were updated.`,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organization", orgId] });
      qc.invalidateQueries({ queryKey: ["memberships"] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

export function useProfile(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      patch: Database["public"]["Tables"]["profiles"]["Update"];
    }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(input.patch)
        .eq("id", input.userId)
        .select()
        .single();
      if (error) throw error;
      if (orgId) {
        await logActivity({
          organizationId: orgId,
          entityType: "profile",
          entityId: input.userId,
          action: "profile.updated",
          summary: `${data.preferred_name ?? data.full_name ?? "A member"} updated their profile.`,
        });
      }
      return data;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["profile", d.id] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Activity: venture-scoped + actor profile resolver
// ─────────────────────────────────────────────────────────────

export function useVentureActivity(orgId: string | null, ventureId: string | undefined, limit = 30) {
  return useQuery({
    enabled: !!orgId && !!ventureId,
    queryKey: ["venture-activity", orgId, ventureId, limit],
    queryFn: async (): Promise<ActivityEvent[]> => {
      const { data, error } = await supabase
        .from("activity_events")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("venture_id", ventureId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useActorProfiles(userIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
  return useQuery({
    enabled: ids.length > 0,
    queryKey: ["actor-profiles", ids.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,full_name,preferred_name,email,avatar_url")
        .in("id", ids);
      if (error) throw error;
      const map = new Map<string, Pick<Profile, "id" | "full_name" | "preferred_name" | "email" | "avatar_url">>();
      for (const p of data ?? []) map.set(p.id, p);
      return map;
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Document upload (transactional-ish: DB row → storage → status)
// ─────────────────────────────────────────────────────────────

import {
  DOCUMENTS_BUCKET,
  documentStoragePath,
  validateDocumentFile,
} from "./storage";

export type NewDocumentInput = {
  file: File;
  title: string;
  description?: string;
  venture_id?: string | null;
  knowledge_record_id?: string | null;
};

export function useUploadDocument(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewDocumentInput) => {
      if (!orgId) throw new Error("No active organization");
      const validation = validateDocumentFile(input.file);
      if (validation) throw new Error(validation);

      const { data: userRes } = await supabase.auth.getUser();
      // 1. Create metadata row first (so we have an id for the storage path)
      const { data: doc, error: insertErr } = await supabase
        .from("documents")
        .insert({
          organization_id: orgId,
          venture_id: input.venture_id ?? null,
          knowledge_record_id: input.knowledge_record_id ?? null,
          title: input.title,
          description: input.description ?? null,
          file_name: input.file.name,
          file_path: "pending",
          file_type: input.file.type || null,
          file_size: input.file.size,
          processing_status: "pending",
          uploaded_by: userRes.user?.id ?? null,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const path = documentStoragePath(orgId, doc.id, input.file.name);

      // 2. Upload the object
      const { error: upErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(path, input.file, {
          contentType: input.file.type || undefined,
          upsert: false,
        });
      if (upErr) {
        // Storage failed → mark record failed (do not leave misleading "ready")
        await supabase
          .from("documents")
          .update({ processing_status: "failed", deleted_at: new Date().toISOString() })
          .eq("id", doc.id);
        throw new Error(`Upload failed: ${upErr.message}`);
      }

      // 3. Finalize metadata with path + uploaded status
      const { data: finalDoc, error: finalErr } = await supabase
        .from("documents")
        .update({ file_path: path, processing_status: "uploaded" })
        .eq("id", doc.id)
        .select()
        .single();
      if (finalErr) {
        // metadata finalization failed → safe cleanup of the storage object
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([path]);
        throw new Error(`Metadata save failed: ${finalErr.message}`);
      }

      await logActivity({
        organizationId: orgId,
        ventureId: finalDoc.venture_id,
        entityType: "document",
        entityId: finalDoc.id,
        action: "document.uploaded",
        summary: `Uploaded "${finalDoc.title}"`,
        metadata: { file_size: finalDoc.file_size, file_type: finalDoc.file_type },
      });
      return finalDoc;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["documents", orgId] });
      qc.invalidateQueries({ queryKey: ["activity", orgId] });
    },
  });
}

// ============================================================
// Global search across the active organization only.
// Returns grouped results limited by LIMITS.searchPerCategory.
// ============================================================

export type SearchHit = {
  id: string;
  title: string;
  subtitle?: string | null;
  type: "venture" | "project" | "task" | "goal" | "decision" | "commitment" | "knowledge" | "document" | "member";
  route: { to: string; params?: Record<string, string> };
  ventureId?: string | null;
  status?: string | null;
};

export type GlobalSearchResults = {
  ventures: SearchHit[];
  projects: SearchHit[];
  tasks: SearchHit[];
  goals: SearchHit[];
  decisions: SearchHit[];
  commitments: SearchHit[];
  knowledge: SearchHit[];
  documents: SearchHit[];
  members: SearchHit[];
  total: number;
};

function esc(v: string): string {
  // Escape characters meaningful in PostgREST `or=(...)` filters.
  return v.replace(/[,()"\\]/g, " ").trim();
}

export function useGlobalSearch(
  orgId: string | null,
  rawQuery: string,
  opts?: { includeArchived?: boolean },
) {
  const q = esc(rawQuery ?? "");
  const enabled = !!orgId && q.length >= 2;
  const includeArchived = !!opts?.includeArchived;
  const limit = LIMITS.searchPerCategory;
  const like = `%${q}%`;

  return useQuery({
    queryKey: ["globalSearch", orgId, q, includeArchived],
    enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<GlobalSearchResults> => {
      const notArchived = (b: any) => (includeArchived ? b : b.is("deleted_at", null));

      const [v, p, t, g, d, c, k, doc, mem] = await Promise.all([
        notArchived(
          supabase
            .from("ventures")
            .select("id,name,current_focus,status")
            .eq("organization_id", orgId!)
            .or(`name.ilike.${like},description.ilike.${like},mission.ilike.${like},target_audience.ilike.${like},current_focus.ilike.${like}`)
            .limit(limit),
        ),
        notArchived(
          supabase
            .from("projects")
            .select("id,name,status,venture_id")
            .eq("organization_id", orgId!)
            .or(`name.ilike.${like},objective.ilike.${like},desired_outcome.ilike.${like},next_action.ilike.${like},risk_summary.ilike.${like},blocker_summary.ilike.${like}`)
            .limit(limit),
        ),
        notArchived(
          supabase
            .from("tasks")
            .select("id,title,status,project_id")
            .eq("organization_id", orgId!)
            .or(`title.ilike.${like},description.ilike.${like}`)
            .limit(limit),
        ),
        notArchived(
          supabase
            .from("goals")
            .select("id,title,status,venture_id,goal_type")
            .eq("organization_id", orgId!)
            .or(`title.ilike.${like},description.ilike.${like}`)
            .limit(limit),
        ),
        notArchived(
          supabase
            .from("decisions")
            .select("id,title,status,venture_id")
            .eq("organization_id", orgId!)
            .or(`title.ilike.${like},question.ilike.${like},context.ilike.${like},final_decision.ilike.${like},rationale.ilike.${like},outcome.ilike.${like}`)
            .limit(limit),
        ),
        notArchived(
          supabase
            .from("commitments")
            .select("id,title,status,venture_id")
            .eq("organization_id", orgId!)
            .or(`title.ilike.${like},description.ilike.${like},notes.ilike.${like}`)
            .limit(limit),
        ),
        notArchived(
          supabase
            .from("knowledge_records")
            .select("id,title,knowledge_type,venture_id")
            .eq("organization_id", orgId!)
            .or(`title.ilike.${like},content.ilike.${like},source.ilike.${like}`)
            .limit(limit),
        ),
        notArchived(
          supabase
            .from("documents")
            .select("id,title,file_name,venture_id")
            .eq("organization_id", orgId!)
            .or(`title.ilike.${like},description.ilike.${like},file_name.ilike.${like}`)
            .limit(limit),
        ),
        supabase
          .from("organization_members")
          .select("id,role,status,profile:profiles!organization_members_user_id_fkey(id,preferred_name,full_name,email)")
          .eq("organization_id", orgId!)
          .eq("status", "active")
          .limit(limit * 3),
      ]);

      const ventures: SearchHit[] = (v.data ?? []).map((r: any) => ({
        id: r.id, title: r.name, subtitle: r.current_focus, type: "venture",
        route: { to: "/ventures/$id", params: { id: r.id } },
        ventureId: r.id, status: r.status,
      }));
      const projects: SearchHit[] = (p.data ?? []).map((r: any) => ({
        id: r.id, title: r.name, type: "project",
        route: { to: "/projects/$id", params: { id: r.id } },
        ventureId: r.venture_id, status: r.status,
      }));
      const tasks: SearchHit[] = (t.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, type: "task",
        route: { to: "/projects/$id", params: { id: r.project_id } },
        status: r.status,
      }));
      const goals: SearchHit[] = (g.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, subtitle: r.goal_type, type: "goal",
        route: { to: "/goals/$id", params: { id: r.id } },
        ventureId: r.venture_id, status: r.status,
      }));
      const decisions: SearchHit[] = (d.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, type: "decision",
        route: { to: "/decisions/$id", params: { id: r.id } },
        ventureId: r.venture_id, status: r.status,
      }));
      const commitments: SearchHit[] = (c.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, type: "commitment",
        route: { to: "/commitments/$id", params: { id: r.id } },
        ventureId: r.venture_id, status: r.status,
      }));
      const knowledge: SearchHit[] = (k.data ?? []).map((r: any) => ({
        id: r.id, title: r.title, subtitle: r.knowledge_type, type: "knowledge",
        route: { to: "/knowledge/$id", params: { id: r.id } },
        ventureId: r.venture_id,
      }));
      const documents: SearchHit[] = (doc.data ?? []).map((r: any) => ({
        id: r.id, title: r.title || r.file_name, subtitle: r.file_name, type: "document",
        route: { to: "/documents/$id", params: { id: r.id } },
        ventureId: r.venture_id,
      }));

      const lower = q.toLowerCase();
      const memberHits: SearchHit[] = ((mem.data ?? []) as any[])
        .filter((m) => {
          const p = m.profile ?? {};
          return [p.preferred_name, p.full_name, p.email]
            .filter(Boolean)
            .some((s: string) => s.toLowerCase().includes(lower));
        })
        .slice(0, limit)
        .map((m) => ({
          id: m.id,
          title: m.profile?.preferred_name || m.profile?.full_name || m.profile?.email || "Member",
          subtitle: m.role,
          type: "member",
          route: { to: "/settings" },
        }));

      const total =
        ventures.length + projects.length + tasks.length + goals.length +
        decisions.length + commitments.length + knowledge.length +
        documents.length + memberHits.length;

      return { ventures, projects, tasks, goals, decisions, commitments, knowledge, documents, members: memberHits, total };
    },
  });
}

// ============================================================
// Archive Center: paginated archived records across types.
// ============================================================

export type ArchivedType = "venture" | "project" | "goal" | "decision" | "commitment" | "knowledge" | "document";

export type ArchivedRow = {
  id: string;
  title: string;
  type: ArchivedType;
  archivedAt: string | null;
  route: { to: string; params?: Record<string, string> };
  ventureId?: string | null;
};

export function useArchivedRecords(
  orgId: string | null,
  opts?: { type?: ArchivedType | "all"; ventureId?: string | null; query?: string; limit?: number },
) {
  const type = opts?.type ?? "all";
  const ventureId = opts?.ventureId ?? null;
  const query = (opts?.query ?? "").trim();
  const limit = opts?.limit ?? LIMITS.archivedList;

  return useQuery({
    queryKey: ["archived", orgId, type, ventureId, query, limit],
    enabled: !!orgId,
    queryFn: async (): Promise<ArchivedRow[]> => {
      const results: ArchivedRow[] = [];
      const like = query ? `%${esc(query)}%` : null;

      const runners: Array<{ t: ArchivedType; fn: () => Promise<ArchivedRow[]> }> = [
        { t: "venture", fn: async () => {
            let q = supabase.from("ventures").select("id,name,deleted_at").eq("organization_id", orgId!).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(limit);
            if (like) q = q.ilike("name", like);
            const { data } = await q;
            return (data ?? []).map((r: any) => ({ id: r.id, title: r.name, type: "venture", archivedAt: r.deleted_at, route: { to: "/ventures/$id", params: { id: r.id } }, ventureId: r.id }));
        }},
        { t: "project", fn: async () => {
            let q = supabase.from("projects").select("id,name,deleted_at,venture_id").eq("organization_id", orgId!).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(limit);
            if (like) q = q.ilike("name", like);
            if (ventureId) q = q.eq("venture_id", ventureId);
            const { data } = await q;
            return (data ?? []).map((r: any) => ({ id: r.id, title: r.name, type: "project", archivedAt: r.deleted_at, route: { to: "/projects/$id", params: { id: r.id } }, ventureId: r.venture_id }));
        }},
        { t: "goal", fn: async () => {
            let q = supabase.from("goals").select("id,title,deleted_at,venture_id").eq("organization_id", orgId!).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(limit);
            if (like) q = q.ilike("title", like);
            if (ventureId) q = q.eq("venture_id", ventureId);
            const { data } = await q;
            return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, type: "goal", archivedAt: r.deleted_at, route: { to: "/goals/$id", params: { id: r.id } }, ventureId: r.venture_id }));
        }},
        { t: "decision", fn: async () => {
            let q = supabase.from("decisions").select("id,title,deleted_at,venture_id").eq("organization_id", orgId!).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(limit);
            if (like) q = q.ilike("title", like);
            if (ventureId) q = q.eq("venture_id", ventureId);
            const { data } = await q;
            return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, type: "decision", archivedAt: r.deleted_at, route: { to: "/decisions/$id", params: { id: r.id } }, ventureId: r.venture_id }));
        }},
        { t: "commitment", fn: async () => {
            let q = supabase.from("commitments").select("id,title,deleted_at,venture_id").eq("organization_id", orgId!).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(limit);
            if (like) q = q.ilike("title", like);
            if (ventureId) q = q.eq("venture_id", ventureId);
            const { data } = await q;
            return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, type: "commitment", archivedAt: r.deleted_at, route: { to: "/commitments/$id", params: { id: r.id } }, ventureId: r.venture_id }));
        }},
        { t: "knowledge", fn: async () => {
            let q = supabase.from("knowledge_records").select("id,title,deleted_at,venture_id").eq("organization_id", orgId!).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(limit);
            if (like) q = q.ilike("title", like);
            if (ventureId) q = q.eq("venture_id", ventureId);
            const { data } = await q;
            return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, type: "knowledge", archivedAt: r.deleted_at, route: { to: "/knowledge/$id", params: { id: r.id } }, ventureId: r.venture_id }));
        }},
        { t: "document", fn: async () => {
            let q = supabase.from("documents").select("id,title,deleted_at,venture_id").eq("organization_id", orgId!).not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(limit);
            if (like) q = q.ilike("title", like);
            if (ventureId) q = q.eq("venture_id", ventureId);
            const { data } = await q;
            return (data ?? []).map((r: any) => ({ id: r.id, title: r.title, type: "document", archivedAt: r.deleted_at, route: { to: "/documents/$id", params: { id: r.id } }, ventureId: r.venture_id }));
        }},
      ];

      const chosen = type === "all" ? runners : runners.filter((r) => r.t === type);
      const chunks = await Promise.all(chosen.map((r) => r.fn()));
      for (const c of chunks) results.push(...c);
      results.sort((a, b) => (b.archivedAt ?? "").localeCompare(a.archivedAt ?? ""));
      return results.slice(0, limit);
    },
  });
}
