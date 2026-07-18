// Meta failure taxonomy - 22 stable codes per Section 13 of the spec.
// Each code carries a retryability flag, user-safe message, and recommended
// action. Callers translate these into Brief items and SAM recommendations.

export const META_FAILURE_CODES = [
  "connector_not_configured",
  "missing_secret",
  "oauth_state_failure",
  "missing_permission",
  "token_expired",
  "authorization_revoked",
  "page_access_removed",
  "instagram_disconnected",
  "unsupported_account_type",
  "media_missing",
  "media_delivery_failure",
  "container_failure",
  "provider_rejection",
  "rate_limit",
  "network_timeout",
  "verification_delay",
  "verification_failure",
  "duplicate_execution",
  "canceled_publication",
  "revoked_approval",
  "changed_approved_version",
  "unknown_error",
] as const;

export type MetaFailureCode = (typeof META_FAILURE_CODES)[number];

export interface MetaFailureSpec {
  code: MetaFailureCode;
  retryable: boolean;
  userMessage: string;
  recommendedAction: string;
}

export const META_FAILURE_TAXONOMY: Record<MetaFailureCode, MetaFailureSpec> = {
  connector_not_configured: { code: "connector_not_configured", retryable: false, userMessage: "Meta credentials are not configured.", recommendedAction: "Add META_APP_ID, META_APP_SECRET, and META_WEBHOOK_VERIFY_TOKEN in Settings > Integrations." },
  missing_secret: { code: "missing_secret", retryable: false, userMessage: "A required Meta secret is missing.", recommendedAction: "Add the missing secret in Settings > Integrations." },
  oauth_state_failure: { code: "oauth_state_failure", retryable: true, userMessage: "The Meta authorization link was invalid or expired.", recommendedAction: "Restart the Meta connection from Settings > Integrations." },
  missing_permission: { code: "missing_permission", retryable: false, userMessage: "Meta did not grant a required permission.", recommendedAction: "Reconnect Meta and grant all requested permissions." },
  token_expired: { code: "token_expired", retryable: false, userMessage: "The Meta access token has expired.", recommendedAction: "Reconnect the Meta account." },
  authorization_revoked: { code: "authorization_revoked", retryable: false, userMessage: "You revoked authorization for this app on Meta.", recommendedAction: "Reconnect the Meta account." },
  page_access_removed: { code: "page_access_removed", retryable: false, userMessage: "You no longer have publishing access to that Facebook Page.", recommendedAction: "Restore Page access in Meta Business Suite and reconnect." },
  instagram_disconnected: { code: "instagram_disconnected", retryable: false, userMessage: "The Instagram account is no longer linked to that Facebook Page.", recommendedAction: "Reconnect the Instagram account to the Page and re-run destination discovery." },
  unsupported_account_type: { code: "unsupported_account_type", retryable: false, userMessage: "The Instagram account must be Business or Creator.", recommendedAction: "Switch the account type in Instagram settings." },
  media_missing: { code: "media_missing", retryable: false, userMessage: "The attached media asset is missing or was removed.", recommendedAction: "Re-attach media and re-approve the post." },
  media_delivery_failure: { code: "media_delivery_failure", retryable: true, userMessage: "Meta could not fetch the media asset.", recommendedAction: "Retry the publication; if it persists, re-upload the media." },
  container_failure: { code: "container_failure", retryable: true, userMessage: "Instagram media container failed to process.", recommendedAction: "Retry, or replace the media if the failure repeats." },
  provider_rejection: { code: "provider_rejection", retryable: false, userMessage: "Meta rejected the post.", recommendedAction: "Review the caption/media for policy issues and edit before re-approving." },
  rate_limit: { code: "rate_limit", retryable: true, userMessage: "Meta rate-limited this account.", recommendedAction: "Publication will retry automatically after the rate window." },
  network_timeout: { code: "network_timeout", retryable: true, userMessage: "The request to Meta timed out.", recommendedAction: "Publication will retry automatically." },
  verification_delay: { code: "verification_delay", retryable: true, userMessage: "The post was created but Meta hasn't confirmed it yet.", recommendedAction: "Verification will retry automatically." },
  verification_failure: { code: "verification_failure", retryable: false, userMessage: "Meta returned unexpected data for the published post.", recommendedAction: "Open the publication history for details." },
  duplicate_execution: { code: "duplicate_execution", retryable: false, userMessage: "This publication was already sent to Meta.", recommendedAction: "Open the existing publication history entry." },
  canceled_publication: { code: "canceled_publication", retryable: false, userMessage: "This publication was canceled.", recommendedAction: "Re-approve to publish again." },
  revoked_approval: { code: "revoked_approval", retryable: false, userMessage: "Approval was revoked before publication.", recommendedAction: "Re-approve the current version." },
  changed_approved_version: { code: "changed_approved_version", retryable: false, userMessage: "The content changed after approval.", recommendedAction: "Re-approve the current version." },
  unknown_error: { code: "unknown_error", retryable: true, userMessage: "An unexpected error occurred.", recommendedAction: "Retry, or contact support if it persists." },
};

export function classifyMetaFailure(code: MetaFailureCode): MetaFailureSpec {
  return META_FAILURE_TAXONOMY[code];
}
