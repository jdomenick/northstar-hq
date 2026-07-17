// Audit contract helpers. Persistence lands with the runner in 3D.2c-ii; this
// module owns the safe metadata builder so nothing sensitive ever reaches
// automation_job_events or future audit tables.

import { AUTOMATION_LIMITS } from "@/lib/constants";
import { AutomationError } from "./errors";
import type { AuditMetadata, AutomationAuditEvent } from "./types";

// Field names we always strip out even if a caller passes them in extra.
const FORBIDDEN_KEYS = new Set([
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "apikey",
  "authorization",
  "credential",
  "credentials",
  "cookie",
  "provider_payload",
  "provider_raw",
  "stack",
  "stack_trace",
  "reasoning",
  "prompt",
  "system_prompt",
  "raw_response",
]);

function sanitizeExtra(input: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!input) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) continue;
    if (v === undefined) continue;
    // Reject nested "credentials"-like shapes best-effort.
    if (typeof v === "object" && v !== null) {
      const nested = sanitizeExtra(v as Record<string, unknown>);
      out[k] = nested;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface SafeAuditEntry {
  event: AutomationAuditEvent;
  metadata: Record<string, unknown>;
}

export function buildAuditEntry(event: AutomationAuditEvent, meta: AuditMetadata): SafeAuditEntry {
  const merged: Record<string, unknown> = {
    automation_key: meta.automationKey,
    job_type: meta.jobType,
    handler_version: meta.handlerVersion,
    policy_version: meta.policyVersion,
    attempt_number: meta.attemptNumber,
    duration_ms: meta.durationMs,
    error_code: meta.errorCode,
    trigger_type: meta.triggerType,
    actor_type: meta.actorType,
    ...sanitizeExtra(meta.extra),
  };

  // Drop undefined keys.
  for (const k of Object.keys(merged)) {
    if (merged[k] === undefined) delete merged[k];
  }

  const encoded = JSON.stringify(merged);
  if (encoded.length > AUTOMATION_LIMITS.maxEventMetadataBytes) {
    throw new AutomationError("job_output_too_large", "audit metadata exceeds limit");
  }
  return { event, metadata: merged };
}

// Deterministic event_key builder used by future runner writes so a retried
// event insert idempotently upserts against the (job_id, event_type, event_key)
// unique index.
export function buildEventKey(parts: {
  jobId: string;
  event: AutomationAuditEvent;
  attemptNumber?: number;
  discriminator?: string;
}): string {
  return [
    parts.jobId,
    parts.event,
    parts.attemptNumber ?? "-",
    parts.discriminator ?? "-",
  ].join("|");
}