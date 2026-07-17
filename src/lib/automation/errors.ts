// Sanitized errors for the Automation / Job Engine. Never surface raw DB or
// provider errors to clients; map to one of these codes.

export const AUTOMATION_ERROR_CODES = [
  // Automation definitions
  "automation_not_found",
  "automation_disabled",
  "automation_paused",
  "invalid_automation_status",

  // Jobs
  "job_not_found",
  "job_not_implemented",
  "invalid_job_type",
  "invalid_job_status",
  "invalid_job_transition",
  "duplicate_active_job",
  "invalid_job_payload",
  "job_payload_too_large",
  "job_output_too_large",
  "invalid_priority",
  "invalid_trigger_type",
  "invalid_actor_type",
  "invalid_family",

  // Dependencies
  "dependency_not_found",
  "dependency_cycle",
  "dependency_depth_exceeded",
  "cross_org_dependency",
  "invalid_dependency_type",
  "self_dependency",
  "too_many_dependencies",

  // Attempts
  "attempt_not_found",
  "duplicate_attempt",
  "invalid_attempt_status",

  // Health
  "health_snapshot_invalid",

  // Scope / authorization
  "permission_denied",
  "record_unavailable",
  "invalid_scope",
  "cross_org_denied",

  // Runtime
  "rate_limited",
  "configuration_invalid",
  "internal_automation_error",

  // Retry classification (used by retry contracts)
  "unsafe_url",
  "private_network_blocked",
  "unsupported_scheme",
  "connection_revoked",
  "source_deleted",
  "malformed_input",
  "timeout",
  "temporary_network_failure",
  "external_rate_limit",
  "temporary_provider_failure",
  "worker_interrupted",
  "temporary_service_unavailable",
] as const;

export type AutomationErrorCode = (typeof AUTOMATION_ERROR_CODES)[number];

export class AutomationError extends Error {
  readonly code: AutomationErrorCode;
  readonly cause?: unknown;

  constructor(code: AutomationErrorCode, message?: string, opts?: { cause?: unknown }) {
    super(message ?? code);
    this.name = "AutomationError";
    this.code = code;
    this.cause = opts?.cause;
  }
}

export function isAutomationError(err: unknown): err is AutomationError {
  return err instanceof AutomationError;
}

export function toAutomationErrorCode(err: unknown): AutomationErrorCode {
  if (isAutomationError(err)) return err.code;
  return "internal_automation_error";
}

// Deterministic permanent-vs-transient classification. Consumers use this to
// decide retry eligibility. No provider input.
const PERMANENT: ReadonlySet<AutomationErrorCode> = new Set([
  "unsafe_url",
  "private_network_blocked",
  "unsupported_scheme",
  "configuration_invalid",
  "connection_revoked",
  "source_deleted",
  "permission_denied",
  "malformed_input",
  "invalid_job_payload",
  "invalid_job_type",
  "invalid_trigger_type",
  "invalid_actor_type",
  "invalid_family",
  "invalid_priority",
  "invalid_scope",
  "cross_org_denied",
  "cross_org_dependency",
  "self_dependency",
  "dependency_cycle",
  "dependency_depth_exceeded",
  "job_not_implemented",
  "automation_disabled",
  "automation_paused",
]);

const TRANSIENT: ReadonlySet<AutomationErrorCode> = new Set([
  "timeout",
  "temporary_network_failure",
  "external_rate_limit",
  "temporary_provider_failure",
  "worker_interrupted",
  "temporary_service_unavailable",
  "rate_limited",
]);

export function isPermanentErrorCode(code: AutomationErrorCode): boolean {
  return PERMANENT.has(code);
}

export function isTransientErrorCode(code: AutomationErrorCode): boolean {
  return TRANSIENT.has(code);
}