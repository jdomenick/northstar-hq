// Server-only implementations for SAM Content Operations.
//
// Each op receives a normalized context (authenticated Supabase client,
// userId) plus a payload validated by an op-specific Zod schema. It returns
// a typed OperationResult - never a bare success from intent alone. All
// mutations go through the existing content-ops server functions (which
// already run requireMembership, validation, and audit writes), so
// authorization, RLS, and org isolation are enforced consistently.
//
// AI-assisted editing ops call generateRewrite and then re-save through
// saveVariant. If the AI is unavailable or produces invalid text, the op
// returns `failed` with reasonCode="ai_unavailable"/"ai_output_invalid"
// instead of persisting anything.
//
// Ops that would need a working publishing connector (publish, retry,
// listPublishingDestinations, explainBlockedPublication) return truthful
// `blocked` results derived from the static social registry - never fake
// provider output.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

import { blocked, failed, fromThrown, success } from "./result-builders";
import type { AffectedRecord, OperationResult, SamOperationName } from "./types";
import { resolveConnectorStatus, platformDisplayName } from "./connector-status";
import { generateRewrite, type RewriteStyle } from "./ai-rewrite.server";
import {
  CreateSocialPlanInput,
  CreatePlatformVariantsInput,
  EditVariantInput,
  ApprovalRefInput,
  RejectVariantInput,
  RequestRevisionInput,
  ApproveBatchInput,
  ScheduleVariantOpInput,
  UnscheduleOpInput,
  ScheduleBatchOpInput,
  PauseOpInput,
  ResumeOpInput,
  AttachAssetInput,
  DetachAssetInput,
  ListDestinationsInput,
  ExplainBlockedInput,
  PublishOpInput,
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
 * Shared context + helpers
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

function toEditorHref(itemId: string) {
  return `/content-ops/editor/${itemId}`;
}

/* --------------------------------------------------------------------------
 * Load helpers for AI-assisted edit ops
 * ------------------------------------------------------------------------ */

async function loadVariantForEdit(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  contentItemId: string,
): Promise<
  | { ok: true; row: {
      id: string; organization_id: string; venture_id: string; platform: string;
      content_type: string; title: string | null; hook: string | null; body: string;
      cta: string | null; hashtags: string[] | null; mentions: string[] | null;
      link_url: string | null; first_comment: string | null; alt_text: string | null;
      newsletter_subject: string | null; newsletter_preview: string | null;
      metadata: Record<string, unknown> | null;
    } }
  | { ok: false; reason: "not_found" | "server_error"; message: string }
> {
  const { data, error } = await supabase
    .from("social_content_items")
    .select("id, organization_id, venture_id, platform, content_type, title, hook, body, cta, hashtags, mentions, link_url, first_comment, alt_text, newsletter_subject, newsletter_preview, metadata")
    .eq("id", contentItemId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { ok: false, reason: "server_error", message: error.message };
  if (!data) return { ok: false, reason: "not_found", message: "variant not found" };
  return { ok: true, row: data as never };
}

/* --------------------------------------------------------------------------
 * PLANNING
 * ------------------------------------------------------------------------ */

export async function createSocialPlan(
  ctx: OpContext,
  input: z.infer<typeof CreateSocialPlanInput>,
): Promise<OperationResult> {
  const start = Date.now();
  const b = (records: AffectedRecord[] = []) =>
    base("createSocialPlan", input.organizationId, input.ventureId, ctx.userId, start, records);

  // Truthful readiness snapshot for every requested platform - the plan can be
  // built even for blocked connectors, but the operator sees which ones are
  // publish-ready and which are editorial-only.
  const platformReadiness = input.platforms.map((p) => resolveConnectorStatus(p));
  const readyPlatforms = platformReadiness.filter((r) => r.ready).map((r) => r.platform);
  const blockedPlatforms = platformReadiness.filter((r) => !r.ready);

  const platformMix: Record<string, number> = {};
  for (const p of input.platforms) platformMix[p] = 1 / input.platforms.length;

  // Persist the strategy first - this is the real server mutation we anchor
  // "success" to. If it fails, the plan is not recorded and no slots exist.
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
  } catch (err) {
    return fromThrown(b(), err);
  }

  // Deterministic slot layout - no LLM involved for the slot list itself.
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
        ? `Publish-ready: ${readyPlatforms.join(", ") || "none"}. Editorial-only (connector not implemented): ${blockedPlatforms.map((b) => b.displayName).join(", ")}.`
        : "Draft variants for each slot from the editor.",
    data: {
      strategyId,
      slots: plan.slots,
      engineVersion: plan.engineVersion,
      notes: plan.notes,
      platformReadiness: platformReadiness.map((r) => ({
        platform: r.platform,
        displayName: r.displayName,
        ready: r.ready,
        reasonCode: r.reasonCode,
      })),
    },
  });
}

/* --------------------------------------------------------------------------
 * VARIANT CREATION
 * ------------------------------------------------------------------------ */

export async function createPlatformVariants(
  ctx: OpContext,
  input: z.infer<typeof CreatePlatformVariantsInput>,
): Promise<OperationResult> {
  const start = Date.now();
  const b = (records: AffectedRecord[] = []) =>
    base("createPlatformVariants", input.organizationId, input.ventureId, ctx.userId, start, records);

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
      created.push({ platform, id, href: toEditorHref(input.parentContentItemId) });
      records.push({ entityType: "social_content_item", id, href: toEditorHref(input.parentContentItemId) });
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
  input: z.infer<typeof EditVariantInput>,
): Promise<OperationResult> {
  const start = Date.now();
  const b = (records: AffectedRecord[] = []) =>
    base(op, input.organizationId, input.ventureId, ctx.userId, start, records);

  const load = await loadVariantForEdit(ctx.supabase, input.organizationId, input.contentItemId);
  if (!load.ok) {
    return failed({ ...b(), reasonCode: load.reason, message: load.message });
  }
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
      message:
        rewrite.reason === "ai_unavailable"
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
    return fromThrown(b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]), err);
  }

  return success({
    ...b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]),
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

export const shortenVariant = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "shortenVariant", "shorten", i);
export const expandVariant = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "expandVariant", "expand", i);
export const changeTone = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "changeTone", "tone", i);
export const strengthenHook = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "strengthenHook", "strengthen_hook", i);
export const reducePromotion = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "reducePromotion", "reduce_promotion", i);
export const changeCTA = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "changeCTA", "change_cta", i);
export const suggestHashtags = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "suggestHashtags", "suggest_hashtags", i);
export const regenerateVariant = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "regenerateVariant", "regenerate", i);
export const rewriteVariant = (ctx: OpContext, i: z.infer<typeof EditVariantInput>) => runEdit(ctx, "rewriteVariant", "generic", i);

/* --------------------------------------------------------------------------
 * APPROVAL
 * ------------------------------------------------------------------------ */

export async function submitVariantForApproval(ctx: OpContext, input: z.infer<typeof ApprovalRefInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("submitForApproval", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await submitForApproval({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]),
      summary: "Submitted for approval.",
      data: { contentItemId: input.contentItemId },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function approveVariant(ctx: OpContext, input: z.infer<typeof ApprovalRefInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("approveVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await approveContentItem({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId, action: "approved", notes: input.notes ?? undefined } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]),
      summary: "Approved.",
      data: { contentItemId: input.contentItemId },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function rejectVariant(ctx: OpContext, input: z.infer<typeof ApprovalRefInput> & { reason: string }): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("rejectVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await rejectContentItem({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId, reason: input.reason } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]),
      summary: "Rejected.",
      data: { contentItemId: input.contentItemId, reason: input.reason },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function requestVariantRevision(ctx: OpContext, input: z.infer<typeof ApprovalRefInput> & { notes: string }): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("requestRevision", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await requestRevision({ data: { organizationId: input.organizationId, ventureId: input.ventureId, contentItemId: input.contentItemId, notes: input.notes } as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]),
      summary: "Revision requested.",
      data: { contentItemId: input.contentItemId },
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function approveBatch(ctx: OpContext, input: z.infer<typeof ApproveBatchInput>): Promise<OperationResult> {
  const start = Date.now();
  const records: AffectedRecord[] = input.contentItemIds.map((id) => ({ entityType: "social_content_item", id, href: toEditorHref(id) }));
  const b = (r: AffectedRecord[] = records) => base("approveBatch", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await batchApprove({ data: input as never });
    return success({
      ...b(),
      summary: `Batch approved ${input.contentItemIds.length} item(s).`,
      data: res as never,
    });
  } catch (err) { return fromThrown(b(), err); }
}

/* --------------------------------------------------------------------------
 * SCHEDULING
 * ------------------------------------------------------------------------ */

function toScheduleResult(op: SamOperationName, ctx: OpContext, input: z.infer<typeof ScheduleVariantOpInput>, res: {
  scheduledForUtc: string; jobId: string | null; executable: boolean; failures: unknown[]; calendarState?: string;
}, start: number): OperationResult {
  const records: AffectedRecord[] = [{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }];
  if (res.jobId) records.push({ entityType: "automation_job", id: res.jobId, href: null });
  const b = base(op, input.organizationId, input.ventureId, ctx.userId, start, records);
  if (!res.executable) {
    return blocked({
      ...b,
      summary: `Scheduled editorially for ${res.scheduledForUtc}. Publication is blocked by ${res.failures.length} gate(s).`,
      reasonCode: "connector_not_implemented",
      detail: { scheduledForUtc: res.scheduledForUtc, gate_failures: JSON.stringify(res.failures).slice(0, 500), calendar_state: res.calendarState ?? "editorial_only" },
      actionRoute: "/settings/integrations",
    });
  }
  return success({ ...b, summary: `Scheduled for ${res.scheduledForUtc}.`, data: { scheduledForUtc: res.scheduledForUtc, jobId: res.jobId } });
}

export async function scheduleVariantOp(ctx: OpContext, input: z.infer<typeof ScheduleVariantOpInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("scheduleVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await scheduleVariant({ data: input as never });
    return toScheduleResult("scheduleVariant", ctx, input, res as never, start);
  } catch (err) { return fromThrown(b(), err); }
}

export async function rescheduleVariantOp(ctx: OpContext, input: z.infer<typeof ScheduleVariantOpInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("rescheduleVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await rescheduleVariant({ data: input as never });
    return toScheduleResult("rescheduleVariant", ctx, input, res as never, start);
  } catch (err) { return fromThrown(b(), err); }
}

export const UnscheduleOpInput = z.object({ organizationId: uuid, ventureId: uuid, contentItemId: uuid, reason: z.string().max(500).optional() });

export async function unscheduleVariantOp(ctx: OpContext, input: z.infer<typeof UnscheduleOpInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("unscheduleVariant", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await unscheduleVariant({ data: input as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]),
      summary: "Unscheduled.", data: res as never,
    });
  } catch (err) { return fromThrown(b(), err); }
}

export async function cancelPublicationOp(ctx: OpContext, input: z.infer<typeof UnscheduleOpInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("cancelPublication", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await cancelPublication({ data: input as never });
    return success({
      ...b([{ entityType: "social_content_item", id: input.contentItemId, href: toEditorHref(input.contentItemId) }]),
      summary: "Publication canceled.", data: res as never,
    });
  } catch (err) { return fromThrown(b(), err); }
}

export const ScheduleBatchOpInput = z.object({
  organizationId: uuid,
  ventureId: uuid,
  items: z.array(z.object({
    contentItemId: uuid,
    scheduledForUtc: z.string().datetime().optional(),
  })).min(1).max(100),
});

export async function scheduleBatchOp(ctx: OpContext, input: z.infer<typeof ScheduleBatchOpInput>): Promise<OperationResult> {
  const start = Date.now();
  const records: AffectedRecord[] = input.items.map((i) => ({ entityType: "social_content_item", id: i.contentItemId, href: toEditorHref(i.contentItemId) }));
  const b = (r: AffectedRecord[] = records) => base("scheduleBatch", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    const res = await batchScheduleVariants({ data: input as never });
    return success({ ...b(), summary: `Scheduled ${input.items.length} item(s).`, data: res as never });
  } catch (err) { return fromThrown(b(), err); }
}

/* --------------------------------------------------------------------------
 * CONTROL (pause/resume)
 * ------------------------------------------------------------------------ */

export const PauseOpInput = z.object({ organizationId: uuid, ventureId: uuid, reason: z.string().min(3).max(500) });
export const ResumeOpInput = z.object({ organizationId: uuid, ventureId: uuid });

export async function pauseSocialPublishing(ctx: OpContext, input: z.infer<typeof PauseOpInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("pauseSocialPublishing", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await triggerEmergencyPause({ data: input as never });
    return success({ ...b(), summary: "Social publishing paused (venture-wide).", data: { reason: input.reason } });
  } catch (err) { return fromThrown(b(), err); }
}

export async function resumeSocialPublishing(ctx: OpContext, input: z.infer<typeof ResumeOpInput>): Promise<OperationResult> {
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

export const AttachAssetInput = z.object({
  organizationId: uuid, ventureId: uuid, contentItemId: uuid,
  contentVersionId: uuid, mediaAssetId: uuid,
  role: z.string().optional(), displayOrder: z.number().int().min(0).max(1000).optional(),
});

export async function attachExistingAsset(ctx: OpContext, input: z.infer<typeof AttachAssetInput>): Promise<OperationResult> {
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

export const DetachAssetInput = z.object({ organizationId: uuid, ventureId: uuid, attachmentId: uuid });

export async function detachAsset(ctx: OpContext, input: z.infer<typeof DetachAssetInput>): Promise<OperationResult> {
  const start = Date.now();
  const b = (r: AffectedRecord[] = []) => base("detachAsset", input.organizationId, input.ventureId, ctx.userId, start, r);
  try {
    await detachMedia({ data: input as never });
    return success({ ...b(), summary: "Detached asset.", data: { attachmentId: input.attachmentId } });
  } catch (err) { return fromThrown(b(), err); }
}

/* --------------------------------------------------------------------------
 * CONNECTIONS / TRUTHFUL BLOCKED RESULTS
 * ------------------------------------------------------------------------ */

export const ListDestinationsInput = z.object({ organizationId: uuid, ventureId: uuid.nullable().optional() });

export async function listPublishingDestinations(ctx: OpContext, input: z.infer<typeof ListDestinationsInput>): Promise<OperationResult> {
  const start = Date.now();
  const platforms = [...SOCIAL_PLATFORMS, "beehiiv"] as string[];
  const rows = platforms.map((key) => {
    const status = resolveConnectorStatus(key);
    let descriptor: ReturnType<typeof getSocialPlatform> | null = null;
    try { descriptor = getSocialPlatform(key); } catch { /* beehiiv or unknown */ }
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

export const ExplainBlockedInput = z.object({ organizationId: uuid, ventureId: uuid, contentItemId: uuid });

export async function explainBlockedPublication(ctx: OpContext, input: z.infer<typeof ExplainBlockedInput>): Promise<OperationResult> {
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
  const records: AffectedRecord[] = [{ entityType: "social_content_item", id: item.id, href: toEditorHref(item.id) }];

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
      actionRoute: toEditorHref(item.id),
    });
  }
  return success({ ...b(records), summary: "No block detected - this variant is publish-ready.", data: { itemId: item.id } });
}

/**
 * Truthful blocked result for `publishApprovedVariant` / `retryPublication`.
 * There is no publishing connector implemented yet (S1e ships before any
 * platform adapter), so any publish attempt must return blocked - never a
 * fake success. When the first connector lands (X, Meta, LinkedIn, etc.) this
 * op switches to enqueue the real publish job.
 */
export const PublishOpInput = z.object({ organizationId: uuid, ventureId: uuid, contentItemId: uuid });

export async function publishApprovedVariant(ctx: OpContext, input: z.infer<typeof PublishOpInput>): Promise<OperationResult> {
  const start = Date.now();
  const { data: item } = await ctx.supabase
    .from("social_content_items")
    .select("id, platform, approval_status")
    .eq("id", input.contentItemId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  const platform = item?.platform ?? "unknown";
  const connector = resolveConnectorStatus(platform);
  const records: AffectedRecord[] = item ? [{ entityType: "social_content_item", id: item.id, href: toEditorHref(item.id) }] : [];
  const b = base("publishApprovedVariant", input.organizationId, input.ventureId, ctx.userId, start, records);
  return blocked({
    ...b,
    summary: `Cannot publish to ${connector.displayName}: connector is not implemented yet.`,
    reasonCode: connector.reasonCode ?? "connector_not_implemented",
    detail: { ...connector.detail, approval_status: item?.approval_status ?? "unknown" },
    actionRoute: connector.settingsRoute,
    recommendedNextAction: "Schedule the variant editorially; publication will run once the platform connector ships.",
  });
}

export const retryPublicationOp = publishApprovedVariant;