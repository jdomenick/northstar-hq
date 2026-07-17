// Duplicate-run protection. Blocks concurrent pending/running runs for the
// same (org, user, workflow_type, venture, date range) tuple within a
// bounded time window. Best-effort server-side check — race window exists;
// documented limitation.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SamError } from "@/lib/errors";
import { SAM_WORKFLOW_LIMITS } from "@/lib/constants";
import type { WorkflowType } from "./types";

type Client = SupabaseClient<Database>;

export interface DuplicateCheckInput {
  orgId: string;
  userId: string;
  workflowType: WorkflowType;
  ventureId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export async function assertNoDuplicateActive(
  supabase: Client,
  input: DuplicateCheckInput,
): Promise<void> {
  const windowStart = new Date(
    Date.now() - SAM_WORKFLOW_LIMITS.duplicateWindowMinutes * 60 * 1000,
  ).toISOString();

  let q = supabase
    .from("sam_workflow_runs")
    .select("id, venture_id, period_start, period_end")
    .eq("organization_id", input.orgId)
    .eq("initiated_by", input.userId)
    .eq("workflow_type", input.workflowType)
    .in("status", ["pending", "running"])
    .gte("started_at", windowStart);
  if (input.ventureId) q = q.eq("venture_id", input.ventureId);
  else q = q.is("venture_id", null);

  const { data, error } = await q;
  if (error) throw new SamError("workflow_persistence_failed", error.message);
  const match = (data ?? []).find(
    (r) =>
      (r.period_start ?? null) === input.periodStart &&
      (r.period_end ?? null) === input.periodEnd,
  );
  if (match) throw new SamError("workflow_already_running");
}