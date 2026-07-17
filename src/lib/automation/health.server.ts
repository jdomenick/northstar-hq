// Deterministic automation health calc + definition timestamp advancement.
// No provider input. Uses guarded UPDATE so an older completion never
// overwrites a newer last-success timestamp.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { AutomationHealthBand } from "@/lib/constants";

type SB = SupabaseClient<Database>;

const HEALTH_LOOKBACK_JOBS = 20;

export async function recordJobOutcome(
  supabase: SB,
  args: {
    organizationId: string;
    automationDefinitionId: string | null;
    ventureId: string | null;
    completedAtIso: string;
    outcome: "succeeded" | "failed" | "retryable_failure";
  },
): Promise<void> {
  if (!args.automationDefinitionId) return;
  const { data: def } = await supabase
    .from("automation_definitions")
    .select("last_success_at, last_failure_at, consecutive_failures")
    .eq("id", args.automationDefinitionId)
    .maybeSingle();
  if (!def) return;

  if (args.outcome === "succeeded") {
    const prevSuccess = def.last_success_at ? new Date(def.last_success_at).getTime() : 0;
    if (new Date(args.completedAtIso).getTime() < prevSuccess) return;
    await supabase
      .from("automation_definitions")
      .update({
        last_run_at: args.completedAtIso,
        last_success_at: args.completedAtIso,
        consecutive_failures: 0,
      })
      .eq("id", args.automationDefinitionId);
  } else if (args.outcome === "failed") {
    const prevFail = def.last_failure_at ? new Date(def.last_failure_at).getTime() : 0;
    if (new Date(args.completedAtIso).getTime() < prevFail) return;
    await supabase
      .from("automation_definitions")
      .update({
        last_run_at: args.completedAtIso,
        last_failure_at: args.completedAtIso,
        consecutive_failures: (def.consecutive_failures ?? 0) + 1,
      })
      .eq("id", args.automationDefinitionId);
  }
}

export async function recalculateHealth(
  supabase: SB,
  args: { organizationId: string; automationDefinitionId: string | null; ventureId: string | null },
): Promise<{ score: number; band: AutomationHealthBand }> {
  let q = supabase
    .from("automation_jobs")
    .select("status, error_code, completed_at")
    .eq("organization_id", args.organizationId)
    .order("completed_at", { ascending: false })
    .limit(HEALTH_LOOKBACK_JOBS);
  if (args.automationDefinitionId) q = q.eq("automation_definition_id", args.automationDefinitionId);
  if (args.ventureId) q = q.eq("venture_id", args.ventureId);
  const { data: rows } = await q;
  const jobs = rows ?? [];
  const terminal = jobs.filter((j) =>
    ["succeeded", "failed", "cancelled", "expired"].includes(j.status as string),
  );
  const success = terminal.filter((j) => j.status === "succeeded").length;
  const total = terminal.length || 1;
  const successRate = success / total;
  let consecutive = 0;
  for (const j of terminal) {
    if (j.status === "succeeded") break;
    if (j.status === "failed" || j.status === "expired") consecutive += 1;
    else break;
  }
  let score = Math.round(successRate * 100);
  if (consecutive >= 3) score = Math.min(score, 30);
  else if (consecutive >= 1) score = Math.min(score, 60);
  let band: AutomationHealthBand;
  if (terminal.length === 0) band = "unknown";
  else if (score >= 90) band = "healthy";
  else if (score >= 70) band = "watch";
  else if (score >= 40) band = "degraded";
  else band = "critical";

  const breakdown = {
    success_rate: Number(successRate.toFixed(3)),
    consecutive_failures: consecutive,
    sample_size: terminal.length,
    lookback: HEALTH_LOOKBACK_JOBS,
  };
  await supabase.from("automation_health_snapshots").insert({
    organization_id: args.organizationId,
    venture_id: args.ventureId,
    automation_definition_id: args.automationDefinitionId,
    health_score: score,
    health_band: band,
    signal_breakdown: breakdown as unknown as Json,
    version: "v1",
  });
  return { score, band };
}
