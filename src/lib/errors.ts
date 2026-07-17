// Shared user-facing error dictionary. Never expose provider or Supabase raw
// errors to end users  -  map them through this table.

export type SamErrorCode =
  | "auth_required"
  | "org_required"
  | "membership_unavailable"
  | "permission_denied"
  | "rate_limit_exceeded"
  | "message_too_long"
  | "message_empty"
  | "conversation_not_found"
  | "record_unavailable"
  | "provider_unavailable"
  | "provider_timeout"
  | "invalid_structured_response"
  | "context_assembly_failed"
  | "audit_persistence_failed"
  | "sam_disabled"
  | "memory_not_found"
  | "memory_cross_org"
  | "memory_private"
  | "memory_invalid_layer"
  | "memory_venture_required"
  | "memory_expired"
  | "memory_version_conflict"
  | "memory_duplicate_active"
  | "memory_conflict_detected"
  | "memory_source_unavailable"
  | "memory_dispute_review_required"
  | "learning_persistence_failed"
  | "graph_cross_org"
  | "graph_entity_missing"
  | "graph_traversal_limit"
  | "workflow_unavailable"
  | "workflow_not_implemented"
  | "workflow_already_running"
  | "invalid_workflow_scope"
  | "venture_required"
  | "invalid_date_range"
  | "insufficient_data"
  | "deterministic_analysis_failed"
  | "provider_synthesis_failed"
  | "structured_output_invalid"
  | "citation_validation_failed"
  | "workflow_persistence_failed"
  | "workflow_not_found"
  | "workflow_access_denied"
  | "unknown_error";

export const SAM_ERROR_MESSAGES: Record<SamErrorCode, string> = {
  auth_required: "Please sign in to use SAM.",
  org_required: "SAM needs an active organization to answer.",
  membership_unavailable: "Your membership isn't active in this organization.",
  permission_denied: "You don't have access to that record.",
  rate_limit_exceeded: "You've reached today's SAM request limit. Please try again tomorrow.",
  message_too_long: "That message is too long. Please shorten it and try again.",
  message_empty: "Please enter a question for SAM.",
  conversation_not_found: "This conversation is no longer available.",
  record_unavailable: "A referenced record is unavailable.",
  provider_unavailable: "SAM's intelligence service is temporarily unavailable. Please retry.",
  provider_timeout: "SAM took too long to respond. Please retry.",
  invalid_structured_response: "SAM returned an incomplete answer. Please retry.",
  context_assembly_failed: "SAM couldn't assemble your context. Please retry.",
  audit_persistence_failed: "SAM couldn't record this exchange. Please retry.",
  sam_disabled: "SAM is disabled for this organization.",
  memory_not_found: "That memory item is no longer available.",
  memory_cross_org: "That memory belongs to another organization.",
  memory_private: "This memory is private to another member.",
  memory_invalid_layer: "That memory layer is not valid.",
  memory_venture_required: "Venture-scoped memory needs a valid venture in this organization.",
  memory_expired: "That memory has expired and needs to be reconfirmed.",
  memory_version_conflict: "This memory was edited elsewhere. Reload and try again.",
  memory_duplicate_active: "An active memory with the same scope already exists.",
  memory_conflict_detected: "This memory conflicts with another active item  -  review before confirming.",
  memory_source_unavailable: "SAM couldn't reach the source of that memory.",
  memory_dispute_review_required: "Disputed memory needs a review action before it can be confirmed.",
  learning_persistence_failed: "SAM couldn't record that feedback. Please retry.",
  graph_cross_org: "That relationship crosses an organization boundary.",
  graph_entity_missing: "One of the entities in that relationship no longer exists.",
  graph_traversal_limit: "The relationship graph is too large to display here.",
  workflow_unavailable: "That workflow is not available right now.",
  workflow_not_implemented: "That workflow isn't ready yet.",
  workflow_already_running: "A run for this workflow is already in progress.",
  invalid_workflow_scope: "That workflow scope is not valid.",
  venture_required: "This workflow needs a venture selected.",
  invalid_date_range: "The date range for this workflow is not valid.",
  insufficient_data: "There isn't enough information yet for this workflow.",
  deterministic_analysis_failed: "SAM couldn't complete this workflow's analysis.",
  provider_synthesis_failed: "SAM couldn't synthesize the narrative for this workflow.",
  structured_output_invalid: "SAM returned an incomplete workflow result. Please retry.",
  citation_validation_failed: "SAM couldn't verify the citations for this workflow.",
  workflow_persistence_failed: "SAM couldn't save this workflow run. Please retry.",
  workflow_not_found: "That workflow run is no longer available.",
  workflow_access_denied: "You don't have access to that workflow run.",
  unknown_error: "Something went wrong. Please retry.",
};

export class SamError extends Error {
  code: SamErrorCode;
  constructor(code: SamErrorCode, message?: string) {
    super(message ?? SAM_ERROR_MESSAGES[code]);
    this.code = code;
    this.name = "SamError";
  }
}

export function toSamError(err: unknown): SamError {
  if (err instanceof SamError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/timeout/i.test(msg)) return new SamError("provider_timeout");
  if (/rate.?limit|429/i.test(msg)) return new SamError("rate_limit_exceeded");
  return new SamError("unknown_error");
}