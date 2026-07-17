// Sanitized error codes for integration + ingestion.
// Never surface raw provider errors to clients; map to one of these.

export const INTEGRATION_ERROR_CODES = [
  // Input / configuration
  "invalid_input",
  "invalid_url",
  "unsupported_scheme",
  "unsupported_provider",
  "unsupported_source_type",
  "unsupported_file_type",
  "missing_credentials",
  "invalid_credentials",

  // Authorization / scope
  "unauthorized",
  "forbidden",
  "cross_org_denied",
  "venture_not_found",
  "connection_not_found",
  "source_not_found",
  "connection_disabled",
  "connection_archived",

  // Network / crawl safety
  "blocked_private_network",
  "blocked_by_robots",
  "blocked_by_policy",
  "dns_resolution_failed",
  "network_error",
  "request_timeout",
  "http_client_error",
  "http_server_error",
  "response_too_large",
  "unsupported_content_type",

  // Sync lifecycle
  "sync_in_progress",
  "sync_rate_limited",
  "sync_duration_exceeded",
  "sync_cancelled",
  "sync_partial",

  // Parsing / ingestion
  "parse_failed",
  "ocr_required",
  "content_too_large",
  "csv_too_large",
  "json_too_large",
  "empty_content",

  // Persistence
  "persistence_failed",
  "version_conflict",

  // Internal
  "internal_error",
  "not_implemented",
] as const;

export type IntegrationErrorCode = (typeof INTEGRATION_ERROR_CODES)[number];

export class IntegrationError extends Error {
  readonly code: IntegrationErrorCode;
  readonly httpStatus?: number;
  readonly cause?: unknown;

  constructor(code: IntegrationErrorCode, message?: string, opts?: { httpStatus?: number; cause?: unknown }) {
    super(message ?? code);
    this.name = "IntegrationError";
    this.code = code;
    this.httpStatus = opts?.httpStatus;
    this.cause = opts?.cause;
  }
}

export function isIntegrationError(err: unknown): err is IntegrationError {
  return err instanceof IntegrationError;
}

// Convert any thrown value into a sanitized code, hiding provider details.
export function toIntegrationErrorCode(err: unknown): IntegrationErrorCode {
  if (isIntegrationError(err)) return err.code;
  return "internal_error";
}