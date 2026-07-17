// Automation / Job Engine framework types. Provider-neutral and
// connector-neutral. No AI SDK imports allowed here.

import type { z } from "zod";
import type {
  AutomationDefinitionState,
  AutomationHealthBand,
  JobActorType,
  JobAttemptState,
  JobDependencyType,
  JobFamily,
  JobPriority,
  JobState,
  JobTriggerType,
} from "@/lib/constants";

// ─────────────────────────────────────────────
// Scope
// ─────────────────────────────────────────────

export interface AutomationScope {
  organizationId: string;
  ventureId: string | null;
  assetId?: string | null;
  integrationConnectionId?: string | null;
  integrationSourceId?: string | null;
}

export type SupportedScope = "organization" | "venture" | "asset" | "integration";

// ─────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────

export type JobImplementationStatus =
  | "implemented"
  | "not_implemented"
  | "deprecated";

export type IdempotencyStrategy =
  | "org_type_key"          // (org, job_type, idempotency_key) unique among active
  | "org_source_window"     // narrower - handler computes its own key
  | "one_active_per_scope"  // e.g. one at a time per venture
  | "none";

export type DependencyBehavior =
  | "independent"
  | "chained"       // creates or awaits a parent
  | "fan_out"       // creates multiple children
  | "aggregating";  // waits on multiple siblings

export type RetryPolicyKind = "none" | "fixed" | "exponential";

export interface RetryPolicy {
  kind: RetryPolicyKind;
  maxAttempts: number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
}

export interface JobDefinition {
  key: string;
  displayName: string;
  family: JobFamily;
  implementationStatus: JobImplementationStatus;
  supportedScopes: SupportedScope[];
  defaultPriority: JobPriority;
  defaultTimeoutSeconds: number;
  defaultMaxAttempts: number;
  retryPolicy: RetryPolicy;
  idempotencyStrategy: IdempotencyStrategy;
  dependencyBehavior: DependencyBehavior;
  createsExternalSideEffects: boolean;
  mayRequireApproval: boolean;
  handlerVersion: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  description?: string;
}

// ─────────────────────────────────────────────
// Domain records (framework shapes; DB rows have snake_case)
// ─────────────────────────────────────────────

export interface AutomationDefinitionDescriptor {
  id: string;
  organizationId: string;
  ventureId: string | null;
  assetId: string | null;
  integrationConnectionId: string | null;
  name: string;
  automationKey: string;
  automationFamily: JobFamily;
  status: AutomationDefinitionState;
  enabled: boolean;
  triggerType: JobTriggerType;
  scheduleExpression: string | null;
  timezone: string;
  priority: JobPriority;
  configuration: Record<string, unknown>;
  policy: Record<string, unknown>;
  ownerId: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  nextRunAt: string | null;
  consecutiveFailures: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobDescriptor {
  id: string;
  organizationId: string;
  ventureId: string | null;
  assetId: string | null;
  automationDefinitionId: string | null;
  integrationConnectionId: string | null;
  integrationSourceId: string | null;
  parentJobId: string | null;
  rootJobId: string | null;
  jobType: string;
  jobFamily: JobFamily;
  status: JobState;
  priority: JobPriority;
  triggerType: JobTriggerType;
  scheduledFor: string;
  availableAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attemptNumber: number;
  maxAttempts: number;
  timeoutSeconds: number;
  idempotencyKey: string;
  inputPayload: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  errorCode: string | null;
  retryAfter: string | null;
  createdBy: string | null;
  actorType: JobActorType;
  handlerVersion: string;
  policyVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobAttemptDescriptor {
  id: string;
  organizationId: string;
  jobId: string;
  attemptNumber: number;
  status: JobAttemptState;
  workerId: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorCode: string | null;
  provider: string | null;
  externalReference: string | null;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface JobEventDescriptor {
  id: string;
  organizationId: string;
  jobId: string;
  eventType: string;
  eventKey: string | null;
  actorType: JobActorType;
  actorId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface JobDependencyDescriptor {
  id: string;
  organizationId: string;
  jobId: string;
  dependsOnJobId: string;
  dependencyType: JobDependencyType;
  requiredStatus: JobState | null;
  createdAt: string;
}

export interface HealthSnapshotDescriptor {
  id: string;
  organizationId: string;
  ventureId: string | null;
  automationDefinitionId: string | null;
  healthScore: number;
  healthBand: AutomationHealthBand;
  signalBreakdown: Record<string, unknown>;
  calculatedAt: string;
  version: string;
}

// ─────────────────────────────────────────────
// Transition contract (documented; enforced by helper)
// ─────────────────────────────────────────────

export const VALID_JOB_TRANSITIONS: Readonly<Record<JobState, readonly JobState[]>> = {
  queued: ["running", "cancelled", "blocked", "scheduled"],
  scheduled: ["queued", "cancelled", "blocked"],
  blocked: ["queued", "cancelled"],
  running: ["succeeded", "failed", "retrying", "expired", "cancelled"],
  retrying: ["queued", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
  skipped: [],
  expired: [],
};

export function isValidJobTransition(from: JobState, to: JobState): boolean {
  return VALID_JOB_TRANSITIONS[from].includes(to);
}

// ─────────────────────────────────────────────
// Signal contract (bridge into existing signals table)
// ─────────────────────────────────────────────

export const AUTOMATION_SIGNAL_TYPES = [
  "job_failed",
  "job_recovered",
  "automation_disabled",
  "automation_health_degraded",
  "website_sync_completed",
  "website_change_detected",
  "social_publish_succeeded",
  "social_publish_failed",
  "social_metrics_updated",
  "pipeline_blocked",
  "repeated_failure",
] as const;
export type AutomationSignalType = (typeof AUTOMATION_SIGNAL_TYPES)[number];

export interface AutomationSignalPayload {
  signalType: AutomationSignalType;
  jobId?: string;
  automationDefinitionId?: string;
  ventureId?: string | null;
  assetId?: string | null;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Audit contract
// ─────────────────────────────────────────────

export const AUTOMATION_AUDIT_EVENTS = [
  "automation_created",
  "automation_updated",
  "automation_enabled",
  "automation_disabled",
  "job_created",
  "job_claimed",
  "job_started",
  "attempt_started",
  "attempt_completed",
  "job_succeeded",
  "job_failed",
  "retry_scheduled",
  "job_recovered",
  "job_cancelled",
  "dependency_blocked",
  "pipeline_triggered",
  "signal_created",
  "health_recalculated",
] as const;
export type AutomationAuditEvent = (typeof AUTOMATION_AUDIT_EVENTS)[number];

export interface AuditMetadata {
  automationKey?: string;
  jobType?: string;
  handlerVersion?: string;
  policyVersion?: string;
  attemptNumber?: number;
  durationMs?: number;
  errorCode?: string;
  triggerType?: JobTriggerType;
  actorType?: JobActorType;
  extra?: Record<string, unknown>;
}