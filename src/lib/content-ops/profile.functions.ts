import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { UpdateBrandProfileExtensionsInput } from "./schemas";

export const getBrandProfileExtensions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const { data: rows, error } = await context.supabase
      .from("venture_brand_profiles")
      .select(
        "id, version, status, brand_name, content_pillars, audience_segments, promotion_ratio_limit, posting_cadence, preferred_posting_windows, faith_language_policy, crisis_language_rules, sensitive_topic_guidance, competitor_references, visual_identity, required_disclaimers, prohibited_claims, prohibited_topics",
      )
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .eq("status", "active")
      .order("version", { ascending: false })
      .limit(1);
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows?.[0] ?? null;
  });

export const updateBrandProfileExtensions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateBrandProfileExtensionsInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const patch: Record<string, unknown> = {};
    if (data.contentPillars) patch.content_pillars = data.contentPillars;
    if (data.audienceSegments) patch.audience_segments = data.audienceSegments;
    if (data.promotionRatioLimit !== undefined) patch.promotion_ratio_limit = data.promotionRatioLimit;
    if (data.postingCadence) patch.posting_cadence = data.postingCadence;
    if (data.preferredPostingWindows) patch.preferred_posting_windows = data.preferredPostingWindows;
    if (data.faithLanguagePolicy) patch.faith_language_policy = data.faithLanguagePolicy;
    if (data.crisisLanguageRules) patch.crisis_language_rules = data.crisisLanguageRules;
    if (data.sensitiveTopicGuidance) patch.sensitive_topic_guidance = data.sensitiveTopicGuidance;
    if (data.competitorReferences) patch.competitor_references = data.competitorReferences;
    if (data.visualIdentity) patch.visual_identity = data.visualIdentity;
    if (Object.keys(patch).length === 0) return { ok: true, changed: false };
    const { error } = await context.supabase
      .from("venture_brand_profiles")
      .update(patch as never)
      .eq("id", data.brandProfileId)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId);
    if (error) throw new ContentOpsError("unknown", error.message);
    return { ok: true, changed: true };
  });