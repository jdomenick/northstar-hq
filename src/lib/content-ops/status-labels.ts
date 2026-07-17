// Unified status labels used across editor, library, calendar, Brief,
// activity, approval queue, scheduled content, and publication status.
// One canonical vocabulary. Every surface derives its display label,
// eyebrow, and tone from here so users never see two different words for
// the same underlying state.

export type UnifiedStatus =
  | "draft"
  | "needs_review"
  | "ready_for_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "canceled"
  | "archived";

export type StatusTone = "neutral" | "warning" | "info" | "success" | "danger" | "muted";

export interface StatusDescriptor {
  readonly status: UnifiedStatus;
  readonly label: string;             // Title-Case human label
  readonly eyebrow: string;           // ALL-CAPS eyebrow for editorial UI
  readonly tone: StatusTone;
  readonly description: string;
  readonly sortRank: number;          // for consistent ordering across surfaces
}

const DESCRIPTORS: Record<UnifiedStatus, StatusDescriptor> = {
  draft:              { status: "draft",              label: "Draft",              eyebrow: "DRAFT",              tone: "muted",   description: "Not ready for review yet.",         sortRank: 10 },
  needs_review:       { status: "needs_review",       label: "Needs Review",       eyebrow: "NEEDS REVIEW",       tone: "warning", description: "Has open questions or gaps.",       sortRank: 20 },
  ready_for_approval: { status: "ready_for_approval", label: "Ready for Approval", eyebrow: "READY FOR APPROVAL", tone: "info",    description: "Waiting on an approver.",           sortRank: 30 },
  approved:           { status: "approved",           label: "Approved",           eyebrow: "APPROVED",           tone: "success", description: "Approved, not yet scheduled.",      sortRank: 40 },
  scheduled:          { status: "scheduled",          label: "Scheduled",          eyebrow: "SCHEDULED",          tone: "info",    description: "Scheduled to publish.",             sortRank: 50 },
  publishing:         { status: "publishing",         label: "Publishing",         eyebrow: "PUBLISHING",         tone: "info",    description: "Publish in progress.",              sortRank: 60 },
  published:          { status: "published",          label: "Published",          eyebrow: "PUBLISHED",          tone: "success", description: "Live on destination.",              sortRank: 70 },
  failed:             { status: "failed",             label: "Failed",             eyebrow: "FAILED",             tone: "danger",  description: "Last attempt failed.",              sortRank: 80 },
  canceled:           { status: "canceled",           label: "Canceled",           eyebrow: "CANCELED",           tone: "muted",   description: "Deliberately canceled.",            sortRank: 90 },
  archived:           { status: "archived",           label: "Archived",           eyebrow: "ARCHIVED",           tone: "muted",   description: "Removed from active views.",        sortRank: 100 },
};

export const UNIFIED_STATUSES: readonly UnifiedStatus[] = Object.keys(DESCRIPTORS) as UnifiedStatus[];

export function statusDescriptor(status: UnifiedStatus): StatusDescriptor {
  return DESCRIPTORS[status];
}

export function statusLabel(status: UnifiedStatus): string {
  return DESCRIPTORS[status].label;
}

export function statusTone(status: UnifiedStatus): StatusTone {
  return DESCRIPTORS[status].tone;
}

/**
 * Map any of the historical status strings scattered across the codebase
 * (approval_state, content status, publication status, calendar state)
 * onto the unified vocabulary. Returns null for genuinely unknown values so
 * the caller can decide how to render "unknown" rather than lying.
 */
export function unifyStatus(raw: string | null | undefined): UnifiedStatus | null {
  if (!raw) return null;
  const k = String(raw).toLowerCase().trim();
  switch (k) {
    // canonical passthrough
    case "draft":
    case "needs_review":
    case "ready_for_approval":
    case "approved":
    case "scheduled":
    case "publishing":
    case "published":
    case "failed":
    case "canceled":
    case "archived":
      return k as UnifiedStatus;

    // approval_state aliases (approvals.functions.ts)
    case "pending":
    case "in_review":
    case "in-review":
    case "review":
      return "ready_for_approval";
    case "rejected":
    case "changes_requested":
    case "revision_requested":
      return "needs_review";

    // content status aliases (social_content_items.status)
    case "queued":
    case "queued_for_publish":
    case "publish_queued":
      return "scheduled";
    case "in_progress":
    case "running":
      return "publishing";
    case "success":
    case "succeeded":
      return "published";
    case "error":
    case "publish_failed":
      return "failed";
    case "cancelled":     // British spelling
    case "skipped":
      return "canceled";

    // idle / neutral drafts
    case "new":
    case "created":
      return "draft";

    default:
      return null;
  }
}

/** Stable sort comparator for records exposing a UnifiedStatus. */
export function compareStatus(a: UnifiedStatus, b: UnifiedStatus): number {
  return DESCRIPTORS[a].sortRank - DESCRIPTORS[b].sortRank;
}

/**
 * Terminal statuses do not transition further under normal operation.
 * Callers use this to decide whether "resume", "retry", or "reschedule"
 * actions should even be offered.
 */
export function isTerminalStatus(status: UnifiedStatus): boolean {
  return status === "published" || status === "canceled" || status === "archived";
}

export function isBlockedStatus(status: UnifiedStatus): boolean {
  return status === "failed" || status === "needs_review";
}