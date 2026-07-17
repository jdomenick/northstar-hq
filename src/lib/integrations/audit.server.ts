// Sync run lifecycle helpers. Every sync must open, close, and record
// results here so integration_sync_runs is the single source of truth.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { IntegrationSyncStatus, SyncRunSummary } from "./types";
import type { IntegrationErrorCode } from "./errors";

type SB = SupabaseClient<Database>;

export interface OpenSyncRunInput {
  organizationId: string;
  connectionId: string | null;
  sourceId: string | null;
  triggeredBy: string | null;
  triggerType?: "manual" | "system";
  metadata?: Record<string, unknown>;
}

export async function openSyncRun(supabase: SB, input: OpenSyncRunInput) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("integration_sync_runs")
    .insert({
      organization_id: input.organizationId,
      connection_id: input.connectionId,
      source_id: input.sourceId,
      triggered_by: input.triggeredBy,
      trigger_type: input.triggerType ?? "manual",
      status: "running" as IntegrationSyncStatus,
      started_at: nowIso,
      metadata: input.metadata ?? {},
    })
    .select("id, started_at")
    .single();

  if (error || !data) throw error ?? new Error("failed to open sync run");
  return { id: data.id as string, startedAt: data.started_at as string };
}

export interface CloseSyncRunInput {
  runId: string;
  status: IntegrationSyncStatus;
  summary: SyncRunSummary;
  failureCode?: IntegrationErrorCode | null;
  failureMessage?: string | null;
  metadata?: Record<string, unknown>;
}

export async function closeSyncRun(supabase: SB, input: CloseSyncRunInput) {
  const completedAt = new Date().toISOString();
  await supabase
    .from("integration_sync_runs")
    .update({
      status: input.status,
      completed_at: completedAt,
      duration_ms: input.summary.durationMs,
      records_discovered: input.summary.discovered,
      records_created: input.summary.created,
      records_updated: input.summary.updated,
      records_skipped: input.summary.skipped,
      records_failed: input.summary.failed,
      failure_code: input.failureCode ?? null,
      failure_message: input.failureMessage ?? null,
      metadata: input.metadata ?? {},
    })
    .eq("id", input.runId);
}

// Update the connection's last-sync bookkeeping after a run closes.
export async function stampConnectionSync(
  supabase: SB,
  connectionId: string,
  opts: { successful: boolean; errorCode?: IntegrationErrorCode | null; nextCursor?: unknown },
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_sync_at: now };
  if (opts.successful) {
    patch.last_successful_sync_at = now;
    patch.status = "active";
    patch.last_error_code = null;
    patch.last_error_at = null;
  } else if (opts.errorCode) {
    patch.status = "error";
    patch.last_error_code = opts.errorCode;
    patch.last_error_at = now;
  }
  if (opts.nextCursor !== undefined) patch.next_cursor = opts.nextCursor;
  await supabase.from("integration_connections").update(patch).eq("id", connectionId);
}

export async function stampSourceSync(
  supabase: SB,
  sourceId: string,
  successful: boolean,
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { last_synced_at: now };
  await supabase.from("integration_sources").update(patch).eq("id", sourceId);
  void successful; // reserved for future per-source failure bookkeeping
}