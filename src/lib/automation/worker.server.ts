// Worker loop. Uses service_role. Repeatedly claims one job atomically
// via automation_claim_next_job and runs it, bounded by batch limit.

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUTOMATION_LIMITS } from "@/lib/constants";
import { executeClaimedJob } from "./runner.server";

type SB = SupabaseClient<Database>;

export interface WorkerTickResult {
  workerId: string;
  processed: number;
  succeeded: number;
  failed: number;
  retrying: number;
}

export async function runWorkerTick(
  supabaseAdmin: SB,
  opts: { batchLimit?: number; leaseSeconds?: number } = {},
): Promise<WorkerTickResult> {
  const workerId = `w-${randomUUID()}`;
  const batchLimit = Math.min(opts.batchLimit ?? 5, AUTOMATION_LIMITS.maxSchedulerBatchSize);
  const leaseSeconds = Math.min(opts.leaseSeconds ?? 600, AUTOMATION_LIMITS.maxTimeoutSeconds);
  const result: WorkerTickResult = { workerId, processed: 0, succeeded: 0, failed: 0, retrying: 0 };

  for (let i = 0; i < batchLimit; i++) {
    const { data: rows, error } = await supabaseAdmin.rpc("automation_claim_next_job", {
      _worker_id: workerId,
      _lease_seconds: leaseSeconds,
    });
    if (error) break;
    const job = Array.isArray(rows) ? rows[0] : null;
    if (!job) break;
    try {
      const outcome = await executeClaimedJob(supabaseAdmin, job as never, workerId);
      result.processed += 1;
      if (outcome.status === "succeeded") result.succeeded += 1;
      else if (outcome.status === "retrying") result.retrying += 1;
      else result.failed += 1;
    } catch {
      result.processed += 1;
      result.failed += 1;
    }
  }
  return result;
}
