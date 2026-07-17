// Reusable operational constants for Northstar.
export const STALLED_PROJECT_DAYS = 7;
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "image/png",
  "image/jpeg",
  "image/webp",
];

// Centralized query and pagination limits.
export const LIMITS = {
  primaryList: 25,
  activityFeed: 20,
  searchPerCategory: 10,
  archivedList: 25,
  memberList: 50,
  sam: {
    maxMessageChars: 4000,
    maxHistoryMessages: 16,
    maxContextPerType: 12,
    maxResponseChars: 16000,
    perOrgPerDay: 200,
    perUserPerDay: 100,
  },
} as const;

// Debounce (ms) for typing-driven queries such as global search.
export const SEARCH_DEBOUNCE_MS = 200;

// ─────────────────────────────────────────────────────────────
// SAM framework version constants (Phase 3B)
// Stamped into audit rows so every invocation is reproducible.
// ─────────────────────────────────────────────────────────────
export const MEMORY_FRAMEWORK_VERSION = "sam.memory.v1.0.0";
export const MEMORY_PRECEDENCE_VERSION = "sam.memory.precedence.v1";
export const MEMORY_DECAY_VERSION = "sam.memory.decay.v1";
export const EXECUTIVE_GRAPH_VERSION = "sam.graph.v1.0.0";
export const GRAPH_TRAVERSAL_VERSION = "sam.graph.traversal.v1";
export const LEARNING_EVENT_SCHEMA_VERSION = "sam.learning.v1";
export const RESPONSE_FEEDBACK_VERSION = "sam.feedback.v1";
export const CONFIDENCE_FRAMEWORK_VERSION = "sam.confidence.v2";

export const SAM_MEMORY_LIMITS = {
  maxListPage: 100,
  maxProposalsPage: 50,
  maxContextPerLayer: 8,
  maxVersionHistory: 50,
  maxLearningEvents: 100,
  maxConflictsPerRun: 25,
} as const;

export const SAM_GRAPH_LIMITS = {
  maxDepth: 3,
  maxNodes: 200,
  maxEdges: 500,
  maxNeighbors: 50,
} as const;

// ─────────────────────────────────────────────────────────────
// SAM Workflow framework version constants (Phase 3C, Milestone 2)
// ─────────────────────────────────────────────────────────────
export const WORKFLOW_ENGINE_VERSION = "sam.workflow.engine.v1.0.0";
export const WORKFLOW_OUTPUT_SCHEMA_VERSION = "sam.workflow.output.v1";
export const WORKFLOW_CONTEXT_VERSION = "sam.workflow.context.v1";
export const WORKFLOW_AUDIT_VERSION = "sam.workflow.audit.v1";
export const WORKFLOW_CONFIDENCE_VERSION = "sam.workflow.confidence.v1";
export const WORKFLOW_REGISTRY_VERSION = "sam.workflow.registry.v1";

export const SAM_WORKFLOW_LIMITS = {
  maxHistoryPage: 50,
  maxFindingsPerRun: 50,
  maxCitationsPerRun: 100,
  maxContextPerType: 25,
  maxMemoryRetrieval: 30,
  maxGraphTraversalDepth: 2,
  maxHistoricalRuns: 5,
  maxOutputChars: 32000,
  duplicateWindowMinutes: 10,
  maxDateRangeDays: 366,
} as const;

export const WORKFLOW_DEFAULT_SETTINGS = {
  default_workflow_scope: "organization" as "organization" | "venture",
  weekly_review_start_day: 5, // Friday (0=Sunday)
  default_priority_limit: 10,
  include_uncertain_memory: false,
  include_archived_historical_evidence: false,
  show_workflow_confidence: true,
  show_workflow_citations: true,
  allow_provider_synthesis_fallback: true,
  workflow_retention_preference: "standard" as "minimal" | "standard" | "extended",
} as const;

// ─────────────────────────────────────────────────────────────
// SAM Workflow analyzer versions (Phase 3C, Milestone 3)
// ─────────────────────────────────────────────────────────────
export const DAILY_BRIEFING_VERSION = "sam.workflow.daily_briefing.v1.0.0";
export const WEEKLY_REVIEW_VERSION = "sam.workflow.weekly_review.v1.0.0";
export const DECISION_REVIEW_VERSION = "sam.workflow.decision_review.v1.0.0";
export const DAILY_BRIEFING_RULESET_VERSION = "sam.workflow.daily_briefing.rules.v1";
export const WEEKLY_REVIEW_RULESET_VERSION = "sam.workflow.weekly_review.rules.v1";
export const DECISION_REVIEW_RULESET_VERSION = "sam.workflow.decision_review.rules.v1";
export const WORKFLOW_FINDING_SCHEMA_VERSION = "sam.workflow.finding.v1";
export const WORKFLOW_SYNTHESIS_SCHEMA_VERSION = "sam.workflow.synthesis.v1";

export const SAM_WORKFLOW_THRESHOLDS = {
  dueSoonDays: 3,
  staleProjectDays: 7,
  staleGoalDays: 14,
  staleMemoryDays: 90,
  postponementConcernCount: 2,
  behindProgressRatio: 0.15,
  minReliabilitySamples: 5,
  weeklyReviewMinDays: 3,
  weeklyReviewMaxDays: 21,
} as const;

// ─────────────────────────────────────────────────────────────
// Phase 3D - Integration + Content Ingestion framework
// ─────────────────────────────────────────────────────────────
export const INTEGRATION_FRAMEWORK_VERSION = "northstar.integrations.v1.0.0";
export const CONTENT_INGESTION_VERSION = "northstar.ingestion.v1.0.0";
export const CONTENT_NORMALIZATION_VERSION = "northstar.ingestion.normalization.v1";
export const CONTENT_FRESHNESS_VERSION = "northstar.ingestion.freshness.v1";

export const INTEGRATION_LIMITS = {
  // Website crawling
  maxPagesPerSync: 50,
  maxCrawlDepth: 3,
  maxResponseBytes: 5 * 1024 * 1024, // 5 MB per page
  requestTimeoutMs: 15_000,
  maxConcurrentFetches: 3,

  // File uploads (aligned with document ingestion, but scoped here for clarity)
  maxFileBytes: 25 * 1024 * 1024, // 25 MB
  maxCsvRows: 10_000,
  maxJsonItems: 10_000,
  maxContentTextChars: 500_000,

  // Sync execution
  maxSyncDurationMs: 120_000,
  maxSourcesPerVenture: 100,
  manualSyncMinIntervalMs: 30_000,

  // Listing
  maxConnectionsList: 100,
  maxSourcesList: 200,
  maxSyncRunsList: 50,
  maxContentItemsList: 100,
  maxVersionHistory: 25,
} as const;

// Content freshness thresholds (days since last successful ingest).
export const CONTENT_FRESHNESS_THRESHOLDS = {
  agingAfterDays: 30,
  staleAfterDays: 90,
} as const;

// Review states for the Content Inbox.
export const CONTENT_REVIEW_STATES = [
  "pending",
  "reviewed",
  "accepted",
  "rejected",
  "archived",
] as const;
export type ContentReviewState = (typeof CONTENT_REVIEW_STATES)[number];

// Trust levels for sources.
export const SOURCE_TRUST_LEVELS = [
  "unverified",
  "reviewed",
  "verified",
  "official",
] as const;
export type SourceTrustLevel = (typeof SOURCE_TRUST_LEVELS)[number];

// Content categories used for website source classification and content mapping.
export const CONTENT_CATEGORIES = [
  "company_overview",
  "product",
  "service",
  "pricing",
  "team",
  "policy",
  "help",
  "blog",
  "news",
  "marketing",
  "legal",
  "documentation",
  "other",
] as const;
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];