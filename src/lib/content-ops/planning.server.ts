// Deterministic planning engine. Turns a strategy + brand profile into a
// balanced list of planned slots with pillar and promotion-ratio constraints.
// LLM-free: the caller may later call structured generation for each slot.

import { CONTENT_OPS_LIMITS, CONTENT_OPS_PLANNING_VERSION } from "./constants";
import type { ContentPillar } from "./schemas";

export interface PlanningSlot {
  index: number;
  scheduledFor: string;
  platform: string;
  pillarId: string;
  isPromotional: boolean;
  rationale: string;
}

export interface PlanningInput {
  strategyPeriodStart: string;
  strategyPeriodEnd: string;
  platformMix: Record<string, number>;
  promotionRatioLimit: number | null;
  pillars: ContentPillar[];
  postingCadencePerWeek: Record<string, number>;
}

export interface PlanningOutput {
  engineVersion: string;
  slots: PlanningSlot[];
  notes: string[];
}

export function planContentCalendar(input: PlanningInput): PlanningOutput {
  const notes: string[] = [];
  const slots: PlanningSlot[] = [];
  const start = new Date(input.strategyPeriodStart);
  const end = new Date(input.strategyPeriodEnd);
  if (!(end.getTime() > start.getTime())) {
    return { engineVersion: CONTENT_OPS_PLANNING_VERSION, slots: [], notes: ["invalid_period"] };
  }
  const days = Math.min(
    Math.ceil((end.getTime() - start.getTime()) / 86_400_000),
    CONTENT_OPS_LIMITS.maxStrategyHorizonDays,
  );

  const pillars = input.pillars.length > 0 ? input.pillars : [{ id: "general", name: "General" } as ContentPillar];
  const platforms = Object.keys(input.platformMix).length > 0 ? Object.keys(input.platformMix) : ["beehiiv"];
  const promoLimit = input.promotionRatioLimit ?? 0.2;

  let idx = 0;
  let promoCount = 0;
  const perWeekTotal = Object.values(input.postingCadencePerWeek).reduce((a, b) => a + b, 0) || platforms.length * 3;
  const perDay = Math.max(1, Math.round(perWeekTotal / 7));

  for (let d = 0; d < days && slots.length < CONTENT_OPS_LIMITS.maxPlannedItemsPerRun; d++) {
    for (let slot = 0; slot < perDay && slots.length < CONTENT_OPS_LIMITS.maxPlannedItemsPerRun; slot++) {
      const platform = platforms[idx % platforms.length];
      const pillar = pillars[idx % pillars.length];
      const projectedPromo = (promoCount + 1) / (slots.length + 1);
      const isPromotional = projectedPromo <= promoLimit && idx % 5 === 4;
      if (isPromotional) promoCount += 1;
      const when = new Date(start.getTime() + d * 86_400_000 + slot * 3 * 3600_000);
      slots.push({
        index: idx,
        scheduledFor: when.toISOString(),
        platform,
        pillarId: pillar.id,
        isPromotional,
        rationale: `pillar=${pillar.id}; platform=${platform}; promo_ratio<=${promoLimit}`,
      });
      idx += 1;
    }
  }

  const actualPromoRatio = slots.length > 0 ? promoCount / slots.length : 0;
  if (actualPromoRatio > promoLimit) {
    notes.push(`promotion_ratio_${actualPromoRatio.toFixed(2)}_exceeds_limit_${promoLimit}`);
  }
  return { engineVersion: CONTENT_OPS_PLANNING_VERSION, slots, notes };
}