// Deterministic scheduler tick. Finds due, enabled, active automation
// definitions and enqueues jobs. Advances next_run_at server-side.
// No cron parsing yet; supports fixed intervals + manual once.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUTOMATION_LIMITS } from "@/lib/constants";
import { getJobDefinition } from "./registry.server";
import { enqueueJob } from "./queue.server";
import { writeJobEvent } from "./runtime-audit.server";

type SB = SupabaseClient<Database>;

const INTERVAL_SECONDS: Record<string, number> = {
  hourly: 3600,
  every_6_hours: 6 * 3600,
  daily: 86400,
  weekly: 7 * 86400,
  monthly: 30 * 86400,
};

function nextRunFor(mode: string, from: Date): Date | null {
  const secs = INTERVAL_SECONDS[mode];
  if (!secs) return null;
  return new Date(from.getTime() + secs * 1000);
}

export interface SchedulerTickResult {
  processed: number;
  enqueued: number;
  skipped: number;
}

export async function runSchedulerTick(supabaseAdmin: SB, batchLimit = AUTOMATION_LIMITS.maxSchedulerBatchSize): Promise<SchedulerTickResult> {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("automation_definitions")
    .select("*")
    .eq("enabled", true)
    .eq("status", "active")
    .is("deleted_at", null)
    .not("next_run_at", "is", null)
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(Math.min(batchLimit, AUTOMATION_LIMITS.maxSchedulerBatchSize));

  const rows = due ?? [];
  const result: SchedulerTickResult = { processed: 0, enqueued: 0, skipped: 0 };

  for (const def of rows) {
    result.processed += 1;
    const jobType = def.automation_key;
    try {
      getJobDefinition(jobType);
    } catch {
      result.skipped += 1;
      continue;
    }
    // Build synthetic scope from definition record (server authority only).
    try {
      await enqueueJob(supabaseAdmin, {
        organizationId: def.organization_id,
        ventureId: def.venture_id,
        role: "owner",
        userId: def.owner_id ?? def.created_by ?? def.organization_id,
        integrationConnectionId: def.integration_connection_id,
        assetId: def.asset_id,
        integrationSourceId: null,
      }, {
        jobType,
        automationDefinitionId: def.id,
        integrationConnectionId: def.integration_connection_id,
        triggerType: "scheduled",
        actorType: "scheduler",
        priority: def.priority as never,
      });
      result.enqueued += 1;
    } catch {
      result.skipped += 1;
    }
    // Advance next_run_at
    const next = nextRunFor(def.schedule_expression ?? "", new Date());
    await supabaseAdmin.rpc("automation_advance_definition", {
      _definition_id: def.id,
      _last_run_at: nowIso,
      _next_run_at: next ? next.toISOString() : new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    });
  }
  void writeJobEvent;
  return result;
}
