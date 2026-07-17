// SAM Workflow types & Zod contracts (Phase 3C Milestone 2).
// See docs/sam/08-workflows.md.

import { z } from "zod";

// ── Enums (mirror DB enums; keep in sync) ─────────────────────
export const WorkflowType = z.enum([
  "daily_briefing",
  "weekly_review",
  "decision_review",
  "commitment_review",
  "priority_planning",
  "risk_review",
  "goal_alignment",
  "venture_health",
  "organization_health",
]);
export type WorkflowType = z.infer<typeof WorkflowType>;

export const WorkflowStatus = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "archived",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;

export const WorkflowTriggerType = z.enum([
  "manual",
  "scheduled_future",
  "system_future",
]);
export type WorkflowTriggerType = z.infer<typeof WorkflowTriggerType>;

export const WorkflowScope = z.enum(["organization", "venture"]);
export type WorkflowScope = z.infer<typeof WorkflowScope>;

export const WorkflowFindingType = z.enum([
  "observation",
  "priority",
  "risk",
  "opportunity",
  "blocker",
  "decision_needed",
  "commitment_issue",
  "goal_issue",
  "contradiction",
  "recommendation",
  "missing_information",
]);
export type WorkflowFindingType = z.infer<typeof WorkflowFindingType>;

export const WorkflowSeverity = z.enum([
  "informational",
  "low",
  "medium",
  "high",
  "critical",
]);
export type WorkflowSeverity = z.infer<typeof WorkflowSeverity>;

export const WorkflowFeedbackType = z.enum([
  "useful",
  "partially_useful",
  "not_useful",
  "incorrect",
  "missing_context",
]);
export type WorkflowFeedbackType = z.infer<typeof WorkflowFeedbackType>;

export const WorkflowMinRole = z.enum(["viewer", "member", "executive", "admin", "owner"]);
export type WorkflowMinRole = z.infer<typeof WorkflowMinRole>;

// ── Client → Server run input ────────────────────────────────
// The client MUST NOT send an organization_id. Scope is resolved
// server-side from the caller's active membership.
export const WorkflowRunInput = z
  .object({
    workflowType: WorkflowType,
    scope: WorkflowScope.default("organization"),
    ventureId: z.string().uuid().nullable().optional(),
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    // Optional entity for workflows targeting a specific record
    // (decision_review, goal_alignment). Server verifies scope.
    entityId: z.string().uuid().optional(),
    trigger: WorkflowTriggerType.default("manual"),
    // Free-form additional inputs (server validates per workflow).
    extras: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type WorkflowRunInput = z.infer<typeof WorkflowRunInput>;

// ── Assembled context (superset; individual analyzers narrow) ─
export interface WorkflowContext {
  version: string;
  orgId: string;
  userId: string;
  scope: WorkflowScope;
  ventureId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  counts: Record<string, number>;
  countsBeforeTruncation: Record<string, number>;
  truncations: string[];
  omittedCategories: string[];
  ventures: ReadonlyArray<{ id: string; name: string; status: string | null }>;
  projects: ReadonlyArray<{ id: string; name: string; status: string | null; venture_id: string | null; updated_at: string }>;
  tasks: ReadonlyArray<{ id: string; title: string; status: string | null; due_date: string | null }>;
  goals: ReadonlyArray<{ id: string; title: string; status: string | null; target_date: string | null }>;
  decisions: ReadonlyArray<{ id: string; title: string; status: string | null; review_date: string | null }>;
  commitments: ReadonlyArray<{ id: string; title: string; status: string | null; due_date: string | null }>;
  knowledge: ReadonlyArray<{ id: string; title: string; verification_status: string | null; updated_at: string }>;
  documents: ReadonlyArray<{ id: string; title: string; file_type: string | null; updated_at: string }>;
  activity: ReadonlyArray<{ id: string; action: string; entity_type: string; created_at: string }>;
  memory: {
    trusted: ReadonlyArray<{ id: string; layer: string; title: string; statement: string; confidence: number }>;
    uncertain: ReadonlyArray<{ id: string; layer: string; title: string; statement: string }>;
    considered_ids: string[];
    selected_ids: string[];
    excluded_ids: string[];
    reliability_summary: { count: number; avg: number | null };
  };
  graph: {
    nodes: number;
    edges: number;
    depthReached: number;
    truncated: boolean;
  };
  historicalRuns: ReadonlyArray<{ id: string; workflow_type: string; completed_at: string | null; status: string; confidence_score: number | null }>;
  learningEvents: ReadonlyArray<{ event_type: string; created_at: string }>;
  settings: {
    include_uncertain_memory: boolean;
    include_archived_historical_evidence: boolean;
    default_priority_limit: number;
  };
}

// ── Deterministic + Provider synthesis result contracts ──────
export interface WorkflowDeterministicResult {
  ok: boolean;
  findings: WorkflowFinding[];
  counts: Record<string, number>;
  scores: Record<string, number>;
  missingInformation: string[];
  rulesTriggered: string[];
  citationCandidates: WorkflowCitationCandidate[];
  providerSynthesisPayload?: unknown; // structured data handed to the provider
  providerSynthesisNecessary: boolean;
  failureCode?: string;
}

export const WorkflowProviderSynthesis = z
  .object({
    executiveSummary: z.string().min(1).max(4000),
    narrative: z.string().max(16000).optional(),
    highlights: z.array(z.string().max(500)).max(20).optional(),
  })
  .strict();
export type WorkflowProviderSynthesis = z.infer<typeof WorkflowProviderSynthesis>;

// A single finding (deterministic output).
export interface WorkflowFinding {
  key: string; // stable id local to the run (used to link citations)
  finding_type: WorkflowFindingType;
  title: string;
  summary: string | null;
  severity: WorkflowSeverity;
  priority: number;
  confidence_score: number | null;
  confidence_band: string | null;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  structured_data: Record<string, unknown>;
  sort_order: number;
}

export interface WorkflowCitationCandidate {
  findingKey?: string;
  citation_type: "direct" | "supporting" | "background";
  entity_type: string;
  entity_id: string;
  title: string;
  href: string | null;
  relevance: string | null;
  lineage: Record<string, unknown>;
}

export interface WorkflowCitation extends WorkflowCitationCandidate {
  finding_id: string | null;
}

export interface WorkflowConfidence {
  score: number;
  band: "low" | "moderate" | "high" | "very_high";
  explanation: string;
  signals: Record<string, number>;
  version: string;
}

export interface WorkflowRunResult {
  runId: string;
  workflowType: WorkflowType;
  status: WorkflowStatus;
  executiveSummary: string | null;
  confidence: WorkflowConfidence | null;
  findings: WorkflowFinding[];
  citations: WorkflowCitation[];
  counts: {
    finding: number;
    recommendation: number;
    risk: number;
    citation: number;
    citation_rejected: number;
  };
  failureCode?: string;
}

// ── Registry & audit ─────────────────────────────────────────
export interface WorkflowDefinition {
  key: WorkflowType;
  displayName: string;
  description: string;
  version: string;
  active: boolean;
  supportedScopes: ReadonlyArray<WorkflowScope>;
  ventureRequired: boolean;
  supportsDateRange: boolean;
  minRole: WorkflowMinRole;
  maxContextRecords: number;
  deterministicAnalyzer: "not_implemented"; // Milestone 2 placeholder
  optionalProviderSynthesis: boolean;
  outputSchema: z.ZodTypeAny;
  requireCitations: boolean;
}

export interface WorkflowRegistryEntry extends WorkflowDefinition {
  registryVersion: string;
}

export interface WorkflowAuditMetadata {
  workflowType: WorkflowType;
  workflowVersion: string;
  registryVersion: string;
  trigger: WorkflowTriggerType;
  userId: string;
  orgId: string;
  ventureId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  countsBeforeTruncation: Record<string, number>;
  selectedCounts: Record<string, number>;
  truncations: string[];
  memoryConsideredIds: string[];
  memorySelectedIds: string[];
  memoryReliability: { count: number; avg: number | null };
  graphNodes: number;
  graphEdges: number;
  graphDepth: number;
  rulesTriggered: string[];
  provider: string | null;
  model: string | null;
  promptVersion: string;
  constitutionVersion: string;
  contextVersion: string;
  confidenceVersion: string;
  citationCount: number;
  rejectedCitationCount: number;
  findingCount: number;
  recommendationCount: number;
  riskCount: number;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  success: boolean;
  failureCode: string | null;
}