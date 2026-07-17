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
export type Goal = Database["public"]["Tables"]["goals"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type Priority = Database["public"]["Enums"]["priority_level"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type DecisionStatus = Database["public"]["Enums"]["decision_status"];
export type CommitmentStatus = Database["public"]["Enums"]["commitment_status"];
export type GoalStatus = Database["public"]["Enums"]["goal_status"];

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
        // Fallback if FK alias not present — plain join
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
