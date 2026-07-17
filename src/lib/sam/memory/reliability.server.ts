// Historical reliability service — computes a rolling reliability score
// for a memory item (or memory items in aggregate) from the historical
// feedback + version + status trail. Read-only helper; does not mutate
// the memory row so background jobs can call it as often as they want.
//
// Reliability signal blends:
//   - accurate vs inaccurate / outdated / disputed feedback ratio
//   - user confirmations (last_confirmed_at) vs age since update
//   - version churn (high churn ⇒ lower reliability)
//   - status penalty for disputed / outdated
//
// Bounded to O(1) SQL per item. See docs/sam/07-learning.md.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { bandForScore } from "./schema";

type FeedbackType = Database["public"]["Enums"]["sam_feedback_type"];

export interface MemoryReliability {
  memoryItemId: string;
  score: number;               // 0..1
  band: "low" | "moderate" | "high" | "very_high";
  feedbackCounts: Record<FeedbackType, number>;
  versionCount: number;
  ageDays: number;
  daysSinceConfirmed: number | null;
  notes: string[];
  computedAt: string;
}

const NEG: readonly FeedbackType[] = ["inaccurate", "outdated", "disputed"];
const POS: readonly FeedbackType[] = ["accurate"];

function daysBetween(a: string | null | undefined, b: Date) {
  if (!a) return null;
  const t = new Date(a).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (b.getTime() - t) / 86_400_000);
}

export async function computeMemoryReliability(
  supabase: SupabaseClient<Database>,
  orgId: string,
  memoryItemId: string,
): Promise<MemoryReliability | null> {
  const [{ data: item }, { data: feedback }, { count: versionCount }] = await Promise.all([
    supabase
      .from("sam_memory_items")
      .select("id, status, updated_at, created_at, last_confirmed_at, confidence_score")
      .eq("organization_id", orgId)
      .eq("id", memoryItemId)
      .maybeSingle(),
    supabase
      .from("sam_memory_feedback")
      .select("feedback_type")
      .eq("organization_id", orgId)
      .eq("memory_item_id", memoryItemId)
      .limit(500),
    supabase
      .from("sam_memory_versions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("memory_item_id", memoryItemId),
  ]);

  if (!item) return null;

  const now = new Date();
  const counts: Record<FeedbackType, number> = {
    accurate: 0,
    inaccurate: 0,
    incomplete: 0,
    outdated: 0,
    disputed: 0,
  };
  for (const f of feedback ?? []) counts[f.feedback_type as FeedbackType]++;

  const pos = POS.reduce((s, k) => s + counts[k], 0);
  const neg = NEG.reduce((s, k) => s + counts[k], 0);
  const total = pos + neg;
  const feedbackRatio = total === 0 ? 0.5 : pos / total; // neutral prior at 0.5

  const ageDays = daysBetween(item.created_at, now) ?? 0;
  const daysSinceConfirmed = daysBetween(item.last_confirmed_at, now);

  const notes: string[] = [];

  // Base blends the stored score (or 0.5) with feedback ratio.
  const baseline = item.confidence_score ?? 0.5;
  let score = 0.55 * baseline + 0.45 * feedbackRatio;

  // Version churn: >3 revisions drags reliability down a little.
  const vc = versionCount ?? 0;
  if (vc > 3) {
    score -= Math.min(0.15, (vc - 3) * 0.03);
    notes.push(`version_churn:${vc}`);
  }

  // Stale confirmation penalty.
  if (daysSinceConfirmed !== null && daysSinceConfirmed > 90) {
    score -= Math.min(0.15, ((daysSinceConfirmed - 90) / 180) * 0.15);
    notes.push(`stale_confirmation:${Math.round(daysSinceConfirmed)}d`);
  }

  // Status penalties.
  if (item.status === "disputed") { score -= 0.2; notes.push("status:disputed"); }
  if (item.status === "outdated") { score -= 0.25; notes.push("status:outdated"); }
  if (item.status === "superseded") { score -= 0.4; notes.push("status:superseded"); }
  if (item.status === "confirmed") { score += 0.05; notes.push("status:confirmed"); }

  score = Math.max(0, Math.min(1, score));

  return {
    memoryItemId,
    score,
    band: bandForScore(score),
    feedbackCounts: counts,
    versionCount: vc,
    ageDays,
    daysSinceConfirmed,
    notes,
    computedAt: now.toISOString(),
  };
}