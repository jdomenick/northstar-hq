// Server-side activity logger for SAM operations. Uses the authenticated
// Supabase client from the operation dispatcher (RLS as the operator), so
// every operation - success, blocked, or failed - leaves a row in
// activity_events for The Brief, the org activity stream, and audit review.
//
// Never throws. Never blocks the caller. Never records payloads that could
// leak secrets - only the operation name, status, affected records, and
// summary that already round-trips to the UI.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { OperationResult } from "./types";

const ACTION_PREFIX = "sam.operation.";

export async function logSamOperation(
  supabase: SupabaseClient<Database>,
  actorUserId: string,
  result: OperationResult,
): Promise<void> {
  if (!result?.organizationId) return;
  const primary = result.affectedRecords[0];
  const metadata: Record<string, unknown> = {
    operation: result.operation,
    version: result.version,
    status: result.status,
    durationMs: result.durationMs,
    affectedCount: result.affectedRecords.length,
    affected: result.affectedRecords.slice(0, 10).map((r) => ({
      entityType: r.entityType, id: r.id,
    })),
  };
  if (result.status === "blocked") {
    metadata.reasonCode = result.reasonCode;
    if (result.actionRoute) metadata.actionRoute = result.actionRoute;
  } else if (result.status === "failed") {
    metadata.reasonCode = result.reasonCode;
  } else if (result.status === "ambiguous") {
    metadata.candidateCount = result.candidates.length;
  }

  try {
    await supabase.from("activity_events").insert({
      organization_id: result.organizationId,
      venture_id: result.ventureId ?? null,
      actor_user_id: actorUserId,
      action: `${ACTION_PREFIX}${result.operation}.${result.status}`,
      summary: result.summary.slice(0, 500),
      entity_type: primary?.entityType ?? null,
      entity_id: primary?.id ?? null,
      metadata: (JSON.parse(JSON.stringify(metadata)) as Json) ?? null,
    });
  } catch {
    // Activity is best-effort. Never propagate failures to the caller.
  }
}