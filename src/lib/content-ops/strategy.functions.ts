import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CreateStrategyInput, SupersedeStrategyInput } from "./schemas";

export const createStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateStrategyInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: row, error } = await context.supabase
      .from("social_campaigns")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        name: data.name,
        objective: data.objective ?? null,
        status: "draft",
        strategy_period_start: data.strategyPeriodStart,
        strategy_period_end: data.strategyPeriodEnd,
        platform_mix: data.platformMix,
        promotion_ratio_limit: data.promotionRatioLimit ?? null,
        strategic_rationale: data.strategicRationale ?? null,
        sam_recommendation: data.samRecommendation ?? null,
        platforms: data.platforms,
        themes: data.themes,
        automation_mode: "approval_required",
        approval_policy: "human_required",
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id };
  });

export const listStrategies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("social_campaigns")
      .select("id, name, objective, status, strategy_period_start, strategy_period_end, platforms, platform_mix, promotion_ratio_limit, strategic_rationale, superseded_by, created_at")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .order("strategy_period_start", { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });

export const supersedeStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SupersedeStrategyInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { error } = await context.supabase
      .from("social_campaigns")
      .update({ superseded_by: data.replacementId, status: "archived" } as never)
      .eq("id", data.strategyId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true };
  });