// Weekly Review analyzer. Requires a valid period range. Compares this
// period's execution with prior periods where available. Provider synthesis
// only summarizes; deterministic findings remain authoritative.

import { WEEKLY_REVIEW_VERSION, WEEKLY_REVIEW_RULESET_VERSION } from "@/lib/constants";
import { SamError } from "@/lib/errors";
import type { WorkflowAnalyzer } from "./types";
import type {
  WorkflowContext, WorkflowDeterministicResult,
  WorkflowFinding, WorkflowCitationCandidate,
} from "../types";
import * as R from "./rules";
import { buildFinding, dedupeFindings, enforceCitationSupport } from "./findings";
import { assignSortOrders } from "./scoring";
import { cite, refCommitment, refDecision, refGoal, refProject, refTask } from "./citation-candidates";
import { missingDataSignals } from "./data-quality";

export const weeklyReviewAnalyzer: WorkflowAnalyzer = {
  key: "weekly_review",
  version: WEEKLY_REVIEW_VERSION,
  async analyze(ctx: WorkflowContext): Promise<WorkflowDeterministicResult> {
    if (!ctx.periodStart || !ctx.periodEnd) throw new SamError("invalid_date_range");

    const findings: WorkflowFinding[] = [];
    const candidates: WorkflowCitationCandidate[] = [];
    const rulesTriggered: string[] = [];
    const trip = (r: string) => { if (!rulesTriggered.includes(r)) rulesTriggered.push(r); };

    const completedTasks = R.tasksCompletedIn(ctx, ctx.periodStart, ctx.periodEnd);
    const completedCommits = R.commitmentsCompletedIn(ctx, ctx.periodStart, ctx.periodEnd);
    const missedCommits = R.commitmentsMissedIn(ctx, ctx.periodStart, ctx.periodEnd);
    const closedDecisions = R.decisionsClosedIn(ctx, ctx.periodStart, ctx.periodEnd);
    const openDecisions = R.openDecisions(ctx);
    const advancedProjects = R.projectsAdvancedIn(ctx, ctx.periodStart, ctx.periodEnd);
    const stalledProjects = R.projectsStalledFor(ctx, 7);
    const postponed = R.postponedCommitments(ctx);
    const goalsAtRisk = R.goalsAtRisk(ctx);
    const goalsBehind = R.goalsBehindProgress(ctx);

    // Completed work summary
    if (completedTasks.length > 0) {
      const key = `${R.RULES.weekCompletedWork}:tasks`;
      trip(R.RULES.weekCompletedWork);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekCompletedWork,
        finding_type: "observation",
        title: `${completedTasks.length} task(s) completed this period`,
        summary: completedTasks.slice(0, 5).map((t) => t.title).join("; "),
        severity: "informational",
        priority: 30,
        structured_data: { count: completedTasks.length, derived: true, ruleset: WEEKLY_REVIEW_RULESET_VERSION },
      }));
      completedTasks.slice(0, 5).forEach((t) => candidates.push(cite(key, refTask(t), { citation_type: "supporting" })));
    }
    if (completedCommits.length > 0) {
      const key = `${R.RULES.weekCommitmentsKept}:summary`;
      trip(R.RULES.weekCommitmentsKept);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekCommitmentsKept,
        finding_type: "observation",
        title: `${completedCommits.length} commitment(s) kept`,
        summary: completedCommits.slice(0, 5).map((c) => c.title).join("; "),
        severity: "informational",
        priority: 35,
        structured_data: { count: completedCommits.length, derived: true },
      }));
      completedCommits.slice(0, 5).forEach((c) => candidates.push(cite(key, refCommitment(c), { citation_type: "supporting" })));
    }

    if (missedCommits.length > 0) {
      for (const c of missedCommits) {
        const key = `${R.RULES.weekCommitmentsMissed}:${c.id}`;
        trip(R.RULES.weekCommitmentsMissed);
        findings.push(buildFinding({
          key, ruleId: R.RULES.weekCommitmentsMissed,
          finding_type: "commitment_issue",
          title: `Missed: ${c.title}`,
          summary: `Due ${c.due_date}  -  not completed.`,
          severity: "high",
          priority: 80,
          structured_data: { commitmentId: c.id, dueDate: c.due_date },
        }));
        candidates.push(cite(key, refCommitment(c)));
      }
    }

    for (const c of postponed) {
      const key = `${R.RULES.weekCarriedRisk}:${c.id}`;
      trip(R.RULES.weekCarriedRisk);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekCarriedRisk,
        finding_type: "risk",
        title: `Carried risk: repeatedly postponed ${c.title}`,
        summary: `Postponed ${c.postponement_count ?? 0} time(s).`,
        severity: "medium",
        priority: 55,
        structured_data: { commitmentId: c.id },
      }));
      candidates.push(cite(key, refCommitment(c)));
    }

    if (advancedProjects.length > 0) {
      const key = `${R.RULES.weekProjectAdvanced}:summary`;
      trip(R.RULES.weekProjectAdvanced);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekProjectAdvanced,
        finding_type: "opportunity",
        title: `${advancedProjects.length} project(s) advanced`,
        summary: advancedProjects.slice(0, 5).map((p) => p.name).join("; "),
        severity: "informational",
        priority: 30,
        structured_data: { count: advancedProjects.length, derived: true },
      }));
      advancedProjects.slice(0, 5).forEach((p) => candidates.push(cite(key, refProject(p), { citation_type: "supporting" })));
    }

    for (const p of stalledProjects) {
      const key = `${R.RULES.weekProjectStalled}:${p.id}`;
      trip(R.RULES.weekProjectStalled);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekProjectStalled,
        finding_type: "risk",
        title: `Stalled: ${p.name}`,
        summary: `Not updated for ${SAM_STALL_DAYS}+ days.`,
        severity: "medium",
        priority: 50,
        structured_data: { projectId: p.id },
      }));
      candidates.push(cite(key, refProject(p)));
    }

    for (const g of goalsBehind) {
      const key = `${R.RULES.weekGoalMovement}:behind:${g.id}`;
      trip(R.RULES.weekGoalMovement);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekGoalMovement,
        finding_type: "goal_issue",
        title: `Goal drifting: ${g.title}`,
        summary: `Progress ${g.current_value ?? 0}/${g.target_value} vs elapsed timeline.`,
        severity: "medium",
        priority: 55,
        structured_data: { goalId: g.id, derived: true },
      }));
      candidates.push(cite(key, refGoal(g), { citation_type: "supporting" }));
    }
    for (const g of goalsAtRisk) {
      const key = `${R.RULES.weekGoalMovement}:atrisk:${g.id}`;
      trip(R.RULES.weekGoalMovement);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekGoalMovement,
        finding_type: "goal_issue",
        title: `Goal ${g.status}: ${g.title}`,
        summary: `Goal status is ${g.status}.`,
        severity: g.status === "missed" ? "high" : "medium",
        priority: 60,
        structured_data: { goalId: g.id, status: g.status },
      }));
      candidates.push(cite(key, refGoal(g)));
    }

    for (const d of closedDecisions) {
      const key = `${R.RULES.weekDecisionsClosed}:${d.id}`;
      trip(R.RULES.weekDecisionsClosed);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekDecisionsClosed,
        finding_type: "observation",
        title: `Decision closed: ${d.title}`,
        summary: `Status ${d.status}.`,
        severity: "informational",
        priority: 40,
        structured_data: { decisionId: d.id },
      }));
      candidates.push(cite(key, refDecision(d)));
    }
    for (const d of openDecisions) {
      const key = `${R.RULES.weekDecisionsOpen}:${d.id}`;
      trip(R.RULES.weekDecisionsOpen);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekDecisionsOpen,
        finding_type: "decision_needed",
        title: `Still open: ${d.title}`,
        summary: `Carried into next week. Status ${d.status}.`,
        severity: "medium",
        priority: 55,
        structured_data: { decisionId: d.id },
      }));
      candidates.push(cite(key, refDecision(d)));
    }

    // Execution gap: neither completions nor advances nor closed decisions.
    if (completedTasks.length === 0 && completedCommits.length === 0 && advancedProjects.length === 0 && closedDecisions.length === 0) {
      const key = `${R.RULES.weekExecutionGap}:summary`;
      trip(R.RULES.weekExecutionGap);
      findings.push(buildFinding({
        key, ruleId: R.RULES.weekExecutionGap,
        finding_type: "risk",
        title: "No execution recorded this period",
        summary: "No completed tasks, kept commitments, project movement, or closed decisions in the selected period.",
        severity: "high",
        priority: 70,
        structured_data: { derived: true, period: { start: ctx.periodStart, end: ctx.periodEnd } },
      }));
    }

    // Prior comparison
    const priorRun = ctx.historicalRuns.find((r) => r.workflow_type === "weekly_review" && r.status === "completed");
    if (priorRun) {
      trip("workflow.rule.week_prior_comparison");
      // Not a finding by itself, but stamps deterministic info for synthesis.
    }

    const missingInformation = missingDataSignals(ctx);
    const deduped = dedupeFindings(findings);
    const supported = enforceCitationSupport(deduped, candidates);
    const finalFindings = assignSortOrders(supported.findings);

    return {
      ok: true,
      findings: finalFindings,
      counts: {
        completed_tasks: completedTasks.length,
        completed_commitments: completedCommits.length,
        missed_commitments: missedCommits.length,
        advanced_projects: advancedProjects.length,
        stalled_projects: stalledProjects.length,
        closed_decisions: closedDecisions.length,
        open_decisions: openDecisions.length,
        prior_run_available: priorRun ? 1 : 0,
      },
      scores: {
        executionScore: completedTasks.length + completedCommits.length + advancedProjects.length,
        slipScore: missedCommits.length + stalledProjects.length + postponed.length,
      },
      missingInformation,
      rulesTriggered,
      citationCandidates: candidates,
      providerSynthesisNecessary: finalFindings.length > 0,
      providerSynthesisPayload: {
        ruleset: WEEKLY_REVIEW_RULESET_VERSION,
        priorRunId: priorRun?.id ?? null,
        period: { start: ctx.periodStart, end: ctx.periodEnd },
        sections: [
          "week_summary", "wins", "misses", "execution_patterns", "commitments_kept",
          "commitments_missed", "goal_movement", "important_decisions", "risks_carried_forward",
          "lessons", "priorities_for_next_week",
        ],
      },
    };
  },
};

const SAM_STALL_DAYS = 7;