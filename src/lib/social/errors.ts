// Sanitized errors for the Social Automation domain. Never surface raw
// database or connector errors to clients.

export const SOCIAL_ERROR_CODES = [
  "social_account_not_found",
  "social_account_not_connected",
  "social_account_disabled",
  "social_publishing_disabled",
  "publishing_master_switch_off",
  "emergency_stop_active",
  "venture_social_disabled",
  "venture_social_paused",
  "campaign_not_found",
  "campaign_not_active",
  "campaign_not_approved",
  "content_plan_not_found",
  "content_not_found",
  "content_not_approved",
  "content_version_mismatch",
  "content_paused",
  "content_cancelled",
  "content_archived",
  "brand_profile_not_found",
  "brand_profile_not_active",
  "brand_profile_not_approved",
  "connector_not_implemented",
  "credential_unavailable",
  "required_scope_missing",
  "invalid_platform",
  "invalid_content_type",
  "invalid_content_transition",
  "invalid_approval_transition",
  "media_not_ready",
  "required_disclaimer_missing",
  "prohibited_claim_detected",
  "restricted_topic_requires_review",
  "duplicate_content_detected",
  "publishing_limit_exceeded",
  "invalid_schedule",
  "platform_constraint_violation",
  "publication_not_verified",
  "invalid_publication_attempt",
  "invalid_metrics_snapshot",
  "permission_denied",
  "invalid_scope",
  "configuration_invalid",
  "social_payload_too_large",
  "internal_social_error",
] as const;
export type SocialErrorCode = (typeof SOCIAL_ERROR_CODES)[number];

export class SocialError extends Error {
  readonly code: SocialErrorCode;
  constructor(code: SocialErrorCode, message?: string) {
    super(message ?? code);
    this.name = "SocialError";
    this.code = code;
  }
}

export function isSocialError(err: unknown): err is SocialError {
  return err instanceof SocialError;
}

export function toSocialErrorCode(err: unknown): SocialErrorCode {
  return isSocialError(err) ? err.code : "internal_social_error";
}