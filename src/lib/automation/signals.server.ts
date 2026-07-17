// Bridge contract to the existing public.signals table. Nothing is emitted
// in 3D.2c-i - runner-driven emission lands in 3D.2c-ii. This module owns
// deterministic dedup keys, severity mapping, and eligibility rules.

import type { SignalSeverity } from "@/lib/constants";
import { buildSignalDedupKey } from "@/lib/signals/types";
import type { AutomationSignalPayload, AutomationSignalType } from "./types";

const SEVERITY_MAP: Record<AutomationSignalType, SignalSeverity> = {
  job_failed: "high",
  job_recovered: "low",
  automation_disabled: "medium",
  automation_health_degraded: "high",
  website_sync_completed: "info",
  website_change_detected: "medium",
  social_publish_succeeded: "info",
  social_publish_failed: "high",
  social_metrics_updated: "info",
  pipeline_blocked: "medium",
  repeated_failure: "high",
};

// Deterministic: signals of type X for the same job on the same day collapse.
export function automationSignalDedupKey(
  organizationId: string,
  payload: AutomationSignalPayload,
  dayIso?: string,
): string {
  const day = (dayIso ?? new Date().toISOString()).slice(0, 10);
  return buildSignalDedupKey({
    organizationId,
    signalType: payload.signalType,
    assetId: payload.assetId ?? null,
    contentItemId: null,
    fingerprint: [payload.jobId ?? "-", payload.automationDefinitionId ?? "-", day].join("|"),
  });
}

export function automationSignalSeverity(t: AutomationSignalType): SignalSeverity {
  return SEVERITY_MAP[t];
}

// Eligibility: skip noisy successes for maintenance-family jobs and only emit
// success signals for user-visible ones. Runner-visible predicate; consumers
// can override in later milestones as policies mature.
export function shouldEmitSignal(
  t: AutomationSignalType,
  ctx: { jobFamily?: string; consecutiveFailures?: number } = {},
): boolean {
  if (t === "website_sync_completed") return false; // routine success - do not flood
  if (t === "job_recovered") return (ctx.consecutiveFailures ?? 0) >= 2;
  if (t === "repeated_failure") return (ctx.consecutiveFailures ?? 0) >= 3;
  return true;
}