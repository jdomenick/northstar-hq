// Server-only implementations for SAM Content Operations.
//
// Each op receives a normalized context (authenticated Supabase client,
// userId) plus a Zod-validated payload (schemas live in ./schemas so tests
// can import them without dragging server-only deps in). It returns a typed
// OperationResult - never a bare success from intent alone. All mutations
// go through the existing content-ops server functions, which already run
// requireMembership, validation, and audit writes, so authorization, RLS,
// and org isolation are enforced consistently.
//
// Ops that need a working publishing connector (publish, retry) return
// truthful `blocked` results derived from the static social registry -
// never fake provider output.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

import { blocked, failed, fromThrown, success } from "./result-builders";
import type { AffectedRecord, OperationResult, SamOperationName } from "./types";
import { resolveConnectorStatus, platformDisplayName } from "./connector-status";
import { generateRewrite, type RewriteStyle } from "./ai-rewrite.server";
import {
  type CreateSocialPlanInput as CreateSocialPlanInputT,
  type CreatePlatformVariantsInput as CreatePlatformVariantsInputT,
  type EditVariantInput as EditVariantInputT,
  type ApprovalRefInput as ApprovalRefInputT,
  type RejectVariantInput as RejectVariantInputT,
  type RequestRevisionInput as RequestRevisionInputT,
  type ApproveBatchInput as ApproveBatchInputT,
  type ScheduleVariantOpInput as ScheduleVariantOpInputT,
  type UnscheduleOpInput as UnscheduleOpInputT,
  type ScheduleBatchOpInput as ScheduleBatchOpInputT,
  type PauseOpInput as PauseOpInputT,
  type ResumeOpInput as ResumeOpInputT,
  type AttachAssetInput as AttachAssetInputT,
  type DetachAssetInput as DetachAssetInputT,
  type ListDestinationsInput as ListDestinationsInputT,
  type ExplainBlockedInput as ExplainBlockedInputT,
  type PublishOpInput as PublishOpInputT,
  type RetrieveApprovalQueueInput as RetrieveApprovalQueueInputT,
  type RetrieveScheduledContentInput as RetrieveScheduledContentInputT,
  type RetrievePublicationStatusInput as RetrievePublicationStatusInputT,
  type RetrievePerformanceInput as RetrievePerformanceInputT,
  type RetrieveLearningsInput as RetrieveLearningsInputT,
  type RecommendNextPlanInput as RecommendNextPlanInputT,
  type ValidateSocialConnectionInput as ValidateSocialConnectionInputT,
  type SuggestCreativeBriefInput as SuggestCreativeBriefInputT,
} from "./schemas";
export * from "./schemas";

import { createStrategy } from "@/lib/content-ops/strategy.functions";
import { createVariant, saveVariant, submitForApproval, requestRevision } from "@/lib/content-ops/editor.functions";
import { approveContentItem, rejectContentItem, batchApprove } from "@/lib/content-ops/approvals.functions";
import { scheduleVariant, rescheduleVariant, unscheduleVariant, cancelPublication, batchScheduleVariants } from "@/lib/content-ops/scheduling.functions";
import { triggerEmergencyPause, clearEmergencyPause } from "@/lib/content-ops/autonomy.functions";
import { attachMedia, detachMedia } from "@/lib/content-ops/media.functions";
import { planContentCalendar } from "@/lib/content-ops/planning.server";
import { SOCIAL_PLATFORMS } from "@/lib/constants";
import { getSocialPlatform } from "@/lib/social/registry.server";
import { getPlatformConfig } from "@/lib/content-ops/platform-registry";

/* --------------------------------------------------------------------------
 * Context + helpers
 * ------------------------------------------------------------------------ */

export interface OpContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

function base(
  operation: SamOperationName,
  organizationId: string,
  ventureId: string | null,
  userId: string,
  startedAt: number,
  affectedRecords: AffectedRecord[] = [],
) {
  return { operation, organizationId, ventureId, actorUserId: userId, startedAt, affectedRecords };
}

const editorHref = (id: string) => `/content-ops/editor/${id}`;

async function loadVariantForEdit(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contentItemId: string,
) {
  const { data, error } = await supabase
    .from("social_content_items")
    .select("id, organization_id, venture_id, platform, content_type, title, hook, body, cta, hashtags, mentions, link_url, first_comment, alt_text, newsletter_subject, newsletter_preview, metadata")
    .eq("id", contentItemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { ok: false as const, reason: "server_error" as const, message: error.message };
  if (!data) return { ok: false as const, reason: "not_found" as const, message: "variant not found" };
  return { ok: true as const, row: data as unknown as {
    id: string; organization_id: string; venture_id: string; platform: string;
    content_type: string; title: string | null; hook: string | null; body: string;
    cta: string | null; hashtags: string[] | null; mentions: string[] | null;
    link_url: string | null; first_comment: string | null; alt_text: string | null;
    newsletter_subject: string | null; newsletter_preview: string | null;
    metadata: Record<string, unknown> | null;
  } };
}

/* --------------------------------------------------------------------------
 * PLANNING
 * ------------------------------------------------------------------------ */

export async function createSocialPlan(ctx: OpContext, input: CreateSocialPlanInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (records: AffectedRecord[] = []) =>
    base("createSocialPlan", input.organizationId, input.ventureId, ctx.userId, start, records);

  const platformReadiness = input.platforms.map((p) => resolveConnectorStatus(p));
  const readyPlatforms = platformReadiness.filter((r) => r.ready).map((r) => r.platform);
  const blockedPlatforms = platformReadiness.filter((r) => !r.ready);

  const platformMix: Record<string, number> = {};
  for (const p of input.platforms) platformMix[p] = 1 / input.platforms.length;

  let strategyId: string;
  try {
    const res = await createStrategy({
      data: {
        organizationId: input.organizationId,
        ventureId: input.ventureId,
        name: input.name,
        objective: input.objective ?? null,
        strategyPeriodStart: input.strategyPeriodStart,
        strategyPeriodEnd: input.strategyPeriodEnd,
        platformMix,
        promotionRatioLimit: input.promotionRatioLimit ?? null,
        strategicRationale: null,
        samRecommendation: null,
        platforms: input.platforms,
        themes: input.pillars.map((p) => p.name).slice(0, 20),
      } as never,
    });
    strategyId = (res as { id: string }).id;
  } catch (err) { return fromThrown(b(), err); }

  const plan = planContentCalendar({
    strategyPeriodStart: input.strategyPeriodStart,
    strategyPeriodEnd: input.strategyPeriodEnd,
    platformMix,
    promotionRatioLimit: input.promotionRatioLimit ?? null,
    pillars: input.pillars as never,
    postingCadencePerWeek: input.postingCadencePerWeek,
  });

  return success({
    ...b([{ entityType: "social_campaign", id: strategyId, href: null }]),
    summary: `Plan created with ${plan.slots.length} slots across ${input.platforms.length} platform(s).`,
    recommendedNextAction:
      blockedPlatforms.length > 0
        ? `Publish-ready: ${readyPlatforms.join(", ") || "none"}. Editorial-only (connector not implemented): ${blockedPlatforms.map((x) => x.displayName).join(", ")}.`
        : "Draft variants for each slot from the editor.",
    data: {
      strategyId,
      slots: plan.slots,
      engineVersion: plan.engineVersion,
      notes: plan.notes,
      platformReadiness: platformReadiness.map((r) => ({
        platform: r.platform, displayName: r.displayName, ready: r.ready, reasonCode: r.reasonCode,
      })),
    },
  });
}

/* --------------------------------------------------------------------------
 * VARIANT CREATION
 * ------------------------------------------------------------------------ */

export async function createPlatformVariants(ctx: OpContext, input: CreatePlatformVariantsInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) =>
    base("createPlatformVariants", input.organizationId, input.ventureId, ctx.userId, start, r);

  const created: Array<{ platform: string; id: string; href: string }> = [];
  const skipped: Array<{ platform: string; reason: string }> = [];
  const records: AffectedRecord[] = [];

  for (const platform of input.platforms) {
    try {
      const res = await createVariant({
        data: {
          organizationId: input.organizationId,
          ventureId: input.ventureId,
          parentContentItemId: input.parentContentItemId,
          platform,
          contentType: input.contentType,
        } as never,
      });
      const id = (res as { id: string }).id;
      created.push({ platform, id, href: editorHref(input.parentContentItemId) });
      records.push({ entityType: "social_content_item", id, href: editorHref(input.parentContentItemId) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      skipped.push({ platform, reason: msg.length > 120 ? "already exists or invalid" : msg });
    }
  }

  if (created.length === 0) {
    return failed({
      ...b(records),
      reasonCode: "invalid_input",
      message: `Could not create any variants: ${skipped.map((s) => `${s.platform} (${s.reason})`).join("; ")}`,
    });
  }
  return success({
    ...b(records),
    summary: `Created ${created.length} variant(s)${skipped.length ? `, skipped ${skipped.length}` : ""}.`,
    data: { created, skipped },
  });
}

/* --------------------------------------------------------------------------
 * AI-ASSISTED EDITING
 * ------------------------------------------------------------------------ */

async function runEdit(
  ctx: OpContext,
  op: SamOperationName,
  style: RewriteStyle,
  input: EditVariantInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) =>
    base(op, input.organizationId, input.ventureId, ctx.userId, start, r);

  const load = await loadVariantForEdit(ctx.supabase, input.organizationId, input.contentItemId);
  if (!load.ok) return failed({ ...b(), reasonCode: load.reason, message: load.message });
  const row = load.row;
  const cfg = ((): { maxBodyBytes: number } => {
    try { return getPlatformConfig(row.platform) as never; } catch { return { maxBodyBytes: 5000 }; }
  })();

  const rewrite = await generateRewrite({
    orgId: input.organizationId,
    style,
    platform: row.platform,
    currentBody: row.body,
    currentHook: row.hook,
    currentCta: row.cta,
    currentHashtags: row.hashtags ?? [],
    instruction: input.instruction ?? null,
    bodyCharLimit: cfg.maxBodyBytes,
  });
  if (!rewrite.ok) {
    return failed({
      ...b(),
      reasonCode: rewrite.reason,
      message: rewrite.reason === "ai_unavailable"
        ? "The rewrite provider is not available right now."
        : "The rewrite provider returned an invalid response.",
    });
  }

  const media = (row.metadata as { media?: unknown } | null)?.media;
  try {
    await saveVariant({
      data: {
        organizationId: input.organizationId,
        ventureId: input.ventureId,
        contentItemId: input.contentItemId,
        platform: row.platform,
        contentType: row.content_type,
        title: row.title ?? null,
        hook: row.hook ?? null,
        body: rewrite.body,
        cta: row.cta ?? null,
        hashtags: rewrite.hashtags ?? row.hashtags ?? [],
        mentions: row.mentions ?? [],
        linkUrl: row.link_url ?? null,
        firstComment: row.first_comment ?? null,
        altText: row.alt_text ?? null,
        newsletterSubject: row.newsletter_subject ?? null,
        newsletterPreview: row.newsletter_preview ?? null,
        media: Array.isArray(media) ? media : [],
        changeReason: `SAM ${op}`,
        overrideApproved: input.overrideApproved,
      } as never,
    });
  } catch (err) {
    return fromThrown(b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]), err);
  }
  return success({
    ...b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]),
    summary: `Rewrote the ${platformDisplayName(row.platform)} variant.`,
    data: {
      contentItemId: input.contentItemId,
      newBodyPreview: rewrite.body.slice(0, 240),
      modelId: rewrite.modelId,
      latencyMs: rewrite.latencyMs,
      style,
    },
  });
}

export const shortenVariant = (c: OpContext, i: EditVariantInputT) => runEdit(c, "shortenVariant", "shorten", i);
export const expandVariant = (c: OpContext, i: EditVariantInputT) => runEdit(c, "expandVariant", "expand", i);
export const changeTone = (c: OpContext, i: EditVariantInputT) => runEdit(c, "changeTone", "tone", i);
export const strengthenHook = (c: OpContext, i: EditVariantInputT) => runEdit(c, "strengthenHook", "strengthen_hook", i);
export const reducePromotion = (c: OpContext, i: EditVariantInputT) => runEdit(c, "reducePromotion", "reduce_promotion", i);
export const changeCTA = (c: OpContext, i: EditVariantInputT) => runEdit(c, "changeCTA", "change_cta", i);
export const suggestHashtags = (c: OpContext, i: EditVariantInputT) => runEdit(c, "suggestHashtags", "suggest_hashtags", i);
export const regenerateVariant = (c: OpContext, i: EditVariantInputT) => runEdit(c, "regenerateVariant", "regenerate", i);
export const rewriteVariant = (c: OpContext, i: EditVariantInputT) => runEdit(c, "rewriteVariant", "generic", i);

/* --------------------------------------------------------------------------
 * APPROVAL
 * ------------------------------------------------------------------------ */

export async function submitVariantForApproval(ctx: OpContext, input: ApprovalRefInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("submitForApproval", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await submitForApproval({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]),
      summary: "Submitted for approval.", data: { contentItemId: input.contentItemId },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function approveVariant(ctx: OpContext, input: ApprovalRefInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("approveVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await approveContentItem({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId, action: "approved", notes: input.notes ?? undefined } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]),
      summary: "Approved.", data: { contentItemId: input.contentItemId },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function rejectVariant(ctx: OpContext, input: RejectVariantInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("rejectVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await rejectContentItem({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId, reason: input.reason } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]),
      summary: "Rejected.", data: { contentItemId: input.contentItemId, reason: input.reason },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function requestVariantRevision(ctx: OpContext, input: RequestRevisionInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("requestRevision", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await requestRevision({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId, notes: input.notes } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]),
      summary: "Revision requested.", data: { contentItemId: input.contentItemId },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function approveBatch(ctx: OpContext, input: ApproveBatchInputT): Promise<OperationResult> {
  const start = Date.now();
  const records: AffectedRecord[] = input.contentItemIds.map((id: string) => ({ entityType: "social_content_item", id, href: editorHref(id) }));
  const b = (r: AffectedRecord[] = records) => base("approveBatch", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await batchApprove({ data: input as never });
    return success({ ...b(), summary: `Batch approved ${input.contentItemIds.length} item(s).`, data: res as never });
  } catch (err) { return fromThrown(b(), err); }
}

/* --------------------------------------------------------------------------
 * SCHEDULING
 * ------------------------------------------------------------------------ */

function toScheduleResult(
  op: SamOperationName, ctx: OpContext, input: ScheduleVariantOpInputT,
  res: { scheduledForUtc: string; jobId: string | null; executable: boolean; failures: unknown[]; calendarState?: string },
  start: number,
): OperationResult {
  const records: AffectedRecord[] = [{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }];
  if (res.jobId) records.push({ entityType: "automation_job", id: res.jobId, href: null });
  const b = base(op, input.organizationId, input.ventureId, ctx.userId, start, records);
  if (!res.executable) {
    return blocked({
      ...b,
      summary: `Scheduled editorially for ${res.scheduledForUtc}. Publication is blocked by ${res.failures.length} gate(s).`,
      reasonCode: "connector_not_implemented",
      detail: {
        scheduledForUtc: res.scheduledForUtc,
        gate_failures: JSON.stringify(res.failures).slice(0, 500),
        calendar_state: res.calendarState ?? "editorial_only",
      },
      actionRoute: "/settings/integrations",
    });
  }
  return success({ ...b, summary: `Scheduled for ${res.scheduledForUtc}.`, data: { scheduledForUtc: res.scheduledForUtc, jobId: res.jobId } });
}

export async function scheduleVariantOp(ctx: OpContext, input: ScheduleVariantOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("scheduleVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await scheduleVariant({ data: input as never });
    return toScheduleResult("scheduleVariant", ctx, input, res as never, start);
  } catch (err) { return fromThrown(b(), err); }
}

export async function rescheduleVariantOp(ctx: OpContext, input: ScheduleVariantOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("rescheduleVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await rescheduleVariant({ data: input as never });
    return toScheduleResult("rescheduleVariant", ctx, input, res as never, start);
  } catch (err) { return fromThrown(b(), err); }
}

export async function unscheduleVariantOp(ctx: OpContext, input: UnscheduleOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("unscheduleVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await unscheduleVariant({ data: input as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]),
      summary: "Unscheduled.", data: res as never,
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function cancelPublicationOp(ctx: OpContext, input: UnscheduleOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("cancelPublication", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await cancelPublication({ data: input as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }]),
      summary: "Publication canceled.", data: res as never,
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function scheduleBatchOp(ctx: OpContext, input: ScheduleBatchOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const records: AffectedRecord[] = input.items.map((i) => ({ entityType: "social_content_item", id: i.contentItemId, href: editorHref(i.contentItemId) }));
  const b = (r: AffectedRecord[] = records) => base("scheduleBatch", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await batchScheduleVariants({ data: input as never });
    return success({ ...b(), summary: `Scheduled ${input.items.length} item(s).`, data: res as never });
  } catch (err) { return fromThrown(b(), err); }
}

/* --------------------------------------------------------------------------
 * CONTROL
 * ------------------------------------------------------------------------ */

export async function pauseSocialPublishing(ctx: OpContext, input: PauseOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("pauseSocialPublishing", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await triggerEmergencyPause({ data: input as never });
    return success({ ...b(), summary: "Social publishing paused (venture-wide).", data: { reason: input.reason } });
  } catch (err) { return fromThrown(b(), err); }
}

export async function resumeSocialPublishing(ctx: OpContext, input: ResumeOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("resumeSocialPublishing", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await clearEmergencyPause({ data: input as never });
    return success({ ...b(), summary: "Social publishing resumed.", data: {} });
  } catch (err) { return fromThrown(b(), err); }
}

/* --------------------------------------------------------------------------
 * MEDIA
 * ------------------------------------------------------------------------ */

export async function attachExistingAsset(ctx: OpContext, input: AttachAssetInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("attachExistingAsset", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await attachMedia({ data: input as never });
    return success({
      ...b([
        { entityType: "content_media_attachment", id: (res as { id: string }).id, href: null },
        { entityType: "content_media_asset", id: input.mediaAssetId, href: null },
      ]),
      summary: "Attached asset to variant.",
      data: { attachmentId: (res as { id: string }).id },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function detachAsset(ctx: OpContext, input: DetachAssetInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("detachAsset", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await detachMedia({ data: input as never });
    return success({ ...b(), summary: "Detached asset.", data: { attachmentId: input.attachmentId } });
  } catch (err) { return fromThrown(b(), err); }
}

/* --------------------------------------------------------------------------
 * CONNECTIONS / TRUTHFUL BLOCKED
 * ------------------------------------------------------------------------ */

export async function listPublishingDestinations(ctx: OpContext, input: ListDestinationsInputT): Promise<OperationResult> {
  const start = Date.now();
  const platforms = [...SOCIAL_PLATFORMS, "beehiiv"] as string[];
  const rows = platforms.map((key) => {
    const status = resolveConnectorStatus(key);
    let descriptor: ReturnType<typeof getSocialPlatform> | null = null;
    try { descriptor = getSocialPlatform(key); } catch { /* unknown */ }
    return {
      platform: key,
      displayName: status.displayName,
      ready: status.ready,
      reasonCode: status.reasonCode,
      implementationStatus: descriptor?.implementationStatus ?? "unknown",
      connectorStatus: descriptor?.connectorStatus ?? "unknown",
      requiredScopes: status.requiredScopes,
      settingsRoute: status.settingsRoute,
    };
  });
  return success({
    ...base("listPublishingDestinations", input.organizationId, input.ventureId ?? null, ctx.userId, start),
    summary: `${rows.filter((r) => r.ready).length} of ${rows.length} platforms are publish-ready.`,
    data: { destinations: rows },
  });
}

export async function explainBlockedPublication(ctx: OpContext, input: ExplainBlockedInputT): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("explainBlockedPublication", input.organizationId, input.ventureId, ctx.userId, start, r);
  const { data: item, error } = await ctx.supabase
    .from("social_content_items")
    .select("id, platform, approval_status, status, scheduled_for")
    .eq("id", input.contentItemId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (error || !item) return failed({ ...b(), reasonCode: "not_found", message: "content item not found" });

  const connector = resolveConnectorStatus(item.platform);
  const records: AffectedRecord[] = [{ entityType: "social_content_item", id: item.id, href: editorHref(item.id) }];
  if (!connector.ready) {
    return blocked({
      ...b(records),
      summary: `Publication to ${connector.displayName} is blocked: ${connector.reasonCode?.replace(/_/g, " ")}.`,
      reasonCode: connector.reasonCode ?? "connector_not_implemented",
      detail: { ...connector.detail, item_status: item.status, approval_status: item.approval_status },
      actionRoute: connector.settingsRoute,
    });
  }
  if (item.approval_status !== "approved") {
    return blocked({
      ...b(records),
      summary: "Publication is blocked: variant is not approved.",
      reasonCode: "not_approved",
      detail: { approval_status: item.approval_status, item_status: item.status },
      actionRoute: editorHref(item.id),
    });
  }
  return success({ ...b(records), summary: "No block detected - this variant is publish-ready.", data: { itemId: item.id } });
}

// Truthful blocked result for publish / retry. There is no publishing
// connector implemented yet in S1e, so any publish attempt returns blocked -
// never a fake success. Later stages replace this with a real job enqueue.
export async function publishApprovedVariant(ctx: OpContext, input: PublishOpInputT): Promise<OperationResult> {
  const start = Date.now();
  const { data: item } = await ctx.supabase
    .from("social_content_items")
    .select("id, platform, approval_status")
    .eq("id", input.contentItemId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const platform = item?.platform ?? "unknown";
  const connector = resolveConnectorStatus(platform);
  const records: AffectedRecord[] = item ? [{ entityType: "social_content_item", id: item.id, href: editorHref(item.id) }] : [];
  const b = base("publishApprovedVariant", input.organizationId, input.ventureId, ctx.userId, start, records);
  return blocked({
    ...b,
    summary: `Cannot publish to ${connector.displayName}: connector is not implemented yet.`,
    reasonCode: connector.reasonCode ?? "connector_not_implemented",
    detail: { ...connector.detail, approval_status: item?.approval_status ?? "unknown" },
    actionRoute: connector.settingsRoute,
    recommendedNextAction: "Schedule the variant editorially; publication runs once the platform connector ships.",
  });
}

export const retryPublicationOp = publishApprovedVariant;

/* --------------------------------------------------------------------------
 * RETRIEVAL / STATUS
 * ------------------------------------------------------------------------ */

export async function retrieveApprovalQueue(
  ctx: OpContext, input: RetrieveApprovalQueueInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const b = base("retrieveApprovalQueue", input.organizationId, input.ventureId ?? null, ctx.userId, start);
  let q = ctx.supabase
    .from("social_content_items")
    .select("id, venture_id, platform, content_type, title, hook, approval_status, status, updated_at, scheduled_for")
    .eq("organization_id", input.organizationId)
    .in("approval_status", ["pending", "awaiting_review", "in_review"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(input.limit);
  if (input.ventureId) q = q.eq("venture_id", input.ventureId);
  const { data, error } = await q;
  if (error) return failed({ ...b, reasonCode: "server_error", message: "approval queue query failed" });
  const rows = (data ?? []).map((r) => ({
    contentItemId: r.id, ventureId: r.venture_id, platform: r.platform,
    contentType: r.content_type, title: r.title, hook: r.hook,
    approvalStatus: r.approval_status, itemStatus: r.status,
    scheduledFor: r.scheduled_for, updatedAt: r.updated_at,
    href: editorHref(r.id),
  }));
  return success({
    ...b,
    summary: `${rows.length} item(s) awaiting approval.`,
    data: { count: rows.length, items: rows },
  });
}

export async function retrieveScheduledContent(
  ctx: OpContext, input: RetrieveScheduledContentInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const b = base("retrieveScheduledContent", input.organizationId, input.ventureId ?? null, ctx.userId, start);
  let q = ctx.supabase
    .from("social_content_items")
    .select("id, venture_id, platform, content_type, title, status, scheduled_for")
    .eq("organization_id", input.organizationId)
    .in("status", ["scheduled", "queued", "publishing"])
    .is("deleted_at", null)
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .limit(input.limit);
  if (input.ventureId) q = q.eq("venture_id", input.ventureId);
  if (input.fromIso) q = q.gte("scheduled_for", input.fromIso);
  if (input.toIso) q = q.lt("scheduled_for", input.toIso);
  const { data, error } = await q;
  if (error) return failed({ ...b, reasonCode: "server_error", message: "scheduled query failed" });
  const rows = (data ?? []).map((r) => ({
    contentItemId: r.id, ventureId: r.venture_id, platform: r.platform,
    contentType: r.content_type, title: r.title, status: r.status,
    scheduledFor: r.scheduled_for, href: editorHref(r.id),
  }));
  return success({
    ...b, summary: `${rows.length} scheduled item(s).`,
    data: { count: rows.length, items: rows },
  });
}

export async function retrievePublicationStatus(
  ctx: OpContext, input: RetrievePublicationStatusInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const records: AffectedRecord[] = [{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }];
  const b = base("retrievePublicationStatus", input.organizationId, input.ventureId, ctx.userId, start, records);
  const { data: item } = await ctx.supabase
    .from("social_content_items")
    .select("id, platform, status, approval_status, scheduled_for, external_post_id, external_permalink")
    .eq("id", input.contentItemId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!item) return failed({ ...b, reasonCode: "not_found", message: "content item not found" });
  const { data: attempts } = await ctx.supabase
    .from("social_publication_attempts")
    .select("id, status, attempted_at, error_code, error_message")
    .eq("content_item_id", input.contentItemId)
    .order("attempted_at", { ascending: false })
    .limit(10);
  return success({
    ...b,
    summary: `Status: ${item.status} (${item.approval_status}).`,
    data: {
      contentItemId: item.id, platform: item.platform, status: item.status,
      approvalStatus: item.approval_status, scheduledFor: item.scheduled_for,
      externalPostId: item.external_post_id, externalPermalink: item.external_permalink,
      recentAttempts: attempts ?? [],
    },
  });
}

export async function retrievePerformance(
  ctx: OpContext, input: RetrievePerformanceInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const b = base("retrievePerformance", input.organizationId, input.ventureId, ctx.userId, start);
  let q = ctx.supabase
    .from("social_content_metrics")
    .select("id, content_item_id, platform, collected_at, impressions, reach, likes, comments, shares, clicks, saves")
    .eq("organization_id", input.organizationId)
    .eq("venture_id", input.ventureId)
    .order("collected_at", { ascending: false })
    .limit(input.limit);
  if (input.contentItemId) q = q.eq("content_item_id", input.contentItemId);
  if (input.sinceIso) q = q.gte("collected_at", input.sinceIso);
  const { data, error } = await q;
  if (error) return failed({ ...b, reasonCode: "server_error", message: "metrics query failed" });
  const rows = data ?? [];
  if (rows.length === 0) {
    return blocked({
      ...b,
      summary: "No performance metrics have been collected yet.",
      reasonCode: "no_metrics_available",
      detail: {},
      actionRoute: null,
    });
  }
  return success({
    ...b, summary: `${rows.length} metric snapshot(s).`,
    data: { count: rows.length, samples: rows },
  });
}

export async function retrieveLearnings(
  ctx: OpContext, input: RetrieveLearningsInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const b = base("retrieveLearnings", input.organizationId, input.ventureId, ctx.userId, start);
  let q = ctx.supabase
    .from("content_learnings")
    .select("id, observed_metric, observed_delta, sample_size, confidence, platform, content_pillar, hook_pattern, recommendation, valid_from, valid_until, superseded_by")
    .eq("organization_id", input.organizationId)
    .eq("venture_id", input.ventureId)
    .is("superseded_by", null)
    .order("valid_from", { ascending: false })
    .limit(input.limit);
  if (input.platform) q = q.eq("platform", input.platform);
  const { data, error } = await q;
  if (error) return failed({ ...b, reasonCode: "server_error", message: "learnings query failed" });
  const rows = data ?? [];
  const records: AffectedRecord[] = rows.slice(0, 25).map((r) => ({ entityType: "content_learning", id: r.id, href: null }));
  return success({
    ...b, affectedRecords: records,
    summary: `${rows.length} active learning(s).`,
    data: { count: rows.length, learnings: rows },
  });
}

export async function recommendNextPlan(
  ctx: OpContext, input: RecommendNextPlanInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const b = base("recommendNextPlan", input.organizationId, input.ventureId, ctx.userId, start);
  const since = new Date(Date.now() - input.lookbackDays * 86_400_000).toISOString();
  const [learnings, metrics, items] = await Promise.all([
    ctx.supabase.from("content_learnings")
      .select("observed_metric, observed_delta, sample_size, confidence, platform, hook_pattern, recommendation")
      .eq("organization_id", input.organizationId)
      .eq("venture_id", input.ventureId)
      .is("superseded_by", null)
      .order("confidence", { ascending: false, nullsFirst: false })
      .limit(20),
    ctx.supabase.from("social_content_metrics")
      .select("platform, impressions, likes, comments, shares")
      .eq("organization_id", input.organizationId)
      .eq("venture_id", input.ventureId)
      .gte("collected_at", since)
      .limit(500),
    ctx.supabase.from("social_content_items")
      .select("platform, status")
      .eq("organization_id", input.organizationId)
      .eq("venture_id", input.ventureId)
      .in("status", ["published", "scheduled"])
      .gte("updated_at", since)
      .limit(500),
  ]);

  // Aggregate per platform.
  const perPlatform: Record<string, { posts: number; avgImpressions: number; avgEngagement: number }> = {};
  for (const m of metrics.data ?? []) {
    const p = m.platform ?? "unknown";
    const agg = perPlatform[p] ?? { posts: 0, avgImpressions: 0, avgEngagement: 0 };
    const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0);
    agg.avgImpressions = (agg.avgImpressions * agg.posts + (m.impressions ?? 0)) / (agg.posts + 1);
    agg.avgEngagement = (agg.avgEngagement * agg.posts + eng) / (agg.posts + 1);
    agg.posts += 1;
    perPlatform[p] = agg;
  }
  const sortedByEng = Object.entries(perPlatform)
    .sort((a, b) => b[1].avgEngagement - a[1].avgEngagement);
  const recommendedPlatforms = sortedByEng.slice(0, 3).map(([p]) => p);
  const highConfidenceLearnings = (learnings.data ?? [])
    .filter((l) => (l.confidence ?? 0) >= 0.6 && (l.sample_size ?? 0) >= 5)
    .slice(0, 5)
    .map((l) => ({
      platform: l.platform, metric: l.observed_metric, delta: l.observed_delta,
      confidence: l.confidence, sampleSize: l.sample_size,
      recommendation: l.recommendation, hook: l.hook_pattern,
    }));

  return success({
    ...b,
    summary: `${recommendedPlatforms.length} platform focus, ${highConfidenceLearnings.length} confident learning(s), ${items.data?.length ?? 0} recent post(s).`,
    recommendedNextAction: recommendedPlatforms.length
      ? `Concentrate the next plan on: ${recommendedPlatforms.join(", ")}.`
      : "Collect more performance data before recommending platform mix.",
    data: {
      lookbackDays: input.lookbackDays,
      perPlatform, recommendedPlatforms, learnings: highConfidenceLearnings,
      recentPostCount: items.data?.length ?? 0,
    },
  });
}

export async function validateSocialConnection(
  ctx: OpContext, input: ValidateSocialConnectionInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const b = base("validateSocialConnection", input.organizationId, input.ventureId ?? null, ctx.userId, start);
  const status = resolveConnectorStatus(input.platform);
  if (!status.ready) {
    return blocked({
      ...b,
      summary: `${status.displayName}: ${status.reasonCode?.replace(/_/g, " ") ?? "not ready"}.`,
      reasonCode: status.reasonCode ?? "connector_not_implemented",
      detail: status.detail,
      actionRoute: status.settingsRoute,
    });
  }
  return success({
    ...b,
    summary: `${status.displayName} is publish-ready.`,
    data: { platform: input.platform, requiredScopes: status.requiredScopes },
  });
}

export async function updateVariant(
  ctx: OpContext, input: EditVariantInputT,
): Promise<OperationResult> {
  // Alias for regenerate/edit surface: routes plain text instruction through
  // the AI rewrite pipeline, same as rewriteVariant.
  return runEdit(ctx, "updateVariant", "generic", input);
}

export async function suggestCreativeBrief(
  ctx: OpContext, input: SuggestCreativeBriefInputT,
): Promise<OperationResult> {
  const start = Date.now();
  const records: AffectedRecord[] = [{ entityType: "social_content_item", id: input.contentItemId, href: editorHref(input.contentItemId) }];
  const b = base("suggestCreativeBrief", input.organizationId, input.ventureId, ctx.userId, start, records);
  const load = await loadVariantForEdit(ctx.supabase, input.organizationId, input.contentItemId);
  if (!load.ok) return failed({ ...b, reasonCode: load.reason, message: load.message });
  const row = load.row;
  const cfg = ((): { maxBodyBytes: number } => {
    try { return getPlatformConfig(row.platform) as never; } catch { return { maxBodyBytes: 2000 }; }
  })();
  const rewrite = await generateRewrite({
    orgId: input.organizationId,
    style: "generic",
    platform: row.platform,
    currentBody: row.body,
    currentHook: row.hook,
    currentCta: row.cta,
    instruction:
      "Draft a short creative brief (3-5 bullet points) describing the desired image/video to accompany this post. "
      + (input.focus ? `Focus: ${input.focus}. ` : "")
      + "Do not write the post body; output the brief only.",
    bodyCharLimit: Math.min(cfg.maxBodyBytes, 1500),
  });
  if (!rewrite.ok) {
    return failed({ ...b, reasonCode: rewrite.reason, message: "creative brief generation unavailable" });
  }
  return success({
    ...b,
    summary: "Creative brief suggested.",
    data: { contentItemId: input.contentItemId, brief: rewrite.body, modelId: rewrite.modelId },
  });
}

// Keep z referenced so tree-shaking sees the import as used.
export const __schemasVersion = z.literal("sam.operations.v1.0.0");