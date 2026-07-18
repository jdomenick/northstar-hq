// Loads a full IntelligenceDataset for one organization using the caller's
// authenticated Supabase client (RLS enforced). Server-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  DsActivity,
  DsCommitment,
  DsDecision,
  DsGoal,
  DsMemoryConflict,
  DsProject,
  DsTask,
  DsVenture,
  IntelligenceDataset,
} from "./detectors";

export async function loadIntelligenceDataset(
  supabase: SupabaseClient<Database>,
  organizationId: string,
): Promise<IntelligenceDataset> {
  const now = new Date();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000).toISOString();

  const [
    venturesQ,
    projectsQ,
    tasksQ,
    commitmentsQ,
    decisionsQ,
    goalsQ,
    activityQ,
    conflictsQ,
  ] = await Promise.all([
    supabase
      .from("ventures")
      .select("id, organization_id, name, status, updated_at")
      .eq("organization_id", organizationId),
    supabase
      .from("projects")
      .select(
        "id, organization_id, venture_id, name, status, owner_user_id, progress_percentage, created_at, updated_at, deadline, deleted_at",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("tasks")
      .select("id, project_id, status, completed_at, created_at, updated_at")
      .eq("organization_id", organizationId)
      .gte("updated_at", sixtyDaysAgo)
      .limit(2000),
    supabase
      .from("commitments")
      .select(
        "id, organization_id, venture_id, title, status, owner_user_id, due_date, postponement_count, completed_at, updated_at, deleted_at",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("decisions")
      .select(
        "id, organization_id, venture_id, title, status, owner_user_id, final_decision, review_date, decision_date, created_at, updated_at, deleted_at",
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null),
    supabase
      .from("goals")
      .select(
        "id, organization_id, venture_id, title, status, progress_percentage, target_date, updated_at",
      )
      .eq("organization_id", organizationId),
    supabase
      .from("activity_events")
      .select("id, organization_id, venture_id, entity_type, entity_id, action, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", sixtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase
      .from("sam_memory_conflicts")
      .select("id, organization_id, status, created_at")
      .eq("organization_id", organizationId),
  ]);

  return {
    now,
    organizationId,
    ventures: (venturesQ.data ?? []) as DsVenture[],
    projects: (projectsQ.data ?? []) as DsProject[],
    tasks: (tasksQ.data ?? []) as DsTask[],
    commitments: (commitmentsQ.data ?? []) as DsCommitment[],
    decisions: (decisionsQ.data ?? []) as DsDecision[],
    goals: (goalsQ.data ?? []) as DsGoal[],
    activity: (activityQ.data ?? []) as DsActivity[],
    memoryConflicts: (conflictsQ.data ?? []) as DsMemoryConflict[],
  };
}