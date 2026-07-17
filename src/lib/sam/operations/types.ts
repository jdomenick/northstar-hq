// SAM Content Operations - Typed Operation Contract.
//
// Every SAM command lands on a typed operation whose handler returns one of
// three structured outcomes: success (a real server mutation or query
// succeeded), blocked (a truthful, non-retryable gate - missing connector,
// missing credential, unapproved variant, kill switch), or failed (an
// unexpected server error). Success requires the underlying server call to
// succeed - never inferred from intent.
//
// No AI text is ever persisted directly through this layer. AI-assisted ops
// go through validateVariant + saveVariant, which apply the same rules any
// human editor save does.

import { z } from "zod";

export const SAM_OPERATIONS_VERSION = "sam.operations.v1.0.0";

/** All operation names SAM knows about. Order/spelling is API-stable. */
export const SAM_OPERATION_NAMES = [
  // Planning
  "createSocialPlan",
  "reviseSocialPlan",
  "createCampaign",
  "createPlatformVariants",
  "regenerateVariant",
  "rewriteVariant",
  // Editing
  "updateVariant",
  "shortenVariant",
  "expandVariant",
  "changeTone",
  "strengthenHook",
  "reducePromotion",
  "changeCTA",
  "suggestHashtags",
  "suggestCreativeBrief",
  "attachExistingAsset",
  "detachAsset",
  // Approval
  "submitForApproval",
  "approveVariant",
  "approveBatch",
  "rejectVariant",
  "requestRevision",
  // Scheduling
  "scheduleVariant",
  "scheduleBatch",
  "rescheduleVariant",
  "unscheduleVariant",
  "cancelPublication",
  "publishApprovedVariant",
  "retryPublication",
  // Control
  "pauseSocialPublishing",
  "resumeSocialPublishing",
  // Connections / status
  "explainBlockedPublication",
  "listPublishingDestinations",
  // Retrieval / status
  "retrieveApprovalQueue",
  "retrieveScheduledContent",
  "retrievePublicationStatus",
  "retrievePerformance",
  "retrieveLearnings",
  "recommendNextPlan",
  "validateSocialConnection",
] as const;

export type SamOperationName = (typeof SAM_OPERATION_NAMES)[number];

export const SamOperationNameSchema = z.enum(SAM_OPERATION_NAMES);

/** Reference to a real DB record this operation touched. */
export interface AffectedRecord {
  entityType:
    | "social_content_item"
    | "social_content_plan"
    | "social_campaign"
    | "automation_job"
    | "content_ops_autonomy"
    | "content_ops_approval"
    | "content_media_asset"
    | "content_media_attachment"
    | "content_learning"
    | "social_account";
  id: string;
  /** Route the UI can link to for this record, if any. */
  href?: string | null;
}

export type OperationStatus = "success" | "blocked" | "failed" | "ambiguous";

export interface OperationResultBase {
  operation: SamOperationName;
  version: string;
  organizationId: string;
  ventureId?: string | null;
  actorUserId: string;
  /** Machine-friendly rollup. */
  status: OperationStatus;
  /** Short, user-facing single-sentence summary. Never contains raw errors. */
  summary: string;
  /** What to do next, if applicable. */
  recommendedNextAction?: string;
  affectedRecords: AffectedRecord[];
  /** Milliseconds from dispatch to result. */
  durationMs: number;
}

export interface OperationSuccess<T = Record<string, unknown>> extends OperationResultBase {
  status: "success";
  data: T;
}

export type BlockedReasonCode =
  | "connector_not_implemented"
  | "connector_credentials_missing"
  | "connector_permission_missing"
  | "destination_not_selected"
  | "not_approved"
  | "already_scheduled"
  | "already_published"
  | "emergency_paused"
  | "kill_switch_active"
  | "media_missing"
  | "duplicate_content"
  | "autonomy_forbids"
  | "insufficient_role"
  | "no_metrics_available";

export interface OperationBlocked extends OperationResultBase {
  status: "blocked";
  reasonCode: BlockedReasonCode;
  /** Machine-readable context: platform, missing scope, settings link, etc. */
  detail: Record<string, string | number | boolean | null>;
  /** UI route the user should visit to unblock. */
  actionRoute?: string | null;
}

export type FailedReasonCode =
  | "invalid_input"
  | "not_found"
  | "unauthorized"
  | "server_error"
  | "ai_unavailable"
  | "ai_output_invalid"
  | "provider_error";

export interface OperationFailed extends OperationResultBase {
  status: "failed";
  reasonCode: FailedReasonCode;
  /** Safe user-facing message. Never a raw stack trace or provider error. */
  message: string;
}

export interface OperationAmbiguous extends OperationResultBase {
  status: "ambiguous";
  /** What the operator needs to disambiguate. */
  question: string;
  candidates: Array<{ id: string; label: string; hint?: string }>;
}

export type OperationResult<T = Record<string, unknown>> =
  | OperationSuccess<T>
  | OperationBlocked
  | OperationFailed
  | OperationAmbiguous;

/** Guardrail: no operation is allowed to return a bare `{ ok: true }`. */
export function isTerminalResult(r: unknown): r is OperationResult {
  if (!r || typeof r !== "object") return false;
  const obj = r as { status?: unknown; operation?: unknown };
  return (
    typeof obj.operation === "string" &&
    (obj.status === "success" ||
      obj.status === "blocked" ||
      obj.status === "failed" ||
      obj.status === "ambiguous")
  );
}