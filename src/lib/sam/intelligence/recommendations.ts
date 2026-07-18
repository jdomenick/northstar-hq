// Pure mapping from DetectorFinding -> RecommendationDraft. No I/O.
// Every recommendation cites the same entity refs the finding did.

import {
  RECOMMENDATION_VERSION,
  type DetectorFinding,
  type EntityRef,
  type RecommendationDraft,
  type RecommendationKind,
} from "./types";

function firstRefTitle(refs: EntityRef[], fallback: string): string {
  return refs[0]?.title ?? fallback;
}

type Builder = (f: DetectorFinding) => RecommendationDraft | null;

const BUILDERS: Partial<Record<DetectorFinding["patternKey"], Builder>> = {
  stalled_project: (f) => build(f, "close_stalled_decision" satisfies RecommendationKind === "close_stalled_decision" ? "archive_project" : "archive_project", {
    title: `Archive or restart: ${firstRefTitle(f.evidence.refs, "project")}`,
    rationale: f.summary,
    expectedImpact: "Frees attention and stops false-positive risk signals on a dormant project.",
  }),
  long_running_project: (f) => build(f, "archive_project", {
    title: `Review scope of ${firstRefTitle(f.evidence.refs, "project")}`,
    rationale: f.summary,
    expectedImpact: "Long-running work usually needs a scope cut, a new owner, or an honest close.",
  }),
  missing_owner: (f) => build(f, "reassign_owner", {
    title: `Assign an owner to ${firstRefTitle(f.evidence.refs, "this item")}`,
    rationale: f.summary,
    expectedImpact: "Work without an owner does not move. Naming one restores accountability.",
  }),
  postponed_commitment: (f) => build(f, "followup_commitment", {
    title: `Decide the fate of ${firstRefTitle(f.evidence.refs, "this commitment")}`,
    rationale: f.summary,
    expectedImpact: "Complete it, hand it off, or cancel it. Repeated postponement is a decision by default.",
  }),
  duplicate_project: (f) => build(f, "merge_knowledge", {
    title: `Merge or clarify duplicate projects`,
    rationale: f.summary,
    expectedImpact: "Prevents two teams doing the same thing and clears the front page of noise.",
  }),
  repeated_decision_topic: (f) => build(f, "schedule_review", {
    title: `Schedule a review on this recurring theme`,
    rationale: f.summary,
    expectedImpact: "Recurring topics deserve one durable decision instead of many small ones.",
  }),
  decision_reversal: (f) => build(f, "update_documentation", {
    title: `Document the reversal for ${firstRefTitle(f.evidence.refs, "this decision")}`,
    rationale: f.summary,
    expectedImpact: "Reversed decisions must have the new direction captured or the team will drift back.",
  }),
  goal_drift: (f) => build(f, "review_goal", {
    title: `Review goal: ${firstRefTitle(f.evidence.refs, "goal")}`,
    rationale: f.summary,
    expectedImpact: "Either recommit with a real plan or move it out of the active set.",
  }),
  declining_completion_rate: (f) => build(f, "delegate_task", {
    title: `Cut load or delegate`,
    rationale: f.summary,
    expectedImpact: "Falling completion rates usually mean too many open tasks per owner.",
  }),
  project_creation_spike: (f) => build(f, "delegate_task", {
    title: `Slow project intake`,
    rationale: f.summary,
    expectedImpact: "Finishing existing work compounds. Starting more before finishing does not.",
  }),
  inactive_venture: (f) => build(f, "wake_inactive_venture", {
    title: `Decide on ${firstRefTitle(f.evidence.refs, "this venture")}`,
    rationale: f.summary,
    expectedImpact: "Restart, pause deliberately, or sunset. Silence is not a strategy.",
  }),
  knowledge_conflict: (f) => build(f, "merge_knowledge", {
    title: `Resolve knowledge conflicts`,
    rationale: f.summary,
    expectedImpact: "SAM's answers only stay reliable while its facts do not contradict each other.",
  }),
};

function build(
  f: DetectorFinding,
  kind: RecommendationKind,
  parts: { title: string; rationale: string; expectedImpact: string },
): RecommendationDraft {
  return {
    kind,
    title: parts.title,
    rationale: parts.rationale,
    expectedImpact: parts.expectedImpact,
    priority: f.priority,
    confidence: f.confidence,
    ventureId: f.ventureId,
    evidence: f.evidence,
    insightPatternKey: f.patternKey,
    insightEntityRef: f.entityRef,
  };
}

export function recommendationsFor(finding: DetectorFinding): RecommendationDraft[] {
  const b = BUILDERS[finding.patternKey];
  const draft = b?.(finding);
  return draft ? [draft] : [];
}

export function recommendationsForAll(findings: DetectorFinding[]): RecommendationDraft[] {
  const out: RecommendationDraft[] = [];
  for (const f of findings) out.push(...recommendationsFor(f));
  return out;
}

export { RECOMMENDATION_VERSION };