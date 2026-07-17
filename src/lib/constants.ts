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

// ─────────────────────────────────────────────────────────────
// AI COO Core framework version constants (Phase 3D.3)
// Stamped into operating context, executive assembler output,
// and future COO engine outputs so every calculation is reproducible.
// ─────────────────────────────────────────────────────────────
export const COO_CORE_VERSION = "coo.core.v1.0.0";
export const COO_OP_CONTEXT_VERSION = "coo.op-context.v1";
export const COO_VENTURE_CONTEXT_VERSION = "coo.venture-ctx.v1";
export const COO_EXECUTIVE_ASSEMBLER_VERSION = "coo.assembler.v1";
export const COO_MEMORY_EXTRACTION_VERSION = "coo.memory-extraction.v1";

export const COO_LIMITS = {
  maxHistoryPage: 50,
  maxPriorities: 12,
  maxRisks: 12,
  maxMetrics: 12,
  maxObjectives: 12,
  maxAssemblerTokens: 12000,
  maxContradictions: 25,
} as const;

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
export const CONTENT_CHANGE_DETECTION_VERSION = "northstar.ingestion.change.v1";
export const CONTENT_CLASSIFICATION_VERSION = "northstar.ingestion.classify.v1";
export const ASSET_MODEL_VERSION = "northstar.assets.v1.0.0";
export const SIGNAL_MODEL_VERSION = "northstar.signals.v1.0.0";
export const INTELLIGENCE_CENTER_VERSION = "northstar.intelligence.v1.0.0";

// Change significance thresholds (fraction of characters changed vs previous
// content plus deterministic structural signals). Pure - no provider synthesis.
export const CONTENT_CHANGE_THRESHOLDS = {
  minorRatio: 0.02,
  moderateRatio: 0.15,
  majorRatio: 0.4,
} as const;

// Extensible criticality/health/status labels used by assets. Not hardcoded
// enums; these are only display defaults - the DB uses text + CHECKs.
export const ASSET_CRITICALITY_LEVELS = ["low", "medium", "high", "critical"] as const;
export type AssetCriticality = (typeof ASSET_CRITICALITY_LEVELS)[number];
export const ASSET_HEALTH_STATES = ["unknown", "healthy", "degraded", "at_risk", "failing"] as const;
export type AssetHealth = (typeof ASSET_HEALTH_STATES)[number];
export const ASSET_STATUS_STATES = ["active", "paused", "archived", "error"] as const;
export type AssetStatus = (typeof ASSET_STATUS_STATES)[number];

// Signal taxonomy. Extensible - stored as text in DB. These are the initial
// deterministic signals the change-detection engine emits.
export const SIGNAL_TYPES = [
  "content_changed",
  "content_created",
  "content_removed",
  "freshness_stale",
  "freshness_inaccessible",
  "sync_failed",
  "sync_succeeded",
  "classification_changed",
  "other",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];
export const SIGNAL_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type SignalSeverity = (typeof SIGNAL_SEVERITIES)[number];

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

// ─────────────────────────────────────────────────────────────
// Phase 3D.2c-i - Automation Engine (Job Engine) core
// ─────────────────────────────────────────────────────────────
export const AUTOMATION_ENGINE_VERSION = "northstar.automation.v1.0.0";
export const AUTOMATION_REGISTRY_VERSION = "northstar.automation.registry.v1";
export const AUTOMATION_AUDIT_VERSION = "northstar.automation.audit.v1";
export const AUTOMATION_SIGNAL_VERSION = "northstar.automation.signal.v1";

export const JOB_STATES = [
  "queued",
  "scheduled",
  "blocked",
  "running",
  "retrying",
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
  "expired",
] as const;
export type JobState = (typeof JOB_STATES)[number];

// States where an idempotency key must remain unique per (org, job_type).
export const JOB_ACTIVE_STATES: readonly JobState[] = [
  "queued",
  "scheduled",
  "blocked",
  "running",
  "retrying",
];

export const JOB_TERMINAL_STATES: readonly JobState[] = [
  "succeeded",
  "failed",
  "cancelled",
  "skipped",
  "expired",
];

export const JOB_PRIORITIES = ["critical", "high", "normal", "low", "background"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

// Deterministic weights for future queue ordering. Lower = higher urgency.
export const JOB_PRIORITY_WEIGHT: Record<JobPriority, number> = {
  critical: 0,
  high: 10,
  normal: 20,
  low: 30,
  background: 40,
};

export const JOB_TRIGGER_TYPES = [
  "manual",
  "scheduled",
  "event",
  "dependency",
  "system",
  "retry",
  "recovery",
] as const;
export type JobTriggerType = (typeof JOB_TRIGGER_TYPES)[number];

export const JOB_ACTOR_TYPES = [
  "user",
  "system",
  "scheduler",
  "worker",
  "sam",
  "integration",
] as const;
export type JobActorType = (typeof JOB_ACTOR_TYPES)[number];

export const JOB_FAMILIES = [
  "integration",
  "intelligence",
  "knowledge",
  "memory",
  "sam",
  "social",
  "analytics",
  "financial",
  "document",
  "maintenance",
  "notification",
  "system",
] as const;
export type JobFamily = (typeof JOB_FAMILIES)[number];

export const AUTOMATION_DEFINITION_STATES = [
  "active",
  "paused",
  "disabled",
  "archived",
] as const;
export type AutomationDefinitionState = (typeof AUTOMATION_DEFINITION_STATES)[number];

export const AUTOMATION_HEALTH_BANDS = [
  "healthy",
  "watch",
  "degraded",
  "critical",
  "unknown",
] as const;
export type AutomationHealthBand = (typeof AUTOMATION_HEALTH_BANDS)[number];

export const JOB_ATTEMPT_STATES = [
  "running",
  "succeeded",
  "failed",
  "interrupted",
  "timed_out",
  "cancelled",
] as const;
export type JobAttemptState = (typeof JOB_ATTEMPT_STATES)[number];

export const JOB_DEPENDENCY_TYPES = [
  "requires_success",
  "requires_completion",
  "runs_after",
  "optional",
] as const;
export type JobDependencyType = (typeof JOB_DEPENDENCY_TYPES)[number];

// Centralized numeric limits so no magic numbers leak into handlers.
export const AUTOMATION_LIMITS = {
  maxQueuedJobsPerOrg: 5000,
  maxConcurrentJobsPerOrg: 8,
  maxConcurrentJobsPerVenture: 4,
  maxAttempts: 8,
  maxTimeoutSeconds: 86400, // 24h hard ceiling
  defaultTimeoutSeconds: 300,
  minTimeoutSeconds: 5,
  maxDependencyDepth: 8,
  maxDependenciesPerJob: 16,
  maxPipelineJobs: 32,
  maxJobPayloadBytes: 32 * 1024,
  maxOutputSummaryBytes: 32 * 1024,
  maxEventMetadataBytes: 8 * 1024,
  maxHealthPayloadBytes: 8 * 1024,
  maxSchedulerBatchSize: 100,
  maxJobsPerSchedulerRun: 250,
  maxRetriesPerHour: 60,
  maxStaleRecoveryBatch: 100,
  maxSignalsPerJob: 10,
  maxEventsPerJob: 200,
  minAutomationIntervalSeconds: 60,
  maxJobListPageSize: 100,
  maxIdempotencyKeyLength: 200,
} as const;

// ─────────────────────────────────────────────────────────────
// Phase 3D.2c-iii - Social Automation Domain
// ─────────────────────────────────────────────────────────────
export const SOCIAL_DOMAIN_VERSION = "northstar.social.v1.0.0";
export const SOCIAL_POLICY_VERSION = "northstar.social.policy.v1";
export const SOCIAL_REGISTRY_VERSION = "northstar.social.registry.v1";
export const SOCIAL_ELIGIBILITY_VERSION = "northstar.social.eligibility.v1";
export const SOCIAL_VALIDATION_VERSION = "northstar.social.validation.v1";
export const SOCIAL_RISK_VERSION = "northstar.social.risk.v1";
export const SOCIAL_DEDUP_VERSION = "northstar.social.dedup.v1";
export const SOCIAL_AUDIT_VERSION = "northstar.social.audit.v1";

export const SOCIAL_PLATFORMS = [
  "facebook","instagram","linkedin","x","threads","tiktok",
  "youtube","pinterest","reddit","bluesky","other",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_CONTENT_TYPES = [
  "text","image","carousel","short_video","long_video","story",
  "reel","article","link","poll","thread","community_post","other",
] as const;
export type SocialContentType = (typeof SOCIAL_CONTENT_TYPES)[number];

export const SOCIAL_AUTOMATION_MODES = [
  "draft_only","approval_required","auto_publish_approved_templates","full_automation",
] as const;
export type SocialAutomationMode = (typeof SOCIAL_AUTOMATION_MODES)[number];

export const SOCIAL_APPROVAL_POLICIES = [
  "human_required","campaign_preapproved","template_preapproved","policy_based","no_approval_required",
] as const;
export type SocialApprovalPolicy = (typeof SOCIAL_APPROVAL_POLICIES)[number];

export const SOCIAL_APPROVAL_STATUSES = [
  "not_required","pending","approved","rejected","changes_requested","expired","revoked",
] as const;
export type SocialApprovalStatus = (typeof SOCIAL_APPROVAL_STATUSES)[number];

export const SOCIAL_CONTENT_STATUSES = [
  "idea","draft","generated","needs_review","changes_requested","approved",
  "scheduled","publishing","published","failed","paused","cancelled","archived",
] as const;
export type SocialContentStatus = (typeof SOCIAL_CONTENT_STATUSES)[number];

export const SOCIAL_MEDIA_STATUSES = [
  "not_required","required","pending","ready","failed","unavailable",
] as const;
export type SocialMediaStatus = (typeof SOCIAL_MEDIA_STATUSES)[number];

export const SOCIAL_RISK_BANDS = ["low","moderate","high","critical","unknown"] as const;
export type SocialRiskBand = (typeof SOCIAL_RISK_BANDS)[number];

export const SOCIAL_ACCOUNT_CONNECTION_STATUSES = [
  "disconnected","pending","connected","degraded","expired","revoked","error","archived",
] as const;
export type SocialAccountConnectionStatus = (typeof SOCIAL_ACCOUNT_CONNECTION_STATUSES)[number];

export const SOCIAL_BRAND_PROFILE_STATUSES = [
  "draft","pending_review","approved","active","superseded","archived",
] as const;
export type SocialBrandProfileStatus = (typeof SOCIAL_BRAND_PROFILE_STATUSES)[number];

export const SOCIAL_CAMPAIGN_STATUSES = [
  "draft","pending_approval","approved","active","paused","completed","cancelled","archived",
] as const;
export type SocialCampaignStatus = (typeof SOCIAL_CAMPAIGN_STATUSES)[number];

export const SOCIAL_PLAN_STATUSES = [
  "draft","pending_review","approved","active","completed","cancelled","archived",
] as const;
export type SocialPlanStatus = (typeof SOCIAL_PLAN_STATUSES)[number];

export const SOCIAL_PUBLICATION_STATUSES = [
  "pending","validating","publishing","succeeded","failed","rate_limited","rejected","cancelled","unknown",
] as const;
export type SocialPublicationStatus = (typeof SOCIAL_PUBLICATION_STATUSES)[number];

export const SOCIAL_LIMITS = {
  maxAccountsPerOrg: 50,
  maxAccountsPerVenture: 25,
  maxBrandProfilesPerVenture: 100,
  maxActiveBrandProfilesPerVenture: 1,
  maxBrandProfileBytes: 64 * 1024,
  maxCampaignsPerVenture: 200,
  maxPlansPerCampaign: 50,
  maxContentItemsPerPlan: 500,
  maxContentVersions: 100,
  maxHashtags: 30,
  maxLineageReferences: 25,
  maxApprovedExamples: 25,
  maxRejectedExamples: 25,
  maxProhibitedTopics: 100,
  maxRestrictedTopics: 100,
  maxRequiredDisclaimers: 25,
  maxApprovedLinks: 100,
  maxScheduledHorizonDays: 365,
  maxPostsPerOrgPerDay: 200,
  maxPostsPerVenturePerDay: 100,
  maxPostsPerAccountPerDay: 25,
  maxPublicationAttempts: 8,
  maxMetricsSnapshotsLoaded: 200,
  maxContentBodyBytes: 32 * 1024,
  maxFirstCommentBytes: 8 * 1024,
  maxMetadataBytes: 8 * 1024,
  maxMediaItems: 10,
  duplicateLookbackDays: 90,
  maxAuditMetadataBytes: 8 * 1024,
  maxRiskReasons: 20,
  maxValidationWarnings: 30,
  maxCredentialReferenceLength: 200,
} as const;