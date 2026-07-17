// Sync run lifecycle helpers. Every sync must open, close, and record
// results here so integration_sync_runs is the single source of truth.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { IntegrationSyncStatus, SyncRunSummary } from "./types";
import type { IntegrationErrorCode } from "./errors";

type SB = SupabaseClient<Database>;

function toJson(value: Record<string, unknown> | undefined): Json {
  return (value ?? {}) as unknown as Json;
}

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
      metadata: toJson(input.metadata),
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
      metadata: toJson(input.metadata),
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
  const base = { last_sync_at: now } as const;
  if (opts.successful) {
    await supabase
      .from("integration_connections")
      .update({
        ...base,
        last_successful_sync_at: now,
        status: "active",
        last_error_code: null,
        last_error_at: null,
        ...(opts.nextCursor !== undefined ? { next_cursor: opts.nextCursor as Json } : {}),
      })
      .eq("id", connectionId);
  } else if (opts.errorCode) {
    await supabase
      .from("integration_connections")
      .update({
        ...base,
        status: "error",
        last_error_code: opts.errorCode,
        last_error_at: now,
        ...(opts.nextCursor !== undefined ? { next_cursor: opts.nextCursor as Json } : {}),
      })
      .eq("id", connectionId);
  } else {
    await supabase
      .from("integration_connections")
      .update({
        ...base,
        ...(opts.nextCursor !== undefined ? { next_cursor: opts.nextCursor as Json } : {}),
      })
      .eq("id", connectionId);
  }
}

export async function stampSourceSync(
  supabase: SB,
  sourceId: string,
  successful: boolean,
) {
  const now = new Date().toISOString();
  await supabase.from("integration_sources").update({ last_synced_at: now }).eq("id", sourceId);
  void successful; // reserved for future per-source failure bookkeeping
}