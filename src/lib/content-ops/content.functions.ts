import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CreateContentItemInput } from "./schemas";
import { CONTENT_OPS_LIMITS, CONTENT_OPS_POLICY_VERSION } from "./constants";
import { buildDuplicateFingerprint } from "@/lib/social/deduplication.server";

export const createContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateContentItemInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const duplicate_fingerprint = buildDuplicateFingerprint({
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      socialAccountId: data.socialAccountId ?? null,
      campaignId: data.campaignId ?? null,
      platform: data.platform,
      title: data.title ?? null,
      body: data.body,
      hashtags: data.hashtags,
      linkUrl: data.linkUrl ?? null,
    });
    const { data: row, error } = await context.supabase
      .from("social_content_items")
      .insert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        campaign_id: data.campaignId ?? null,
        content_plan_id: data.contentPlanId ?? null,
        social_account_id: data.socialAccountId ?? null,
        platform: data.platform,
        content_type: data.contentType,
        title: data.title ?? null,
        body: data.body,
        hook: data.hook ?? null,
        cta: data.cta ?? null,
        alt_text: data.altText ?? null,
        image_prompt: data.imagePrompt ?? null,
        newsletter_subject: data.newsletterSubject ?? null,
        newsletter_preview: data.newsletterPreview ?? null,
        hashtags: data.hashtags,
        link_url: data.linkUrl ?? null,
        parent_content_item_id: data.parentContentItemId ?? null,
        learning_refs: data.learningRefs,
        media_requirements: [],
        media_status: "not_required",
        status: "draft",
        risk_band: "unknown",
        risk_reasons: [],
        automation_generated: true,
        human_reviewed: false,
        approval_status: "pending",
        content_version: 1,
        source_lineage: [],
        policy_version: CONTENT_OPS_POLICY_VERSION,
        duplicate_fingerprint,
        metadata: {},
        created_by: context.userId,
      } as never)
      .select("id, content_version")
      .single();
    if (error) throw new ContentOpsError("unknown", error.message);
    return { id: row.id, contentVersion: row.content_version };
  });

export const listContentItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    ventureId: (input as { ventureId: string }).ventureId,
    status: (input as { status?: string }).status,
    approvalStatus: (input as { approvalStatus?: string }).approvalStatus,
    limit: (input as { limit?: number }).limit,
  }))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    let q = context.supabase
      .from("social_content_items")
      .select("id, platform, content_type, title, body, hook, status, approval_status, content_version, scheduled_for, published_at, external_post_url, parent_content_item_id, created_at")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? CONTENT_OPS_LIMITS.defaultListPageSize, CONTENT_OPS_LIMITS.maxListPageSize));
    if (data.status) q = q.eq("status", data.status);
    if (data.approvalStatus) q = q.eq("approval_status", data.approvalStatus);
    const { data: rows, error } = await q;
    if (error) throw new ContentOpsError("unknown", error.message);
    return rows ?? [];
  });

export const getContentItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ({
    organizationId: (input as { organizationId: string }).organizationId,
    contentItemId: (input as { contentItemId: string }).contentItemId,
  }))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("social_content_items")
      .select("*")
      .eq("id", data.contentItemId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new ContentOpsError("unknown", error.message);
    if (!row) throw new ContentOpsError("not_found", "content item not found");
    await requireMembership(context.supabase, context.userId, row.organization_id, row.venture_id, "member");
    return row;
  });