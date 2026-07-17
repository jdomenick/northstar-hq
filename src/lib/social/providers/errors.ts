// Normalized provider-error model. Every connector translates raw vendor
// failures into one of these codes so callers (publish gates, SAM ops,
// Brief items) can react without vendor-specific branching. Raw provider
// bodies stay in `providerRaw` for audit only, never surfaced to clients
// verbatim.

export const PROVIDER_ERROR_CODES = [
  "not_configured",            // env vars / connection row missing
  "connection_missing",        // no integration_connections row for account
  "unauthorized",              // token invalid, revoked, or wrong identity
  "forbidden_scope",           // token valid but missing required scope
  "rate_limited",              // 429 / provider quota
  "duplicate_rejected",        // provider dedup rejected the post
  "invalid_content",           // provider validation (length, media, url)
  "media_upload_failed",       // upload endpoint failed
  "media_not_ready",           // provider still processing media
  "destination_not_found",     // Page/subreddit/publication id unknown
  "destination_not_authorized",// account cannot post to that destination
  "temporary_failure",         // 5xx / transient network / provider outage
  "unsupported_operation",     // capability advertised as absent
  "verification_failed",       // post created but readback disagrees
  "provider_error",            // catch-all vendor error with body captured
] as const;
export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

export interface ProviderErrorContext {
  providerKey: string;
  operation: string;
  httpStatus?: number;
  providerCode?: string | null;
  providerRaw?: unknown;
  retryable: boolean;
  retryAfterSeconds?: number | null;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly context: ProviderErrorContext;
  constructor(code: ProviderErrorCode, message: string, context: ProviderErrorContext) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
    this.context = context;
  }
}

export function isProviderError(err: unknown): err is ProviderError {
  return err instanceof ProviderError;
}

// Safe shape for logging / Brief items. Never includes raw provider bodies.
export function sanitizeProviderError(err: ProviderError) {
  return {
    code: err.code,
    message: err.message,
    providerKey: err.context.providerKey,
    operation: err.context.operation,
    httpStatus: err.context.httpStatus ?? null,
    providerCode: err.context.providerCode ?? null,
    retryable: err.context.retryable,
    retryAfterSeconds: err.context.retryAfterSeconds ?? null,
  };
}