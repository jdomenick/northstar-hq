// Deterministic rule predicates. Each rule owns a stable id used in
// finding.structured_data.ruleId. Predicates are pure; they do not know
// about severities or citations — analyzers compose these into findings.

import { SAM_WORKFLOW_THRESHOLDS } from "@/lib/constants";
import type { WorkflowContext } from "../types";
import { daysSince, daysUntil, inRange, isDueWithin, isOverdue, parseDate } from "./dates";

export type Commitment = WorkflowContext["commitments"][number];
export type Task = WorkflowContext["tasks"][number];
export type Project = WorkflowContext["projects"][number];
export type Goal = WorkflowContext["goals"][number];
export type Decision = WorkflowContext["decisions"][number];

// ── Rule ids (stable across runs) ────────────────────────────
export const RULES = {
  overdueCommitment: "workflow.rule.overdue_commitment",
  dueSoonCommitment: "workflow.rule.due_soon_commitment",
  postponedCommitment: "workflow.rule.repeatedly_postponed_commitment",
  missingCommitmentOwner: "workflow.rule.missing_commitment_owner",
  overdueTask: "workflow.rule.overdue_task",
  dueSoonTask: "workflow.rule.due_soon_task",
  blockedTask: "workflow.rule.blocked_task",
  stalledProject: "workflow.rule.stalled_project",
  atRiskProject: "workflow.rule.at_risk_project",
  blockedProject: "workflow.rule.blocked_project",
  missingProjectOwner: "workflow.rule.missing_project_owner",
  missingProjectDeadline: "workflow.rule.missing_project_deadline",
  goalBehind: "workflow.rule.goal_behind_progress",
  goalWithoutProject: "workflow.rule.goal_without_active_project",
  goalAtRisk: "workflow.rule.goal_at_risk_status",
  openDecisionAwaiting: "workflow.rule.decision_awaiting_action",
  overdueDecisionReview: "workflow.rule.decision_review_overdue",
  missingDecisionOwner: "workflow.rule.missing_decision_owner",
  recentCompletion: "workflow.rule.recent_completion",
  // Weekly review
  weekCompletedWork: "workflow.rule.week_completed_work",
  weekCommitmentsKept: "workflow.rule.week_commitments_kept",
  weekCommitmentsMissed: "workflow.rule.week_commitments_missed",
  weekProjectAdvanced: "workflow.rule.week_project_advanced",
  weekProjectStalled: "workflow.rule.week_project_stalled",
  weekGoalMovement: "workflow.rule.week_goal_movement",
  weekDecisionsClosed: "workflow.rule.week_decisions_closed",
  weekDecisionsOpen: "workflow.rule.week_decisions_open",
  weekExecutionGap: "workflow.rule.week_execution_gap",
  weekCarriedRisk: "workflow.rule.week_carried_risk",
  // Decision review
  decisionMissingOwner: "workflow.rule.decision_missing_owner",
  decisionMissingReviewDate: "workflow.rule.decision_missing_review_date",
  decisionMissingOptions: "workflow.rule.decision_missing_options",
  decisionMissingEvidence: "workflow.rule.decision_missing_evidence",
  decisionAssumptionExplicit: "workflow.rule.decision_assumption",
  decisionRisksListed: "workflow.rule.decision_risks_listed",
  decisionOpportunityCost: "workflow.rule.decision_opportunity_cost",
  decisionOverdueReview: "workflow.rule.decision_review_overdue",
  decisionGoalAlignment: "workflow.rule.decision_goal_alignment_unclear",
  decisionDownstreamImpact: "workflow.rule.decision_downstream_impact",
  decisionHistoricalOutcome: "workflow.rule.decision_similar_history",
  decisionMemoryContradiction: "workflow.rule.decision_memory_contradiction",
} as const;

const OPEN_TASK = new Set(["backlog", "ready", "in_progress", "waiting"]);
const OPEN_COMMIT = new Set(["open", "in_progress", "waiting", "overdue"]);
const OPEN_DECISION = new Set(["draft", "under_review", "waiting_for_founder", "revisit_later"]);
const CLOSED_DECISION = new Set(["decided", "closed"]);
const COMPLETED_TASK = new Set(["completed"]);
const COMPLETED_COMMIT = new Set(["completed"]);
const CANCELED = new Set(["canceled"]);

export function openCommitments(ctx: WorkflowContext): Commitment[] {
  return ctx.commitments.filter((c) => OPEN_COMMIT.has((c.status ?? "").toLowerCase()));
}
export function overdueCommitments(ctx: WorkflowContext): Commitment[] {
  return openCommitments(ctx).filter((c) => isOverdue(c.due_date));
}
export function dueSoonCommitments(ctx: WorkflowContext): Commitment[] {
  return openCommitments(ctx).filter((c) => isDueWithin(c.due_date, SAM_WORKFLOW_THRESHOLDS.dueSoonDays) && !isOverdue(c.due_date));
}
export function postponedCommitments(ctx: WorkflowContext): Commitment[] {
  return ctx.commitments.filter((c) => (c.postponement_count ?? 0) >= SAM_WORKFLOW_THRESHOLDS.postponementConcernCount);
}

export function openTasks(ctx: WorkflowContext): Task[] {
  return ctx.tasks.filter((t) => OPEN_TASK.has((t.status ?? "").toLowerCase()));
}
export function overdueTasks(ctx: WorkflowContext): Task[] {
  return openTasks(ctx).filter((t) => isOverdue(t.due_date));
}
export function dueSoonTasks(ctx: WorkflowContext): Task[] {
  return openTasks(ctx).filter((t) => isDueWithin(t.due_date, SAM_WORKFLOW_THRESHOLDS.dueSoonDays) && !isOverdue(t.due_date));
}
export function blockedTasks(ctx: WorkflowContext): Task[] {
  return ctx.tasks.filter((t) => (t.status ?? "").toLowerCase() === "blocked");
}

export function stalledProjects(ctx: WorkflowContext): Project[] {
  return ctx.projects.filter((p) => {
    if (["completed", "archived"].includes((p.status ?? "").toLowerCase())) return false;
    const d = daysSince(p.updated_at);
    return d !== null && d >= SAM_WORKFLOW_THRESHOLDS.staleProjectDays;
  });
}
export function atRiskProjects(ctx: WorkflowContext): Project[] {
  return ctx.projects.filter((p) => ["at_risk"].includes((p.status ?? "").toLowerCase()));
}
export function blockedProjects(ctx: WorkflowContext): Project[] {
  return ctx.projects.filter((p) => (p.status ?? "").toLowerCase() === "blocked");
}

export function goalsAtRisk(ctx: WorkflowContext): Goal[] {
  return ctx.goals.filter((g) => ["at_risk", "missed"].includes((g.status ?? "").toLowerCase()));
}
export function goalsBehindProgress(ctx: WorkflowContext): Goal[] {
  // Deterministic: if we have start_date and target_date and current/target values,
  // compute expected fraction of progress vs actual.
  const out: Goal[] = [];
  for (const g of ctx.goals) {
    if (g.target_value == null || g.target_value === 0) continue;
    const start = parseDate(g.start_date);
    const end = parseDate(g.target_date);
    if (!start || !end) continue;
    const total = end.getTime() - start.getTime();
    if (total <= 0) continue;
    const elapsed = Date.now() - start.getTime();
    const expected = Math.max(0, Math.min(1, elapsed / total));
    const actual = (g.current_value ?? 0) / g.target_value;
    if (expected - actual > SAM_WORKFLOW_THRESHOLDS.behindProgressRatio) out.push(g);
  }
  return out;
}
export function goalsWithoutActiveProject(ctx: WorkflowContext): Goal[] {
  const activeGoalIds = new Set(
    ctx.projects
      .filter((p) => !["completed", "archived"].includes((p.status ?? "").toLowerCase()))
      .map((p) => p.goal_id)
      .filter((v): v is string => !!v),
  );
  return ctx.goals.filter((g) => ["active", "proposed"].includes((g.status ?? "").toLowerCase()) && !activeGoalIds.has(g.id));
}

export function openDecisions(ctx: WorkflowContext): Decision[] {
  return ctx.decisions.filter((d) => OPEN_DECISION.has((d.status ?? "").toLowerCase()));
}
export function overdueDecisionReviews(ctx: WorkflowContext): Decision[] {
  return ctx.decisions.filter((d) => d.review_date && isOverdue(d.review_date));
}

// ── Period-bound rules (weekly review) ────────────────────────
export function commitmentsCompletedIn(ctx: WorkflowContext, start: string | null, end: string | null): Commitment[] {
  return ctx.commitments.filter((c) => COMPLETED_COMMIT.has((c.status ?? "").toLowerCase()) && inRange(c.completed_at, start, end));
}
export function commitmentsMissedIn(ctx: WorkflowContext, start: string | null, end: string | null): Commitment[] {
  return ctx.commitments.filter((c) => {
    if (!inRange(c.due_date, start, end)) return false;
    const s = (c.status ?? "").toLowerCase();
    return s === "overdue" || (OPEN_COMMIT.has(s) && isOverdue(c.due_date));
  });
}
export function tasksCompletedIn(ctx: WorkflowContext, start: string | null, end: string | null): Task[] {
  return ctx.tasks.filter((t) => COMPLETED_TASK.has((t.status ?? "").toLowerCase()) && inRange(t.completed_at, start, end));
}
export function decisionsClosedIn(ctx: WorkflowContext, start: string | null, end: string | null): Decision[] {
  return ctx.decisions.filter((d) => CLOSED_DECISION.has((d.status ?? "").toLowerCase()) && inRange(d.decision_date, start, end));
}
export function projectsAdvancedIn(ctx: WorkflowContext, start: string | null, end: string | null): Project[] {
  return ctx.projects.filter((p) => inRange(p.updated_at, start, end) && !["completed", "archived"].includes((p.status ?? "").toLowerCase()));
}
export function projectsStalledFor(ctx: WorkflowContext, thresholdDays: number): Project[] {
  return ctx.projects.filter((p) => {
    if (["completed", "archived"].includes((p.status ?? "").toLowerCase())) return false;
    const d = daysSince(p.updated_at);
    return d !== null && d >= thresholdDays;
  });
}

export const enumSets = { OPEN_TASK, OPEN_COMMIT, OPEN_DECISION, CLOSED_DECISION, COMPLETED_TASK, COMPLETED_COMMIT, CANCELED };

// Simple relevance for "due within N days".
export function dueRelevance(due: string | null | undefined): string {
  const n = daysUntil(due);
  if (n === null) return "no due date";
  if (n < 0) return `${Math.abs(n)}d overdue`;
  if (n === 0) return "due today";
  return `due in ${n}d`;
}