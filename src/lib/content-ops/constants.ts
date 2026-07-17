// Content Operations - versioning and limits. Centralised so no module
// reaches for magic numbers directly.

export const CONTENT_OPS_DOMAIN_VERSION = "northstar.contentops.v1.0.0";
export const CONTENT_OPS_POLICY_VERSION = "northstar.contentops.policy.v1";
export const CONTENT_OPS_PLANNING_VERSION = "northstar.contentops.planning.v1";
export const CONTENT_OPS_GENERATION_VERSION = "northstar.contentops.generation.v1";
export const CONTENT_OPS_APPROVAL_VERSION = "northstar.contentops.approval.v1";
export const CONTENT_OPS_LEARNING_VERSION = "northstar.contentops.learning.v1";
export const CONTENT_OPS_VERIFICATION_VERSION = "northstar.contentops.verify.v1";

export const CONTENT_OPS_AUTONOMY_MODES = [
  "draft_only",
  "approval_required",
  "batch_approval",
  "guarded_autopilot",
  "full_autopilot",
] as const;
export type ContentOpsAutonomyMode = (typeof CONTENT_OPS_AUTONOMY_MODES)[number];

export const CONTENT_OPS_APPROVAL_ACTIONS = [
  "approved",
  "rejected",
  "requested_revision",
  "batch_approved",
  "revoked",
] as const;
export type ContentOpsApprovalAction = (typeof CONTENT_OPS_APPROVAL_ACTIONS)[number];

export const CONTENT_OPS_KILL_SWITCH_SCOPES = ["organization", "platform", "venture"] as const;
export type ContentOpsKillSwitchScope = (typeof CONTENT_OPS_KILL_SWITCH_SCOPES)[number];

export const CONTENT_OPS_VERIFICATION_STATUSES = [
  "pending",
  "verified",
  "partial",
  "failed",
  "unknown",
] as const;
export type ContentOpsVerificationStatus = (typeof CONTENT_OPS_VERIFICATION_STATUSES)[number];

export const CONTENT_OPS_LIMITS = {
  // Planning
  maxPillarsPerStrategy: 12,
  maxStrategyHorizonDays: 180,
  maxPlannedItemsPerRun: 60,
  minPromoRatioNumerator: 1,
  // Generation
  maxVariantsPerCoreIdea: 8,
  maxBodyBytes: 32 * 1024,
  maxHookBytes: 512,
  maxCtaBytes: 512,
  maxAltTextBytes: 1024,
  maxImagePromptBytes: 2 * 1024,
  maxNewsletterSubjectBytes: 512,
  maxNewsletterPreviewBytes: 1024,
  // Approvals
  maxBatchApprovalSize: 100,
  // Learnings
  minSampleSizePerLearning: 5,
  maxLearningsPerRun: 50,
  maxEvidenceRefsPerLearning: 25,
  // Scheduling
  maxScheduleHorizonDays: 180,
  // Kill-switches / autonomy
  maxKillSwitchesPerOrg: 100,
  // Query bounds
  defaultListPageSize: 50,
  maxListPageSize: 200,
} as const;

// Minimum sample sizes for a learning to be produced. Enforced in service
// layer (see Stage 1 doc, section 8.4).
export const CONTENT_OPS_MIN_SAMPLE_SIZE: Record<string, number> = {
  default: 5,
  facebook: 10,
  instagram: 10,
  linkedin: 8,
  x: 15,
  reddit: 10,
  beehiiv: 3,
};

export function minSampleSizeFor(platform: string | null | undefined): number {
  if (!platform) return CONTENT_OPS_MIN_SAMPLE_SIZE.default;
  return CONTENT_OPS_MIN_SAMPLE_SIZE[platform] ?? CONTENT_OPS_MIN_SAMPLE_SIZE.default;
}