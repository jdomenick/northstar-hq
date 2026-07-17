// Stale-job recovery. Invokes DB RPC (SECURITY DEFINER, service_role only).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { AUTOMATION_LIMITS } from "@/lib/constants";
import { writeJobEvent } from "./runtime-audit.server";

type SB = SupabaseClient<Database>;

export async function recoverStaleJobs(supabaseAdmin: SB, limit = AUTOMATION_LIMITS.maxStaleRecoveryBatch): Promise<{ recovered: number }> {
  const { data, error } = await supabaseAdmin.rpc("automation_recover_stale_jobs", {
    _limit: Math.min(limit, AUTOMATION_LIMITS.maxStaleRecoveryBatch),
  });
  if (error) return { recovered: 0 };
  const rows = (data as unknown as Array<{ id: string; organization_id: string; attempt_number: number }>) ?? [];
  for (const r of rows) {
    await writeJobEvent(supabaseAdmin, {
      organizationId: r.organization_id,
      jobId: r.id,
      event: "job_recovered",
      attemptNumber: r.attempt_number,
      actorType: "system",
      discriminator: String(Date.now()),
      metadata: { extra: { reason: "lease_expired" } },
    });
  }
  return { recovered: rows.length };
}
