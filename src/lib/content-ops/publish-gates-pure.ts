// Pure, dependency-free helpers used by the pre-publish gates.
// Isolated in their own module so node --test can import them without
// resolving `@/` path aliases or hitting Supabase types.

export type PublishGateCode =
  | "autonomy_ok"
  | "kill_switch_ok"
  | "approval_ok"
  | "duplicate_ok"
  | "idempotency_ok"
  | "credentials_ok"
  | "content_bounds_ok"
  | "schedule_ok"
  | "armed_ok";

export interface PublishGateFailure {
  gate: PublishGateCode;
  reason: string;
  details?: Record<string, unknown>;
}

export function checkContentBounds(item: {
  platform: string;
  body: string;
  newsletter_subject: string | null;
}): PublishGateFailure | null {
  if (item.platform === "beehiiv") {
    if (!item.newsletter_subject || item.newsletter_subject.trim().length === 0) {
      return { gate: "content_bounds_ok", reason: "newsletter_subject_required" };
    }
    if (item.newsletter_subject.length > 200) {
      return { gate: "content_bounds_ok", reason: "newsletter_subject_too_long" };
    }
    if (!item.body || item.body.trim().length < 20) {
      return { gate: "content_bounds_ok", reason: "body_too_short" };
    }
    if (item.body.length > 500_000) {
      return { gate: "content_bounds_ok", reason: "body_too_long" };
    }
    return null;
  }
  return { gate: "content_bounds_ok", reason: "platform_not_supported_in_6a", details: { platform: item.platform } };
}

export function checkApproval(item: {
  approval_status: string;
  approved_content_version: number | null;
  content_version: number;
}): PublishGateFailure | null {
  if (item.approval_status !== "approved") {
    return { gate: "approval_ok", reason: "not_approved", details: { approval_status: item.approval_status } };
  }
  if (item.approved_content_version == null || item.approved_content_version !== item.content_version) {
    return {
      gate: "approval_ok",
      reason: "approval_stale",
      details: {
        approved_content_version: item.approved_content_version,
        content_version: item.content_version,
      },
    };
  }
  return null;
}

export function checkIdempotency(item: {
  status: string;
  external_post_id: string | null;
}): PublishGateFailure | null {
  if (item.status === "published" || item.external_post_id) {
    return {
      gate: "idempotency_ok",
      reason: "already_published",
      details: { status: item.status, external_post_id: item.external_post_id },
    };
  }
  return null;
}

export function checkSchedule(
  item: { scheduled_for: string | null },
  trigger: "scheduled" | "manual",
  now: Date = new Date(),
): PublishGateFailure | null {
  if (trigger === "manual") return null;
  if (!item.scheduled_for) return { gate: "schedule_ok", reason: "no_scheduled_time" };
  const when = new Date(item.scheduled_for).getTime();
  if (Number.isNaN(when)) return { gate: "schedule_ok", reason: "invalid_scheduled_time" };
  if (when > now.getTime()) {
    return { gate: "schedule_ok", reason: "scheduled_in_future", details: { scheduled_for: item.scheduled_for } };
  }
  return null;
}

export const PUBLISH_GATES_VERSION = "northstar.contentops.publish-gates.v1";