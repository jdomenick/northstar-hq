// Shared user-facing error dictionary. Never expose provider or Supabase raw
// errors to end users — map them through this table.

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