export type ContentOpsErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "invalid_transition"
  | "conflict"
  | "over_limit"
  | "kill_switch_active"
  | "emergency_pause"
  | "autonomy_forbids"
  | "brand_policy_violation"
  | "duplicate"
  | "provider_not_available"
  | "provider_error"
  | "insufficient_evidence"
  | "unknown";

export class ContentOpsError extends Error {
  readonly code: ContentOpsErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: ContentOpsErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ContentOpsError";
    this.code = code;
    this.details = details;
  }
}

export function isContentOpsError(err: unknown): err is ContentOpsError {
  return err instanceof ContentOpsError;
}