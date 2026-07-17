// Pure pre-schedule gate ruleset for the Content Operations scheduler.
//
// Given the current server-side state of a variant, compute the deterministic
// calendar state the operator sees ("draft", "awaiting_approval", ...) plus
// the exact list of gate failures that keep it out of the executable
// publishing queue.
//
// The scheduler UI, the schedule server function, and the pre-publish
// worker all pull from this same module so there is one source of truth for
// "why is this item blocked?". The nine pre-publish gates in
// publish-gates.server.ts run at execution time; the schedule gates below
// run at editorial time (before an automation_job exists) and share codes
// with the publish gates whenever they check the same condition.
//
// No I/O. All Supabase reads happen in the server-fn wrapper and are passed
// in as plain records.

import type { PlatformConfig } from "./platform-registry";
import { getPlatformConfig } from "./platform-registry";

export const SCHEDULE_GATES_VERSION = "northstar.contentops.schedule-gates.v1";

export type CalendarState =
  | "draft"
  | "changes_requested"
  | "awaiting_approval"
  | "approved"
  | "scheduled"
  | "queued"
  | "publishing"
  | "verifying"
  | "published"
  | "failed"
  | "blocked"
  | "canceled"
  | "paused";

export type ScheduleGateCode =
  | "variant_exists"
  | "platform_registered"
  | "approval_current"
  | "content_version_matches_approval"
  | "content_bounds"
  | "media_present"
  | "media_ready"
  | "promotion_policy"
  | "risk_policy"
  | "venture_autonomy"
  | "emergency_pause"
  | "publishing_enabled"
  | "kill_switch"
  | "duplicate_fingerprint"
  | "schedule_time_valid"
  | "schedule_time_future"
  | "schedule_time_within_horizon"
  | "connector_ready"
  | "destination_selected";

export interface ScheduleGateFailure {
  gate: ScheduleGateCode;
  severity: "blocking" | "editorial_only";
  reason: string;
  details?: Record<string, unknown>;
}

export interface ScheduleGateContext {
  item: {
    id: string;
    organization_id: string;
    venture_id: string;
    platform: string;
    status: string;
    approval_status: string;
    approved_content_version: number | null;
    content_version: number;
    external_post_id: string | null;
    duplicate_fingerprint: string;
    scheduled_for: string | null;
    body: string;
    title: string | null;
    hook: string | null;
    cta: string | null;
    hashtags: unknown;
    media_requirements: unknown;
    media_status: string;
    risk_band: string;
    newsletter_subject: string | null;
  };
  desiredScheduledFor: Date | null;
  now: Date;
  autonomy: {
    emergency_pause: boolean;
    platform_pauses: Record<string, boolean> | null;
    mode: string;
  } | null;
  ventureSocial: {
    paused: boolean;
    publishing_enabled: boolean;
    allowed_platforms: string[] | null;
    default_timezone: string;
    maximum_posts_per_day: number;
  } | null;
  killSwitches: Array<{ scope: string; scope_ref: string | null; venture_id: string | null }>;
  connectorReady: boolean;
  destinationSelected: boolean;
  duplicateExists: boolean;
  maxHorizonDays: number;
}

export interface ScheduleGateResult {
  calendarState: CalendarState;
  editorialAllowed: boolean;
  executableAllowed: boolean;
  failures: ScheduleGateFailure[];
  passed: ScheduleGateCode[];
  platform: PlatformConfig;
}

function fail(
  code: ScheduleGateCode,
  reason: string,
  severity: ScheduleGateFailure["severity"] = "blocking",
  details?: Record<string, unknown>,
): ScheduleGateFailure {
  return { gate: code, severity, reason, details };
}

/**
 * Evaluate the schedule gates. Editorial actions (drag to another day on the
 * calendar for planning) can still occur while some blocking failures are
 * present; executable actions (creating the automation_job) require every
 * blocking gate to pass.
 */
export function evaluateScheduleGates(ctx: ScheduleGateContext): ScheduleGateResult {
  const failures: ScheduleGateFailure[] = [];
  const passed: ScheduleGateCode[] = [];
  const cfg = getPlatformConfig(ctx.item.platform);

  // variant_exists - handled by caller (item is present here).
  passed.push("variant_exists");
  if (!cfg) {
    return {
      calendarState: "blocked",
      editorialAllowed: false,
      executableAllowed: false,
      failures: [fail("platform_registered", `platform_unknown:${ctx.item.platform}`)],
      passed,
      platform: getPlatformConfig("other"),
    };
  }
  passed.push("platform_registered");

  // approval_current
  if (ctx.item.approval_status !== "approved") {
    failures.push(fail("approval_current", `approval_status_is_${ctx.item.approval_status}`));
  } else {
    passed.push("approval_current");
    // content_version_matches_approval - if approval exists, it must still
    // point at the current content_version. Otherwise the approval is stale.
    if (
      ctx.item.approved_content_version == null ||
      ctx.item.approved_content_version !== ctx.item.content_version
    ) {
      failures.push(fail("content_version_matches_approval", "approval_stale", "blocking", {
        approved_content_version: ctx.item.approved_content_version,
        content_version: ctx.item.content_version,
      }));
    } else {
      passed.push("content_version_matches_approval");
    }
  }

  // content_bounds - re-uses hard registry limits
  const bodyLen = ctx.item.body ? [...ctx.item.body].length : 0;
  if (bodyLen > cfg.limits.bodyChars) {
    failures.push(fail("content_bounds", "body_over_hard_limit", "blocking", { bodyLen, limit: cfg.limits.bodyChars }));
  } else if (bodyLen === 0) {
    failures.push(fail("content_bounds", "body_empty"));
  } else {
    passed.push("content_bounds");
  }
  if (cfg.category === "newsletter" || cfg.category === "email") {
    if (!ctx.item.newsletter_subject || ctx.item.newsletter_subject.trim().length === 0) {
      failures.push(fail("content_bounds", "newsletter_subject_required"));
    }
  }

  // media_present / media_ready
  const mediaField = cfg.fields.media;
  const contentType = (ctx.item as { content_type?: string }).content_type ?? "";
  const needsMedia = mediaField === "supported" && (
    contentType === "image" || contentType === "carousel"
    || contentType === "short_video" || contentType === "long_video"
    || contentType === "reel" || contentType === "story"
  );
  const mediaCount = Array.isArray(ctx.item.media_requirements)
    ? (ctx.item.media_requirements as unknown[]).length
    : 0;
  if (needsMedia && mediaCount === 0) {
    failures.push(fail("media_present", "media_required_by_content_type", "blocking", { contentType }));
  } else {
    passed.push("media_present");
  }
  if (mediaCount > 0 && ctx.item.media_status !== "ready" && ctx.item.media_status !== "uploaded") {
    failures.push(fail("media_ready", `media_status_is_${ctx.item.media_status}`));
  } else {
    passed.push("media_ready");
  }

  // risk_policy - high risk requires human_reviewed = true, but that is
  // implicit in approval. Here we surface only "extreme" as blocking.
  if (ctx.item.risk_band === "extreme") {
    failures.push(fail("risk_policy", "risk_band_extreme"));
  } else {
    passed.push("risk_policy");
  }

  // venture_autonomy
  if (!ctx.autonomy) {
    failures.push(fail("venture_autonomy", "autonomy_row_missing"));
  } else if (ctx.autonomy.emergency_pause) {
    failures.push(fail("emergency_pause", "emergency_pause_active"));
  } else if ((ctx.autonomy.platform_pauses ?? {})[ctx.item.platform] === true) {
    failures.push(fail("emergency_pause", "platform_paused", "blocking", { platform: ctx.item.platform }));
  } else {
    passed.push("venture_autonomy");
    passed.push("emergency_pause");
  }

  // publishing_enabled + allowed_platforms
  if (!ctx.ventureSocial) {
    failures.push(fail("publishing_enabled", "venture_social_settings_missing"));
  } else {
    if (!ctx.ventureSocial.publishing_enabled) {
      failures.push(fail("publishing_enabled", "venture_publishing_disabled"));
    } else if (ctx.ventureSocial.paused) {
      failures.push(fail("publishing_enabled", "venture_publishing_paused"));
    } else {
      passed.push("publishing_enabled");
    }
    if (
      ctx.ventureSocial.allowed_platforms &&
      !ctx.ventureSocial.allowed_platforms.includes(ctx.item.platform)
    ) {
      failures.push(fail("publishing_enabled", "platform_not_allowed_for_venture", "blocking", { platform: ctx.item.platform }));
    }
  }

  // kill_switch
  const activeKill = ctx.killSwitches.find((s) => {
    if (s.scope === "organization") return true;
    if (s.scope === "platform" && s.scope_ref === ctx.item.platform) return true;
    if (s.scope === "venture" && s.venture_id === ctx.item.venture_id) return true;
    return false;
  });
  if (activeKill) {
    failures.push(fail("kill_switch", `kill_switch_${activeKill.scope}`, "blocking", { scope: activeKill.scope }));
  } else {
    passed.push("kill_switch");
  }

  // duplicate_fingerprint
  if (ctx.duplicateExists) {
    failures.push(fail("duplicate_fingerprint", "duplicate_content_exists"));
  } else {
    passed.push("duplicate_fingerprint");
  }

  // schedule_time_valid + future + horizon
  if (ctx.desiredScheduledFor) {
    const t = ctx.desiredScheduledFor.getTime();
    if (!Number.isFinite(t)) {
      failures.push(fail("schedule_time_valid", "invalid_schedule_time"));
    } else {
      passed.push("schedule_time_valid");
      // 60s grace so a schedule for "now" is not rejected due to network lag
      if (t < ctx.now.getTime() - 60_000) {
        failures.push(fail("schedule_time_future", "schedule_in_past"));
      } else {
        passed.push("schedule_time_future");
      }
      const horizonMs = ctx.maxHorizonDays * 86_400_000;
      if (t > ctx.now.getTime() + horizonMs) {
        failures.push(fail("schedule_time_within_horizon", "schedule_beyond_horizon", "blocking", { maxHorizonDays: ctx.maxHorizonDays }));
      } else {
        passed.push("schedule_time_within_horizon");
      }
    }
  }

  // destination_selected + connector_ready
  if (cfg.requiresDestinationSelection && !ctx.destinationSelected) {
    failures.push(fail("destination_selected", "destination_not_selected", "blocking", { platform: ctx.item.platform }));
  } else {
    passed.push("destination_selected");
  }
  if (!ctx.connectorReady) {
    failures.push(fail("connector_ready", "connector_not_ready", "blocking", { platform: ctx.item.platform }));
  } else {
    passed.push("connector_ready");
  }

  // Editorial (calendar placement) allowed if approval + platform are known.
  // Everything else can be resolved later.
  const editorialAllowed =
    ctx.item.approval_status !== "rejected" &&
    !failures.some((f) => f.gate === "schedule_time_valid" || f.gate === "schedule_time_within_horizon");

  const blockingFailures = failures.filter((f) => f.severity === "blocking");
  const executableAllowed = blockingFailures.length === 0;

  // Derive calendar state.
  let calendarState: CalendarState = "draft";
  const status = ctx.item.status;
  const approval = ctx.item.approval_status;
  if (status === "published") calendarState = "published";
  else if (status === "publishing" || status === "verifying") calendarState = status as CalendarState;
  else if (status === "failed") calendarState = "failed";
  else if (status === "canceled") calendarState = "canceled";
  else if (status === "queued") calendarState = "queued";
  else if (status === "scheduled") calendarState = "scheduled";
  else if (approval === "changes_requested") calendarState = "changes_requested";
  else if (approval === "pending" || approval === "in_review") calendarState = "awaiting_approval";
  else if (approval === "approved") calendarState = "approved";
  else calendarState = "draft";

  if (ctx.autonomy?.emergency_pause) calendarState = "paused";
  if (activeKill && calendarState !== "published") calendarState = "blocked";
  if (blockingFailures.length > 0 && calendarState !== "published" && calendarState !== "publishing") {
    // Anything blocked pre-execution surfaces as either paused or blocked.
    if (calendarState === "scheduled" || calendarState === "queued") calendarState = "blocked";
  }

  return {
    calendarState,
    editorialAllowed,
    executableAllowed,
    failures,
    passed,
    platform: cfg,
  };
}

/** Retry eligibility for a failed publish. Server-controlled, never client. */
export type RetryEligibility =
  | { eligible: true; nextAttempt: number }
  | { eligible: false; reason: string };

export function retryEligibility(input: {
  jobStatus: string;
  attemptNumber: number;
  maxAttempts: number;
  errorCode: string | null;
}): RetryEligibility {
  const notRetryable = new Set([
    "approval_revoked", "content_invalid", "missing_permissions",
    "account_disconnected", "policy_block", "canceled",
    "duplicate_content_exists", "already_published",
  ]);
  if (input.jobStatus !== "failed" && input.jobStatus !== "retrying") {
    return { eligible: false, reason: `job_status_not_retryable:${input.jobStatus}` };
  }
  if (input.errorCode && notRetryable.has(input.errorCode)) {
    return { eligible: false, reason: `error_not_retry_safe:${input.errorCode}` };
  }
  if (input.attemptNumber >= input.maxAttempts) {
    return { eligible: false, reason: "max_attempts_reached" };
  }
  return { eligible: true, nextAttempt: input.attemptNumber + 1 };
}

/**
 * Build a stable idempotency key for a publish attempt. Combining the
 * content fingerprint + approved content version + destination + occurrence
 * makes the automation_jobs uniqueness constraint reject any duplicate
 * publish for the same slot even if the caller enqueues twice.
 */
export function buildPublishIdempotencyKey(input: {
  contentItemId: string;
  contentVersion: number;
  destinationKey: string;
  scheduledForIsoMinute: string;
}): string {
  return [
    "cp",
    input.contentItemId,
    `v${input.contentVersion}`,
    input.destinationKey,
    input.scheduledForIsoMinute,
  ].join(":").slice(0, 256);
}

/** Truncate a UTC ISO timestamp to the minute for idempotency bucketing. */
export function toIsoMinute(iso: string): string {
  // 2027-03-10T09:15:23.456Z -> 2027-03-10T09:15:00Z
  return iso.replace(/:\d{2}(\.\d+)?Z$/, ":00Z");
}
