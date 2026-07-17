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
  entityId?: string | null;
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
    .select("id, venture_id, period_start, period_end, input_snapshot")
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
    (r) => {
      const sameRange =
        (r.period_start ?? null) === input.periodStart &&
        (r.period_end ?? null) === input.periodEnd;
      const snap = (r.input_snapshot ?? {}) as Record<string, unknown>;
      const sameEntity = (snap.entityId ?? null) === (input.entityId ?? null);
      return sameRange && sameEntity;
    },
  );
  if (match) throw new SamError("workflow_already_running");
}

// Map a Postgres unique-violation from the partial unique index (see
// migration 20260717…workflow_active_scope_key) onto a workflow error.
export function isDuplicateActiveError(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string } | null;
  if (!anyErr) return false;
  if (anyErr.code === "23505") return true;
  return typeof anyErr.message === "string" && /sam_workflow_runs_active_scope_key/.test(anyErr.message);
}