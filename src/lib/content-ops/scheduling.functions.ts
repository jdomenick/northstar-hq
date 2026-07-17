// Content Operations scheduler server functions.
//
// Every scheduling mutation runs here. The client never inserts into
// automation_jobs directly and never sets social_content_items.status to
// scheduled/queued/published on its own. All time interpretation is server-
// side using the venture's default timezone.
//
// The backend worker (src/lib/automation/*) is the executor; this module is
// the operator interface. Because automation_jobs runs server-side, scheduled
// posts continue processing when the PWA is closed, the browser is closed,
// the device is offline, or the user is signed out.

import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireMembership } from "./membership.server";
import { ContentOpsError } from "./errors";
import { CONTENT_OPS_LIMITS } from "./constants";
import { getPlatformConfig } from "./platform-registry";
import {
  evaluateScheduleGates,
  buildPublishIdempotencyKey,
  toIsoMinute,
  retryEligibility,
  SCHEDULE_GATES_VERSION,
  type ScheduleGateFailure,
  type ScheduleGateContext,
  type ScheduleGateCode,
} from "./schedule-gates";
import { resolveVentureTimezone, wallTimeToUtc } from "./timezone";
import { findExactDuplicate } from "@/lib/social/deduplication.server";
import { writeScheduleAudit } from "./schedule-audit.server";

type SB = SupabaseClient<Database>;

const uuid = z.string().uuid();
const org = { organizationId: uuid, ventureId: uuid };

// JSON-safe response shape for gate failures. TanStack serializer refuses
// `Record<string, unknown>` payloads, so we normalize to a Json-safe form
// before returning.
export interface JsonFailure {
  gate: ScheduleGateCode;
  severity: "blocking" | "editorial_only";
  reason: string;
  details: Json;
}

function toJsonFailures(failures: ScheduleGateFailure[]): JsonFailure[] {
  return failures.map((f) => ({
    gate: f.gate,
    severity: f.severity,
    reason: f.reason,
    details: f.details ? (JSON.parse(JSON.stringify(f.details)) as Json) : null,
  }));
}

/* ---------------------------------------------------------------------- */
/* Shared context loaders                                                 */
/* ---------------------------------------------------------------------- */

interface FullSchedulingContext {
  item: ScheduleGateContext["item"];
  autonomy: ScheduleGateContext["autonomy"];
  ventureSocial: ScheduleGateContext["ventureSocial"];
  killSwitches: ScheduleGateContext["killSwitches"];
  duplicateExists: boolean;
  connectorReady: boolean;
  destinationSelected: boolean;
}

async function loadItem(supabase: SB, orgId: string, ventureId: string, itemId: string) {
  const { data, error } = await supabase
    .from("social_content_items")
    .select(
      "id, organization_id, venture_id, platform, content_type, status, approval_status, approved_content_version, content_version, external_post_id, duplicate_fingerprint, scheduled_for, body, title, hook, cta, hashtags, media_requirements, media_status, risk_band, newsletter_subject, social_account_id, parent_content_item_id, deleted_at",
    )
    .eq("id", itemId)
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .maybeSingle();
  if (error) throw new ContentOpsError("unknown", error.message);
  if (!data || data.deleted_at) throw new ContentOpsError("not_found", "content item not found");
  return data;
}

async function loadSchedulingContext(
  supabase: SB,
  orgId: string,
  ventureId: string,
  item: Awaited<ReturnType<typeof loadItem>>,
): Promise<FullSchedulingContext> {
  const [autonomyRes, ventureRes, switchesRes] = await Promise.all([
    supabase
      .from("content_ops_autonomy")
      .select("mode, emergency_pause, platform_pauses")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .maybeSingle(),
    supabase
      .from("venture_social_settings")
      .select("paused, publishing_enabled, allowed_platforms, default_timezone, maximum_posts_per_day")
      .eq("organization_id", orgId)
      .eq("venture_id", ventureId)
      .maybeSingle(),
    supabase
      .from("content_ops_kill_switches")
      .select("scope, scope_ref, venture_id")
      .eq("organization_id", orgId)
      .eq("active", true),
  ]);

  const duplicateId = await findExactDuplicate(supabase, orgId, item.duplicate_fingerprint, item.id);

  const platform = item.platform;
  const connectorReady = await checkConnectorReady(platform);
  const destinationSelected = item.social_account_id != null ||
    !getPlatformConfig(platform).requiresDestinationSelection;

  return {
    item: {
      id: item.id,
      organization_id: item.organization_id,
      venture_id: item.venture_id,
      platform: item.platform,
      status: item.status,
      approval_status: item.approval_status,
      approved_content_version: item.approved_content_version,
      content_version: item.content_version,
      external_post_id: item.external_post_id,
      duplicate_fingerprint: item.duplicate_fingerprint,
      scheduled_for: item.scheduled_for,
      body: item.body,
      title: item.title,
      hook: item.hook,
      cta: item.cta,
      hashtags: item.hashtags,
      media_requirements: item.media_requirements,
      media_status: item.media_status,
      risk_band: item.risk_band,
      newsletter_subject: item.newsletter_subject,
    },
    autonomy: autonomyRes.data
      ? {
        emergency_pause: !!autonomyRes.data.emergency_pause,
        platform_pauses: (autonomyRes.data.platform_pauses ?? {}) as Record<string, boolean>,
        mode: autonomyRes.data.mode,
      }
      : null,
    ventureSocial: ventureRes.data
      ? {
        paused: !!ventureRes.data.paused,
        publishing_enabled: !!ventureRes.data.publishing_enabled,
        allowed_platforms: Array.isArray(ventureRes.data.allowed_platforms)
          ? (ventureRes.data.allowed_platforms as string[]) : null,
        default_timezone: ventureRes.data.default_timezone,
        maximum_posts_per_day: ventureRes.data.maximum_posts_per_day,
      }
      : null,
    killSwitches: (switchesRes.data ?? []).map((s) => ({
      scope: s.scope, scope_ref: s.scope_ref, venture_id: s.venture_id,
    })),
    duplicateExists: !!duplicateId,
    connectorReady,
    destinationSelected,
  };
}

/**
 * Truthful connector readiness. Beehiiv is real (behind env). Every other
 * platform is honestly "not ready" until its connector lands in S2-S6.
 * Never invent a ready state we cannot back with a real publish.
 */
async function checkConnectorReady(platform: string): Promise<boolean> {
  if (platform === "beehiiv") {
    try {
      const { validateBeehiivCredentials } = await import("@/lib/social/providers/beehiiv");
      const v = await validateBeehiivCredentials();
      return v.configured && v.reachable;
    } catch {
      return false;
    }
  }
  return false;
}

async function currentDailyCount(
  supabase: SB, orgId: string, ventureId: string, dayStartIso: string, dayEndIso: string,
): Promise<number> {
  const { count } = await supabase
    .from("social_content_items")
    .select("id", { head: true, count: "exact" })
    .eq("organization_id", orgId)
    .eq("venture_id", ventureId)
    .in("status", ["scheduled", "queued", "publishing", "published"])
    .gte("scheduled_for", dayStartIso)
    .lt("scheduled_for", dayEndIso);
  return count ?? 0;
}

/* ---------------------------------------------------------------------- */
/* Enqueue helper                                                         */
/* ---------------------------------------------------------------------- */

async function enqueuePublishJob(
  supabase: SB,
  args: {
    orgId: string;
    ventureId: string;
    itemId: string;
    contentVersion: number;
    scheduledForIso: string;
    platform: string;
    actorUserId: string;
    trigger: "scheduled" | "manual";
  },
): Promise<string> {
  const idem = buildPublishIdempotencyKey({
    contentItemId: args.itemId,
    contentVersion: args.contentVersion,
    destinationKey: args.platform,
    scheduledForIsoMinute: toIsoMinute(args.scheduledForIso),
  });

  const payload: Json = {
    contentItemId: args.itemId,
    trigger: args.trigger,
    contentVersion: args.contentVersion,
    platform: args.platform,
  };

  const { data, error } = await supabase
    .from("automation_jobs")
    .insert({
      organization_id: args.orgId,
      venture_id: args.ventureId,
      job_type: "social_publish",
      job_family: "social",
      status: "queued",
      priority: "high",
      trigger_type: args.trigger,
      actor_type: "user",
      created_by: args.actorUserId,
      scheduled_for: args.scheduledForIso,
      available_at: args.scheduledForIso,
      timeout_seconds: 300,
      max_attempts: 3,
      handler_version: "beehiiv.publish.v1-6a",
      policy_version: SCHEDULE_GATES_VERSION,
      idempotency_key: idem,
      input_payload: payload,
    } as never)
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new ContentOpsError("duplicate", "a publish job for this variant, version, and slot already exists");
    }
    throw new ContentOpsError("unknown", error?.message ?? "failed to enqueue publish job");
  }
  return data.id;
}

async function cancelPendingJobs(supabase: SB, orgId: string, itemId: string): Promise<number> {
  const { data } = await supabase
    .from("automation_jobs")
    .select("id, status, attempt_number, max_attempts")
    .eq("organization_id", orgId)
    .eq("job_type", "social_publish")
    .contains("input_payload", { contentItemId: itemId } as never)
    .in("status", ["queued", "scheduled", "blocked", "retrying"]);
  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;
  const { error } = await supabase
    .from("automation_jobs")
    .update({ status: "cancelled", completed_at: new Date().toISOString(), error_code: "operator_cancelled" } as never)
    .in("id", ids);
  if (error) throw new ContentOpsError("unknown", error.message);
  return ids.length;
}

/* ---------------------------------------------------------------------- */
/* Public server functions                                                */
/* ---------------------------------------------------------------------- */

const ScheduleVariantInput = z.object({
  ...org,
  contentItemId: uuid,
  // Either a UTC ISO instant OR a venture wall-clock time. Provide exactly one.
  scheduledForUtc: z.string().datetime().optional(),
  wallTime: z
    .object({
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
      hour: z.number().int().min(0).max(23),
      minute: z.number().int().min(0).max(59),
    })
    .optional(),
});
type ScheduleVariantInput = z.infer<typeof ScheduleVariantInput>;

// Plain (non-ServerFn) impl so rescheduleVariant / batchScheduleVariants can
// compose it without going through the TanStack ServerFn wrapper (which
// returns Promise<unknown> when called from other server code).
async function _scheduleVariantImpl(
  supabase: SB,
  userId: string,
  data: ScheduleVariantInput,
): Promise<{
  ok: true;
  contentItemId: string;
  scheduledForUtc: string;
  jobId: string | null;
  executable: boolean;
  calendarState: string;
  failures: JsonFailure[];
}> {
    const context = { supabase, userId };
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const item = await loadItem(context.supabase, data.organizationId, data.ventureId, data.contentItemId);
    const sctx = await loadSchedulingContext(context.supabase, data.organizationId, data.ventureId, item);
    const tz = resolveVentureTimezone(sctx.ventureSocial?.default_timezone);

    let scheduledForUtc: Date;
    if (data.scheduledForUtc) {
      scheduledForUtc = new Date(data.scheduledForUtc);
    } else if (data.wallTime) {
      scheduledForUtc = wallTimeToUtc(data.wallTime, tz);
    } else {
      throw new ContentOpsError("invalid_input", "provide scheduledForUtc or wallTime");
    }

    const gates = evaluateScheduleGates({
      ...sctx,
      desiredScheduledFor: scheduledForUtc,
      now: new Date(),
      maxHorizonDays: CONTENT_OPS_LIMITS.maxScheduleHorizonDays,
    });

    // Enforce blocking failures other than connector_ready + destination_selected
    // which are informative for editorial scheduling.
    const hardFailures = gates.failures.filter((f) =>
      f.severity === "blocking" && f.gate !== "connector_ready" && f.gate !== "destination_selected",
    );
    if (hardFailures.length > 0) {
      throw new ContentOpsError("invalid_transition", "schedule_gates_failed", { failures: hardFailures });
    }

    // Cap on posts per day
    if (sctx.ventureSocial?.maximum_posts_per_day) {
      const dayStart = new Date(scheduledForUtc); dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 86_400_000);
      const daily = await currentDailyCount(context.supabase, data.organizationId, data.ventureId,
        dayStart.toISOString(), dayEnd.toISOString());
      if (daily >= sctx.ventureSocial.maximum_posts_per_day) {
        throw new ContentOpsError("over_limit", "venture_daily_post_cap_reached", {
          cap: sctx.ventureSocial.maximum_posts_per_day,
        });
      }
    }

    const isoUtc = scheduledForUtc.toISOString();
    const oldValue = { scheduled_for: item.scheduled_for, status: item.status };

    // Update the item first.
    const { error: updErr } = await context.supabase
      .from("social_content_items")
      .update({ status: "scheduled", scheduled_for: isoUtc } as never)
      .eq("id", item.id)
      .eq("content_version", item.content_version);
    if (updErr) throw new ContentOpsError("unknown", updErr.message);

    let jobId: string | null = null;
    let executable = false;
    if (sctx.connectorReady && sctx.destinationSelected) {
      jobId = await enqueuePublishJob(context.supabase, {
        orgId: data.organizationId,
        ventureId: data.ventureId,
        itemId: item.id,
        contentVersion: item.content_version,
        scheduledForIso: isoUtc,
        platform: item.platform,
        actorUserId: context.userId,
        trigger: "scheduled",
      });
      executable = true;
    }

    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: item.id,
      automationJobId: jobId,
      action: "schedule_created",
      actorUserId: context.userId,
      oldValue,
      newValue: { scheduled_for: isoUtc, status: "scheduled", jobId, executable },
      metadata: {
        timezone: tz,
        blockingConnector: !executable,
        gateFailures: gates.failures.map((f) => f.gate),
      },
    });

    return {
      ok: true,
      contentItemId: item.id,
      scheduledForUtc: isoUtc,
      jobId,
      executable,
      calendarState: gates.calendarState,
      failures: toJsonFailures(gates.failures),
    };
}

/** Schedule an approved variant. Editorial-only when connector is not ready. */
export const scheduleVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ScheduleVariantInput.parse(i))
  .handler(async ({ data, context }) => {
    return _scheduleVariantImpl(context.supabase, context.userId, data);
  });

/** Move an existing schedule to a different UTC instant (or venture wall time). */
export const rescheduleVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ScheduleVariantInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    await cancelPendingJobs(context.supabase, data.organizationId, data.contentItemId);
    const res = await _scheduleVariantImpl(context.supabase, context.userId, data);
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: data.contentItemId,
      automationJobId: res.jobId,
      action: "schedule_changed",
      actorUserId: context.userId,
      newValue: { scheduledForUtc: res.scheduledForUtc },
    });
    return res;
  });

const UnscheduleInput = z.object({ ...org, contentItemId: uuid, reason: z.string().max(500).optional() });

export const unscheduleVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UnscheduleInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const item = await loadItem(context.supabase, data.organizationId, data.ventureId, data.contentItemId);
    const oldValue = { scheduled_for: item.scheduled_for, status: item.status };
    const canceled = await cancelPendingJobs(context.supabase, data.organizationId, item.id);
    const { error } = await context.supabase
      .from("social_content_items")
      .update({ status: "ready", scheduled_for: null } as never)
      .eq("id", item.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: item.id,
      action: "schedule_removed",
      actorUserId: context.userId,
      oldValue,
      newValue: { scheduled_for: null, status: "ready", canceledJobs: canceled },
      reason: data.reason ?? null,
    });
    return { ok: true, canceledJobs: canceled };
  });

export const cancelPublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => UnscheduleInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const item = await loadItem(context.supabase, data.organizationId, data.ventureId, data.contentItemId);
    if (item.status === "published") {
      throw new ContentOpsError("invalid_transition", "cannot cancel a published item; delete the live post at the source");
    }
    const canceled = await cancelPendingJobs(context.supabase, data.organizationId, item.id);
    const { error } = await context.supabase
      .from("social_content_items")
      .update({ status: "canceled", scheduled_for: null } as never)
      .eq("id", item.id);
    if (error) throw new ContentOpsError("unknown", error.message);
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: item.id,
      action: "publication_canceled",
      actorUserId: context.userId,
      newValue: { status: "canceled", canceledJobs: canceled },
      reason: data.reason ?? null,
    });
    return { ok: true, canceledJobs: canceled };
  });

const DuplicateToDateInput = z.object({
  ...org,
  contentItemId: uuid,
  newScheduledForUtc: z.string().datetime().optional(),
  wallTime: ScheduleVariantInput.shape.wallTime,
});

export const duplicateVariantToDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DuplicateToDateInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const src = await loadItem(context.supabase, data.organizationId, data.ventureId, data.contentItemId);
    // Duplicate as a new draft with a fresh duplicate_fingerprint suffix so
    // it doesn't collide, and reset approval state.
    const newFingerprint = `${src.duplicate_fingerprint}#dup-${Date.now().toString(36)}`;
    const { data: created, error } = await context.supabase
      .from("social_content_items")
      .insert({
        organization_id: src.organization_id, venture_id: src.venture_id,
        platform: src.platform, content_type: src.content_type,
        title: src.title, body: src.body, hook: src.hook, cta: src.cta,
        newsletter_subject: src.newsletter_subject,
        hashtags: src.hashtags as Json, media_requirements: src.media_requirements as Json,
        social_account_id: src.social_account_id,
        parent_content_item_id: src.id,
        status: "draft", approval_status: "pending",
        duplicate_fingerprint: newFingerprint,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error || !created) throw new ContentOpsError("unknown", error?.message ?? "duplicate failed");
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId,
      ventureId: data.ventureId,
      contentItemId: created.id,
      action: "schedule_created",
      actorUserId: context.userId,
      metadata: { duplicatedFrom: src.id, target: "date" },
    });
    return { ok: true, newContentItemId: created.id };
  });

const DuplicateToPlatformInput = z.object({
  ...org,
  contentItemId: uuid,
  targetPlatform: z.string().min(1).max(64),
});

export const duplicateVariantToPlatform = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => DuplicateToPlatformInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const src = await loadItem(context.supabase, data.organizationId, data.ventureId, data.contentItemId);
    const cfg = getPlatformConfig(data.targetPlatform);
    if (!cfg) throw new ContentOpsError("invalid_input", "unknown target platform");
    const newFingerprint = `${src.duplicate_fingerprint}#p-${data.targetPlatform}`;
    const { data: created, error } = await context.supabase
      .from("social_content_items")
      .insert({
        organization_id: src.organization_id, venture_id: src.venture_id,
        platform: data.targetPlatform, content_type: src.content_type,
        title: src.title, body: src.body, hook: src.hook, cta: src.cta,
        newsletter_subject: src.newsletter_subject,
        hashtags: src.hashtags as Json, media_requirements: src.media_requirements as Json,
        parent_content_item_id: src.parent_content_item_id ?? src.id,
        status: "draft", approval_status: "pending",
        duplicate_fingerprint: newFingerprint,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error || !created) throw new ContentOpsError("unknown", error?.message ?? "duplicate failed");
    return { ok: true, newContentItemId: created.id };
  });

const BatchScheduleInput = z.object({
  ...org,
  entries: z
    .array(z.object({ contentItemId: uuid, scheduledForUtc: z.string().datetime() }))
    .min(1)
    .max(CONTENT_OPS_LIMITS.maxBatchApprovalSize),
});

export const batchScheduleVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BatchScheduleInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const results: Array<{ contentItemId: string; ok: boolean; reason?: string; jobId?: string | null }> = [];
    for (const e of data.entries) {
      try {
        const r = await scheduleVariant({
          data: {
            organizationId: data.organizationId,
            ventureId: data.ventureId,
            contentItemId: e.contentItemId,
            scheduledForUtc: e.scheduledForUtc,
          },
        });
        results.push({ contentItemId: e.contentItemId, ok: true, jobId: r.jobId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "error";
        results.push({ contentItemId: e.contentItemId, ok: false, reason: msg });
      }
    }
    return { results };
  });

const PublishNowInput = z.object({ ...org, contentItemId: uuid });

export const publishNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PublishNowInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const item = await loadItem(context.supabase, data.organizationId, data.ventureId, data.contentItemId);
    const sctx = await loadSchedulingContext(context.supabase, data.organizationId, data.ventureId, item);
    if (!sctx.connectorReady) {
      throw new ContentOpsError("provider_not_available", "connector is not ready for this platform");
    }
    const now = new Date();
    const gates = evaluateScheduleGates({
      ...sctx, desiredScheduledFor: now, now,
      maxHorizonDays: CONTENT_OPS_LIMITS.maxScheduleHorizonDays,
    });
    const hard = gates.failures.filter((f) => f.severity === "blocking");
    if (hard.length > 0) {
      throw new ContentOpsError("invalid_transition", "schedule_gates_failed", { failures: hard });
    }
    const nowIso = now.toISOString();
    await context.supabase
      .from("social_content_items")
      .update({ status: "scheduled", scheduled_for: nowIso } as never)
      .eq("id", item.id);
    const jobId = await enqueuePublishJob(context.supabase, {
      orgId: data.organizationId, ventureId: data.ventureId,
      itemId: item.id, contentVersion: item.content_version,
      scheduledForIso: nowIso, platform: item.platform,
      actorUserId: context.userId, trigger: "manual",
    });
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId, ventureId: data.ventureId,
      contentItemId: item.id, automationJobId: jobId,
      action: "publish_now_requested", actorUserId: context.userId,
      newValue: { jobId, scheduledForUtc: nowIso },
    });
    return { ok: true, jobId };
  });

const ManualRetryInput = z.object({ ...org, automationJobId: uuid });

export const manualRetryPublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ManualRetryInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { data: job, error } = await context.supabase
      .from("automation_jobs")
      .select("id, status, attempt_number, max_attempts, error_code, input_payload, organization_id, venture_id, scheduled_for")
      .eq("id", data.automationJobId)
      .eq("organization_id", data.organizationId)
      .maybeSingle();
    if (error) throw new ContentOpsError("unknown", error.message);
    if (!job) throw new ContentOpsError("not_found", "job not found");
    const elig = retryEligibility({
      jobStatus: job.status,
      attemptNumber: job.attempt_number ?? 0,
      maxAttempts: job.max_attempts ?? 3,
      errorCode: job.error_code,
    });
    if (!elig.eligible) {
      throw new ContentOpsError("invalid_transition", elig.reason);
    }
    const { error: upErr } = await context.supabase
      .from("automation_jobs")
      .update({
        status: "retrying",
        available_at: new Date().toISOString(),
        error_code: null,
        completed_at: null,
      } as never)
      .eq("id", job.id);
    if (upErr) throw new ContentOpsError("unknown", upErr.message);
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId, ventureId: data.ventureId,
      automationJobId: job.id,
      action: "retry_requested", actorUserId: context.userId,
      metadata: { nextAttempt: elig.nextAttempt },
    });
    return { ok: true, nextAttempt: elig.nextAttempt };
  });

/* Emergency pause -------------------------------------------------------- */

const EmergencyPauseInput = z.object({ ...org, reason: z.string().min(3).max(500) });

export const emergencyPauseVenture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EmergencyPauseInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    // Set emergency_pause on autonomy (creating the row if absent) and
    // block queued publishing jobs. Preserve their scheduled_for so resume
    // can rehydrate them.
    const { error: upErr } = await context.supabase
      .from("content_ops_autonomy")
      .upsert({
        organization_id: data.organizationId,
        venture_id: data.ventureId,
        emergency_pause: true,
        emergency_pause_reason: data.reason,
        emergency_pause_at: new Date().toISOString(),
        changed_by: context.userId,
      } as never, { onConflict: "organization_id,venture_id" });
    if (upErr) throw new ContentOpsError("unknown", upErr.message);
    // Move active queued jobs to "blocked" so worker won't pick them up.
    const { data: blockedIds } = await context.supabase
      .from("automation_jobs")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .eq("job_type", "social_publish")
      .in("status", ["queued", "scheduled", "retrying"]);
    const ids = (blockedIds ?? []).map((r) => r.id);
    if (ids.length > 0) {
      await context.supabase
        .from("automation_jobs")
        .update({ status: "blocked", error_code: "emergency_pause" } as never)
        .in("id", ids);
    }
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId, ventureId: data.ventureId,
      action: "emergency_pause_engaged", actorUserId: context.userId,
      reason: data.reason, metadata: { blockedJobs: ids.length },
    });
    return { ok: true, blockedJobs: ids.length };
  });

export const resumePublishing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ ...org }).parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "executive");
    const { error: upErr } = await context.supabase
      .from("content_ops_autonomy")
      .update({
        emergency_pause: false,
        emergency_pause_reason: null,
        emergency_pause_at: null,
        changed_by: context.userId,
      } as never)
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId);
    if (upErr) throw new ContentOpsError("unknown", upErr.message);
    // Rehydrate blocked jobs back to queued.
    const { data: rows } = await context.supabase
      .from("automation_jobs")
      .select("id")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .eq("job_type", "social_publish")
      .eq("status", "blocked")
      .eq("error_code", "emergency_pause");
    const ids = (rows ?? []).map((r) => r.id);
    if (ids.length > 0) {
      await context.supabase
        .from("automation_jobs")
        .update({ status: "queued", error_code: null } as never)
        .in("id", ids);
    }
    await writeScheduleAudit(context.supabase, {
      organizationId: data.organizationId, ventureId: data.ventureId,
      action: "emergency_pause_lifted", actorUserId: context.userId,
      metadata: { rehydratedJobs: ids.length },
    });
    return { ok: true, rehydratedJobs: ids.length };
  });

/* ---------------------------------------------------------------------- */
/* Calendar query                                                         */
/* ---------------------------------------------------------------------- */

const ListScheduleInput = z.object({
  ...org,
  fromUtc: z.string().datetime(),
  toUtc: z.string().datetime(),
});

export const listScheduledContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListScheduleInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");

    const { data: items, error } = await context.supabase
      .from("social_content_items")
      .select(
        "id, platform, content_type, status, approval_status, approved_content_version, content_version, scheduled_for, published_at, external_post_url, title, hook, body, campaign_id, media_requirements, media_status, risk_band, duplicate_fingerprint, social_account_id",
      )
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .is("deleted_at", null)
      .or(`scheduled_for.gte.${data.fromUtc},published_at.gte.${data.fromUtc}`)
      .lte("scheduled_for", data.toUtc)
      .order("scheduled_for", { ascending: true })
      .limit(CONTENT_OPS_LIMITS.maxListPageSize);
    if (error) throw new ContentOpsError("unknown", error.message);

    const itemIds = (items ?? []).map((r) => r.id);
    const { data: jobsRaw } = itemIds.length
      ? await context.supabase
          .from("automation_jobs")
          .select("id, status, attempt_number, max_attempts, error_code, scheduled_for, available_at, retry_after, input_payload, completed_at")
          .eq("organization_id", data.organizationId)
          .eq("job_type", "social_publish")
          .order("scheduled_for", { ascending: false })
          .limit(500)
      : { data: [] as never[] };
    const jobsByItem = new Map<string, Array<Record<string, unknown>>>();
    for (const j of jobsRaw ?? []) {
      const p = (j.input_payload ?? {}) as { contentItemId?: string };
      const key = p.contentItemId ?? "";
      if (!key) continue;
      const arr = jobsByItem.get(key) ?? [];
      arr.push(j as unknown as Record<string, unknown>);
      jobsByItem.set(key, arr);
    }

    // Venture social settings once
    const { data: vs } = await context.supabase
      .from("venture_social_settings")
      .select("default_timezone, paused, publishing_enabled")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();
    const { data: autonomy } = await context.supabase
      .from("content_ops_autonomy")
      .select("emergency_pause, platform_pauses")
      .eq("organization_id", data.organizationId)
      .eq("venture_id", data.ventureId)
      .maybeSingle();

    return {
      timezone: resolveVentureTimezone(vs?.default_timezone),
      emergencyPause: !!autonomy?.emergency_pause,
      platformPauses: (autonomy?.platform_pauses ?? {}) as Record<string, boolean>,
      publishingEnabled: !!vs?.publishing_enabled,
      venturePaused: !!vs?.paused,
      items: (items ?? []).map((r) => ({
        ...r,
        jobs: jobsByItem.get(r.id) ?? [],
      })),
    };
  });

/* Preview gates without mutating anything. */
const PreviewGatesInput = z.object({
  ...org,
  contentItemId: uuid,
  scheduledForUtc: z.string().datetime().optional(),
});

export const previewScheduleGates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => PreviewGatesInput.parse(i))
  .handler(async ({ data, context }) => {
    await requireMembership(context.supabase, context.userId, data.organizationId, data.ventureId, "member");
    const item = await loadItem(context.supabase, data.organizationId, data.ventureId, data.contentItemId);
    const sctx = await loadSchedulingContext(context.supabase, data.organizationId, data.ventureId, item);
    const desired = data.scheduledForUtc ? new Date(data.scheduledForUtc) : null;
    const gates = evaluateScheduleGates({
      ...sctx,
      desiredScheduledFor: desired,
      now: new Date(),
      maxHorizonDays: CONTENT_OPS_LIMITS.maxScheduleHorizonDays,
    });
    return {
      calendarState: gates.calendarState,
      editorialAllowed: gates.editorialAllowed,
      executableAllowed: gates.executableAllowed,
      passed: gates.passed,
      failures: gates.failures,
      timezone: resolveVentureTimezone(sctx.ventureSocial?.default_timezone),
    };
  });
