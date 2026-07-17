// Deterministic retry contracts. Executed retries land in 3D.2c-ii. This
// module owns eligibility, delay calculation, and error classification only.

import { AUTOMATION_LIMITS } from "@/lib/constants";
import { isPermanentErrorCode, isTransientErrorCode, type AutomationErrorCode } from "./errors";
import type { RetryPolicy } from "./types";

export interface RetryDecision {
  shouldRetry: boolean;
  nextAttempt: number;
  delaySeconds: number;
  reason: "permanent" | "exhausted" | "transient" | "unknown";
}

export function classifyError(code: AutomationErrorCode): "permanent" | "transient" | "unknown" {
  if (isPermanentErrorCode(code)) return "permanent";
  if (isTransientErrorCode(code)) return "transient";
  return "unknown";
}

export function computeRetryDelaySeconds(policy: RetryPolicy, attemptNumber: number): number {
  const base = Math.max(policy.baseDelaySeconds ?? 30, 1);
  const cap = Math.max(policy.maxDelaySeconds ?? 3600, base);
  switch (policy.kind) {
    case "none":
      return 0;
    case "fixed":
      return Math.min(base, cap);
    case "exponential": {
      const raw = base * Math.pow(2, Math.max(attemptNumber - 1, 0));
      return Math.min(raw, cap);
    }
  }
}

export function decideRetry(
  policy: RetryPolicy,
  attemptNumber: number,
  errorCode: AutomationErrorCode,
): RetryDecision {
  const cls = classifyError(errorCode);
  const maxAttempts = Math.min(policy.maxAttempts, AUTOMATION_LIMITS.maxAttempts);

  if (cls === "permanent") {
    return { shouldRetry: false, nextAttempt: attemptNumber, delaySeconds: 0, reason: "permanent" };
  }
  if (attemptNumber >= maxAttempts) {
    return { shouldRetry: false, nextAttempt: attemptNumber, delaySeconds: 0, reason: "exhausted" };
  }
  const nextAttempt = attemptNumber + 1;
  const delay = computeRetryDelaySeconds(policy, nextAttempt);
  return {
    shouldRetry: true,
    nextAttempt,
    delaySeconds: delay,
    reason: cls === "transient" ? "transient" : "unknown",
  };
}

// Deterministic ISO retry-after timestamp given "now" and delay.
export function computeRetryAfterIso(nowMs: number, delaySeconds: number): string {
  return new Date(nowMs + delaySeconds * 1000).toISOString();
}