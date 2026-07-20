// Central Job Registry. Every job type must be registered here before any
// runner is willing to execute it. Unimplemented jobs remain honestly marked
// so future execution paths fail with job_not_implemented.

import { z } from "zod";
import { AutomationError } from "./errors";
import type { JobDefinition } from "./types";

const REGISTRY = new Map<string, JobDefinition>();

export function registerJob(def: JobDefinition): void {
  if (REGISTRY.has(def.key)) {
    throw new Error(`Job already registered: ${def.key}`);
  }
  REGISTRY.set(def.key, def);
}

export function getJobDefinition(key: string): JobDefinition {
  const d = REGISTRY.get(key);
  if (!d) throw new AutomationError("invalid_job_type", `Unknown job type: ${key}`);
  return d;
}

export function tryGetJobDefinition(key: string): JobDefinition | null {
  return REGISTRY.get(key) ?? null;
}

export function listJobDefinitions(): JobDefinition[] {
  return Array.from(REGISTRY.values());
}

export function assertJobImplemented(key: string): JobDefinition {
  const d = getJobDefinition(key);
  if (d.implementationStatus !== "implemented") {
    throw new AutomationError("job_not_implemented", `Job type not implemented: ${key}`);
  }
  return d;
}

// ── Register all planned job types honestly. Nothing is "implemented" in
// 3D.2c-i; execution paths land in 3D.2c-ii and beyond.

const permissiveSchema = z.record(z.string(), z.unknown()).default({});

type Registration = Pick<
  JobDefinition,
  | "key"
  | "displayName"
  | "family"
  | "supportedScopes"
  | "defaultPriority"
  | "defaultTimeoutSeconds"
  | "defaultMaxAttempts"
  | "retryPolicy"
  | "idempotencyStrategy"
  | "dependencyBehavior"
  | "createsExternalSideEffects"
  | "mayRequireApproval"
  | "handlerVersion"
>;

function notYet(reg: Registration): void {
  registerJob({
    ...reg,
    implementationStatus: "not_implemented",
    inputSchema: permissiveSchema,
    outputSchema: permissiveSchema,
  });
}

// Integration family
// website_sync is the first implemented handler (3D.2c-ii). Handler lives
// in src/lib/automation/jobs/website-sync.server.ts and self-registers
// when src/lib/automation/executor.server.ts is loaded.
registerJob({
  key: "website_sync",
  displayName: "Website Sync",
  family: "integration",
  supportedScopes: ["integration"],
  defaultPriority: "normal",
  defaultTimeoutSeconds: 300,
  defaultMaxAttempts: 4,
  retryPolicy: { kind: "exponential", maxAttempts: 4, baseDelaySeconds: 60, maxDelaySeconds: 1800 },
  idempotencyStrategy: "org_source_window",
  dependencyBehavior: "independent",
  createsExternalSideEffects: false,
  mayRequireApproval: false,
  handlerVersion: "v1",
  implementationStatus: "implemented",
  inputSchema: permissiveSchema,
  outputSchema: permissiveSchema,
});
notYet({ key: "website_discovery", displayName: "Website Discovery", family: "integration",
  supportedScopes: ["integration"], defaultPriority: "normal", defaultTimeoutSeconds: 300,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "one_active_per_scope", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "source_freshness_recompute", displayName: "Source Freshness Recompute", family: "integration",
  supportedScopes: ["organization","venture"], defaultPriority: "low", defaultTimeoutSeconds: 120,
  defaultMaxAttempts: 2, retryPolicy: { kind: "fixed", maxAttempts: 2, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "integration_health_recompute", displayName: "Integration Health Recompute", family: "integration",
  supportedScopes: ["organization"], defaultPriority: "low", defaultTimeoutSeconds: 120,
  defaultMaxAttempts: 2, retryPolicy: { kind: "fixed", maxAttempts: 2, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });

// Intelligence / knowledge
// intelligence.sweep is implemented (Phase 3C). Handler self-registers
// via src/lib/automation/jobs/intelligence-sweep.server.ts, loaded from
// executor.server.ts. Runs deterministic executive detectors, updates
// insights/recommendations/health/digest. Idempotent by unique (org, pattern_key, entity_ref).
registerJob({
  key: "intelligence.sweep",
  displayName: "Executive Intelligence Sweep",
  family: "intelligence",
  supportedScopes: ["organization"],
  defaultPriority: "normal",
  defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 3,
  retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60, maxDelaySeconds: 900 },
  idempotencyStrategy: "org_type_key",
  dependencyBehavior: "aggregating",
  createsExternalSideEffects: false,
  mayRequireApproval: false,
  handlerVersion: "v1",
  implementationStatus: "implemented",
  inputSchema: permissiveSchema,
  outputSchema: permissiveSchema,
});

// SAM proof mission: end-to-end deterministic proof workflow. Requires no
// external connectors. Idempotent via caller-supplied key.
registerJob({
  key: "sam.proof_mission",
  displayName: "SAM Proof Mission",
  family: "sam",
  supportedScopes: ["organization", "venture"],
  defaultPriority: "high",
  defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 2,
  retryPolicy: { kind: "exponential", maxAttempts: 2, baseDelaySeconds: 30 },
  idempotencyStrategy: "org_type_key",
  dependencyBehavior: "independent",
  createsExternalSideEffects: false,
  mayRequireApproval: false,
  handlerVersion: "v1",
  implementationStatus: "implemented",
  inputSchema: permissiveSchema,
  outputSchema: permissiveSchema,
});
notYet({ key: "content_classification", displayName: "Content Classification", family: "intelligence",
  supportedScopes: ["organization","venture"], defaultPriority: "normal", defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 30 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "chained",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "content_change_analysis", displayName: "Content Change Analysis", family: "intelligence",
  supportedScopes: ["organization","venture"], defaultPriority: "normal", defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 30 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "chained",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "signal_processing", displayName: "Signal Processing", family: "intelligence",
  supportedScopes: ["organization","venture"], defaultPriority: "normal", defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 30 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "knowledge_promotion", displayName: "Knowledge Promotion", family: "knowledge",
  supportedScopes: ["organization","venture"], defaultPriority: "normal", defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 30 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "chained",
  createsExternalSideEffects: false, mayRequireApproval: true, handlerVersion: "v0" });
notYet({ key: "contradiction_review", displayName: "Contradiction Review", family: "knowledge",
  supportedScopes: ["organization","venture"], defaultPriority: "normal", defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 2, retryPolicy: { kind: "fixed", maxAttempts: 2, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: true, handlerVersion: "v0" });
notYet({ key: "notification_digest", displayName: "Notification Digest", family: "notification",
  supportedScopes: ["organization","venture"], defaultPriority: "low", defaultTimeoutSeconds: 60,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 30 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: true, mayRequireApproval: false, handlerVersion: "v0" });

// SAM
notYet({ key: "sam_daily_briefing", displayName: "SAM Daily Briefing", family: "sam",
  supportedScopes: ["organization"], defaultPriority: "high", defaultTimeoutSeconds: 240,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "sam_weekly_review", displayName: "SAM Weekly Review", family: "sam",
  supportedScopes: ["organization"], defaultPriority: "high", defaultTimeoutSeconds: 300,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "sam_risk_review", displayName: "SAM Risk Review", family: "sam",
  supportedScopes: ["organization","venture"], defaultPriority: "high", defaultTimeoutSeconds: 240,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "sam_venture_health", displayName: "SAM Venture Health", family: "sam",
  supportedScopes: ["venture"], defaultPriority: "normal", defaultTimeoutSeconds: 240,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "sam_organization_health", displayName: "SAM Organization Health", family: "sam",
  supportedScopes: ["organization"], defaultPriority: "normal", defaultTimeoutSeconds: 300,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });

// Social - all pending live connectors
const socialCommon = {
  family: "social" as const,
  supportedScopes: ["venture"] as ("organization"|"venture"|"asset"|"integration")[],
  defaultTimeoutSeconds: 240,
  defaultMaxAttempts: 3,
  retryPolicy: { kind: "exponential" as const, maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key" as const,
  handlerVersion: "v0",
};
notYet({ ...socialCommon, key: "social_content_plan", displayName: "Social Content Plan",
  defaultPriority: "normal", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: true });
notYet({ ...socialCommon, key: "social_content_generate", displayName: "Social Content Generate",
  defaultPriority: "normal", dependencyBehavior: "chained",
  createsExternalSideEffects: false, mayRequireApproval: true });
notYet({ ...socialCommon, key: "social_content_review", displayName: "Social Content Review",
  defaultPriority: "normal", dependencyBehavior: "chained",
  createsExternalSideEffects: false, mayRequireApproval: true });
// social_publish: implemented in 6a as a gated skeleton. Handler enforces
// the nine pre-publish gates and stays disarmed unless BEEHIIV_PUBLISH_ARMED.
registerJob({
  ...socialCommon,
  key: "social_publish",
  displayName: "Social Publish",
  defaultPriority: "high",
  dependencyBehavior: "chained",
  createsExternalSideEffects: true,
  mayRequireApproval: true,
  handlerVersion: "beehiiv.publish.v1-6a",
  implementationStatus: "implemented",
  inputSchema: permissiveSchema,
  outputSchema: permissiveSchema,
});
notYet({ ...socialCommon, key: "social_metrics_sync", displayName: "Social Metrics Sync",
  defaultPriority: "normal", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false });
notYet({ ...socialCommon, key: "social_performance_analysis", displayName: "Social Performance Analysis",
  defaultPriority: "normal", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false });
notYet({ ...socialCommon, key: "social_content_repurpose", displayName: "Social Content Repurpose",
  defaultPriority: "low", dependencyBehavior: "chained",
  createsExternalSideEffects: false, mayRequireApproval: true });
notYet({ ...socialCommon, key: "social_comment_monitor", displayName: "Social Comment Monitor",
  defaultPriority: "normal", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false });
notYet({ ...socialCommon, key: "social_engagement_summary", displayName: "Social Engagement Summary",
  defaultPriority: "low", dependencyBehavior: "aggregating",
  createsExternalSideEffects: false, mayRequireApproval: false });

// Document / memory / analytics / financial
notYet({ key: "document_process", displayName: "Document Process", family: "document",
  supportedScopes: ["organization","venture"], defaultPriority: "normal", defaultTimeoutSeconds: 300,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 30 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "memory_maintenance", displayName: "Memory Maintenance", family: "memory",
  supportedScopes: ["organization"], defaultPriority: "background", defaultTimeoutSeconds: 120,
  defaultMaxAttempts: 2, retryPolicy: { kind: "fixed", maxAttempts: 2, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "knowledge_maintenance", displayName: "Knowledge Maintenance", family: "knowledge",
  supportedScopes: ["organization"], defaultPriority: "background", defaultTimeoutSeconds: 180,
  defaultMaxAttempts: 2, retryPolicy: { kind: "fixed", maxAttempts: 2, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "analytics_refresh", displayName: "Analytics Refresh", family: "analytics",
  supportedScopes: ["organization","venture"], defaultPriority: "normal", defaultTimeoutSeconds: 300,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });
notYet({ key: "financial_refresh", displayName: "Financial Refresh", family: "financial",
  supportedScopes: ["organization","venture"], defaultPriority: "high", defaultTimeoutSeconds: 300,
  defaultMaxAttempts: 3, retryPolicy: { kind: "exponential", maxAttempts: 3, baseDelaySeconds: 60 },
  idempotencyStrategy: "org_type_key", dependencyBehavior: "independent",
  createsExternalSideEffects: false, mayRequireApproval: false, handlerVersion: "v0" });