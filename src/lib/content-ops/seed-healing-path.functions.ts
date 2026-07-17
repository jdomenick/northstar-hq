// Idempotent, org-scoped Healing Path venture profile seed.
//
// This server function is the ONLY place any "Healing Path" specific
// values live. Shared application code (planner, editor, adapters, gates)
// stays generic and reads whatever is on the venture's brand profile.
//
// Idempotency: keyed by (organization_id, venture_id, brand_name).
// Re-running is safe - existing rows are updated in place, no new
// version row is created, no snapshot spam. Executive+ only.

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";

const HEALING_PATH_BRAND_NAME = "Healing Path";

// Editable defaults. Real ongoing edits go through
// `updateBrandProfileExtensions`; this function only writes when the row
// does not yet contain each field.
const HEALING_PATH_DEFAULTS = {
  contentPillars: [
    { id: "trauma-education", name: "Trauma education", ratio: 0.25,
      description: "Plain-language explanations of trauma, nervous system, and healing." },
    { id: "survival-patterns", name: "Survival patterns", ratio: 0.2,
      description: "How coping patterns form and how to work with them safely." },
    { id: "healing-practice", name: "Healing practice", ratio: 0.2,
      description: "Concrete, small practices readers can try today." },
    { id: "faith-and-integration", name: "Faith and integration", ratio: 0.15,
      description: "Bridging faith and trauma-informed care with respect for both." },
    { id: "community-and-story", name: "Community and story", ratio: 0.1,
      description: "Reader stories, guest voices, community reflections." },
    { id: "offers", name: "Offers", ratio: 0.1,
      description: "Programs, courses, and services. Capped by promotion ratio." },
  ],
  promotionRatioLimit: 0.15,
  voiceAttributes: ["warm", "clinically grounded", "plainspoken", "unhurried"],
  toneAttributes: ["compassionate", "steady", "hopeful without denial"],
  approvedCallsToAction: [
    "Read the full letter",
    "Reply and tell us what landed",
    "Share with someone who needs it today",
  ],
  prohibitedClaims: [
    "cure", "guaranteed healing", "instant results",
    "replaces therapy", "replaces medical care",
  ],
  prohibitedTopics: ["diagnosis of specific readers", "medication recommendations"],
  restrictedTopics: ["active crisis language", "suicide", "self-harm"],
  crisisKeywords: [
    "suicide", "kill myself", "self harm", "self-harm", "want to die",
    "abuse right now", "in danger",
  ],
  emojiPolicy: "sparingly" as const,
  profanityPolicy: "strict" as const,
};

export const seedHealingPathProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ organizationId: z.string().uuid(), ventureId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireMembership(
      context.supabase, context.userId, data.organizationId, data.ventureId, "executive",
    );

    // Look up an existing Healing Path profile for this venture.
    const { data: existingRows, error: findErr } = await context.supabase
      .from("venture_brand_profiles")
      .select("id, version, status, content_pillars, promotion_ratio_limit, voice_attributes, tone_attributes, approved_calls_to_action, prohibited_claims, prohibited_topics, restricted_topics, crisis_keywords, emoji_policy, profanity_policy")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .eq("brand_name", HEALING_PATH_BRAND_NAME)
      .order("version", { ascending: false })
      .limit(1);
    if (findErr) throw new ContentOpsError("unknown", findErr.message);

    const existing = existingRows?.[0] ?? null;

    if (existing) {
      // Only fill fields that are still empty/null. Never clobber user edits.
      const patch: Record<string, unknown> = {};
      const arr = (v: unknown) => Array.isArray(v) && v.length > 0;
      if (!arr(existing.content_pillars)) patch.content_pillars = HEALING_PATH_DEFAULTS.contentPillars;
      if (existing.promotion_ratio_limit == null) patch.promotion_ratio_limit = HEALING_PATH_DEFAULTS.promotionRatioLimit;
      if (!arr(existing.voice_attributes)) patch.voice_attributes = HEALING_PATH_DEFAULTS.voiceAttributes;
      if (!arr(existing.tone_attributes)) patch.tone_attributes = HEALING_PATH_DEFAULTS.toneAttributes;
      if (!arr(existing.approved_calls_to_action)) patch.approved_calls_to_action = HEALING_PATH_DEFAULTS.approvedCallsToAction;
      if (!arr(existing.prohibited_claims)) patch.prohibited_claims = HEALING_PATH_DEFAULTS.prohibitedClaims;
      if (!arr(existing.prohibited_topics)) patch.prohibited_topics = HEALING_PATH_DEFAULTS.prohibitedTopics;
      if (!arr(existing.restricted_topics)) patch.restricted_topics = HEALING_PATH_DEFAULTS.restrictedTopics;
      if (!arr(existing.crisis_keywords)) patch.crisis_keywords = HEALING_PATH_DEFAULTS.crisisKeywords;
      if (!existing.emoji_policy) patch.emoji_policy = HEALING_PATH_DEFAULTS.emojiPolicy;
      if (!existing.profanity_policy) patch.profanity_policy = HEALING_PATH_DEFAULTS.profanityPolicy;

      if (Object.keys(patch).length === 0) {
        return { ok: true, action: "unchanged" as const, brandProfileId: existing.id };
      }
      const { error: updErr } = await context.supabase
        .from("venture_brand_profiles")
        .update(patch as never)
        .eq("id", existing.id);
      if (updErr) throw new ContentOpsError("unknown", updErr.message);
      return { ok: true, action: "filled_defaults" as const, brandProfileId: existing.id };
    }

    // Insert a fresh draft profile. Status stays 'draft' - approval and
    // activation are separate operator actions, not auto-granted by seed.
    const insertPayload = {
      organization_id: data.organizationId,
      venture_id: data.ventureId,
      brand_name: HEALING_PATH_BRAND_NAME,
      version: 1,
      status: "draft" as const,
      content_pillars: HEALING_PATH_DEFAULTS.contentPillars,
      promotion_ratio_limit: HEALING_PATH_DEFAULTS.promotionRatioLimit,
      voice_attributes: HEALING_PATH_DEFAULTS.voiceAttributes,
      tone_attributes: HEALING_PATH_DEFAULTS.toneAttributes,
      approved_calls_to_action: HEALING_PATH_DEFAULTS.approvedCallsToAction,
      prohibited_claims: HEALING_PATH_DEFAULTS.prohibitedClaims,
      prohibited_topics: HEALING_PATH_DEFAULTS.prohibitedTopics,
      restricted_topics: HEALING_PATH_DEFAULTS.restrictedTopics,
      crisis_keywords: HEALING_PATH_DEFAULTS.crisisKeywords,
      emoji_policy: HEALING_PATH_DEFAULTS.emojiPolicy,
      profanity_policy: HEALING_PATH_DEFAULTS.profanityPolicy,
      created_by: context.userId,
    };
    const { data: created, error: insErr } = await context.supabase
      .from("venture_brand_profiles")
      .insert(insertPayload as never)
      .select("id")
      .single();
    if (insErr) throw new ContentOpsError("unknown", insErr.message);
    return { ok: true, action: "created" as const, brandProfileId: created.id };
  });