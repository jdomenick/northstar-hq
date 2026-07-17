// Deterministic memory precedence  -  Phase 3B (ADR-0011).
// Lower rank = higher precedence.
import { MEMORY_PRECEDENCE_VERSION } from "@/lib/constants";
import type { MemoryItemRow, MemoryLayer, MemoryStatus } from "./schema";

export { MEMORY_PRECEDENCE_VERSION };

const STATUS_RANK: Record<MemoryStatus, number> = {
  confirmed: 0,
  disputed: 2,
  proposed: 3,
  outdated: 4,
  superseded: 5,
  archived: 6,
};

const LAYER_SPECIFICITY: Record<MemoryLayer, number> = {
  // more specific → smaller number
  preference: 0,
  founder: 1,
  venture: 2,
  operational: 3,
  organization: 4,
  historical: 5,
};

export interface RankedMemory {
  item: MemoryItemRow;
  rank: number;
  effectiveConfidence: number;
  reasons: string[];
  expired: boolean;
}

function ageDays(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function rankMemory(
  items: MemoryItemRow[],
  ctx: { ventureId?: string | null; userId: string },
): RankedMemory[] {
  const now = Date.now();
  return items
    .map((item) => {
      const reasons: string[] = [];
      const expired = item.expires_at ? new Date(item.expires_at).getTime() < now : false;
      const statusRank = STATUS_RANK[item.status as MemoryStatus] ?? 9;
      const specificity = LAYER_SPECIFICITY[item.layer as MemoryLayer] ?? 5;
      const scopeBoost =
        ctx.ventureId && item.venture_id === ctx.ventureId ? -1 : 0;
      const personalBoost =
        (item.layer === "founder" || item.layer === "preference") &&
        item.owner_user_id === ctx.userId
          ? -1
          : 0;

      const staleness = ageDays(item.last_confirmed_at ?? item.updated_at);
      const stalenessPenalty = staleness > 180 ? 1 : staleness > 90 ? 0.5 : 0;
      if (stalenessPenalty) reasons.push(`Not reconfirmed in ${Math.round(staleness)}d`);

      const rank =
        statusRank * 10 + specificity + scopeBoost + personalBoost + stalenessPenalty;

      // Effective confidence: applies decay (see decay.ts) at read time.
      let effectiveConfidence = item.confidence_score ?? 0.5;
      if (expired) {
        effectiveConfidence = Math.min(effectiveConfidence, 0.2);
        reasons.push("Expired");
      } else if (staleness > 180) {
        effectiveConfidence *= 0.6;
      } else if (staleness > 90) {
        effectiveConfidence *= 0.85;
      }

      return { item, rank, effectiveConfidence, reasons, expired };
    })
    .sort((a, b) => a.rank - b.rank);
}