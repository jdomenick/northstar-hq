// Concurrency contracts. The atomic claim RPC lands in 3D.2c-ii. This module
// only documents the eligibility, ordering, and lock semantics that runner
// implementations must honor.

import { AUTOMATION_LIMITS, JOB_PRIORITY_WEIGHT, type JobPriority, type JobState } from "@/lib/constants";

// States a worker may attempt to claim. Anything else is filtered out.
export const CLAIMABLE_STATES: readonly JobState[] = ["queued", "retrying"];

// Ordering: priority weight ASC (critical=0 first), then available_at ASC,
// then scheduled_for ASC, then created_at ASC (natural tiebreaker via id).
export interface ClaimOrderingHint {
  priorityWeight: number;
  availableAtIso: string;
  scheduledForIso: string;
}

export function priorityWeight(priority: JobPriority): number {
  return JOB_PRIORITY_WEIGHT[priority];
}

// Worker-lease shape. Runner implementations must set worker_id + started_at
// atomically as part of the claim; stale claims are recovered when
// now - started_at > timeout_seconds.
export interface WorkerLease {
  workerId: string;
  leasedAt: string;
  timeoutSeconds: number;
}

export interface OrgConcurrencyCaps {
  maxConcurrentPerOrg: number;
  maxConcurrentPerVenture: number;
}

export const DEFAULT_CONCURRENCY_CAPS: OrgConcurrencyCaps = {
  maxConcurrentPerOrg: AUTOMATION_LIMITS.maxConcurrentJobsPerOrg,
  maxConcurrentPerVenture: AUTOMATION_LIMITS.maxConcurrentJobsPerVenture,
};

// Deterministic staleness check: a running job is stale if it has been
// running for longer than its timeout with a safety margin. Recovery is
// implemented in 3D.2c-ii.
export function isStaleRunningJob(
  startedAtIso: string | null,
  timeoutSeconds: number,
  nowMs = Date.now(),
): boolean {
  if (!startedAtIso) return false;
  const started = Date.parse(startedAtIso);
  if (Number.isNaN(started)) return false;
  const graceMs = Math.max(timeoutSeconds, 30) * 1000 * 1.5;
  return nowMs - started > graceMs;
}