// Phase 3C - SAM Executive Intelligence
//
// Shared, purely-typed contract for detectors, recommendations, health, and
// digests. Nothing here touches the database; every field is deterministic.

export const INTELLIGENCE_VERSION = "sam.intelligence.v1.0.0" as const;
export const PATTERN_VERSION = "sam.patterns.v1.0.0" as const;
export const RECOMMENDATION_VERSION = "sam.recommendations.v1.0.0" as const;
export const HEALTH_METHOD_VERSION = "sam.health.v1.0.0" as const;
export const DIGEST_METHOD_VERSION = "sam.digest.v1.0.0" as const;

export type InsightPriority = "low" | "normal" | "high" | "critical";

export const PATTERN_KEYS = [
  "stalled_project",
  "inactive_venture",
  "postponed_commitment",
  "missing_owner",
  "duplicate_project",
  "repeated_decision_topic",
  "decision_reversal",
  "goal_drift",
  "long_running_project",
  "declining_completion_rate",
  "knowledge_conflict",
  "project_creation_spike",
] as const;
export type PatternKey = (typeof PATTERN_KEYS)[number];

export const RECOMMENDATION_KINDS = [
  "archive_project",
  "reassign_owner",
  "merge_knowledge",
  "review_goal",
  "followup_commitment",
  "schedule_review",
  "close_stalled_decision",
  "delegate_task",
  "update_documentation",
  "wake_inactive_venture",
] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];

export type EntityType =
  | "project"
  | "venture"
  | "commitment"
  | "decision"
  | "goal"
  | "task"
  | "knowledge_record"
  | "organization";

export interface EntityRef {
  type: EntityType;
  id: string;
  title?: string;
}

export interface DetectorEvidence {
  refs: EntityRef[];
  metrics: Record<string, number | string | boolean | null>;
  window?: { start: string; end: string };
}

export interface DetectorFinding {
  patternKey: PatternKey;
  patternVersion: string;
  ventureId: string | null;
  entityRef: string; // stable idempotency key ("project:<uuid>", "venture:<uuid>", etc)
  title: string;
  summary: string;
  priority: InsightPriority;
  confidence: number; // 0..1
  severity: "information" | "opportunity" | "warning" | "critical";
  evidence: DetectorEvidence;
}

export interface HealthCategoryScore {
  score: number; // 0..1
  inputs: Record<string, number>;
  method: string;
}

export interface HealthReport {
  overall: number; // 0..1
  categories: {
    execution: HealthCategoryScore;
    decision_velocity: HealthCategoryScore;
    project_health: HealthCategoryScore;
    knowledge_freshness: HealthCategoryScore;
    commitment_completion: HealthCategoryScore;
    goal_progress: HealthCategoryScore;
    consistency: HealthCategoryScore;
  };
  methodVersion: string;
  computedAt: string;
  inputs: Record<string, number>;
}

export interface RecommendationDraft {
  kind: RecommendationKind;
  title: string;
  rationale: string;
  expectedImpact: string;
  priority: InsightPriority;
  confidence: number;
  ventureId: string | null;
  evidence: DetectorEvidence;
  insightPatternKey: PatternKey;
  insightEntityRef: string;
}

export interface DigestSection {
  key:
    | "todays_priorities"
    | "critical_risks"
    | "projects_attention"
    | "upcoming_commitments"
    | "decisions_waiting"
    | "recently_learned"
    | "recommended_actions"
    | "recent_wins";
  title: string;
  items: DigestItem[];
}

export interface DigestItem {
  ref: EntityRef | null;
  headline: string;
  detail: string;
  href: string | null;
  meta?: Record<string, string | number>;
}

export interface DigestReport {
  sections: DigestSection[];
  insightIds: string[];
  recommendationIds: string[];
  healthSnapshotId: string | null;
  methodVersion: string;
  generatedAt: string;
}

export const HEALTH_WEIGHTS_V1 = {
  execution: 0.2,
  decision_velocity: 0.1,
  project_health: 0.2,
  knowledge_freshness: 0.1,
  commitment_completion: 0.2,
  goal_progress: 0.1,
  consistency: 0.1,
} as const;