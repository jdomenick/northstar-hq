// Daily Briefing analyzer. Deterministic-first: identifies the founder's
// current attention priorities using rule predicates over the assembled
// context. Provider synthesis (optional) only summarizes and orders the
// narrative — it does not add findings or citations.

import {
  DAILY_BRIEFING_VERSION,
  DAILY_BRIEFING_RULESET_VERSION,
  SAM_WORKFLOW_THRESHOLDS,
} from "@/lib/constants";
import type { WorkflowAnalyzer } from "./types";
import type {
  WorkflowContext,
  WorkflowDeterministicResult,
  WorkflowFinding,
  WorkflowCitationCandidate,
} from "../types";
import * as R from "./rules";
import { buildFinding, dedupeFindings, enforceCitationSupport } from "./findings";
import { assignSortOrders, priorityWeight } from "./scoring";
import { cite, refCommitment, refDecision, refGoal, refProject, refTask, refActivity } from "./citation-candidates";
import { dueRelevance } from "./rules";
import { missingDataSignals } from "./data-quality";
import { daysSince } from "./dates";

export const dailyBriefingAnalyzer: WorkflowAnalyzer = {
  key: "daily_briefing",
  version: DAILY_BRIEFING_VERSION,
  async analyze(ctx: WorkflowContext): Promise<WorkflowDeterministicResult> {
    const findings: WorkflowFinding[] = [];
    const candidates: WorkflowCitationCandidate[] = [];
    const rulesTriggered: string[] = [];
    const trip = (r: string) => { if (!rulesTriggered.includes(r)) rulesTriggered.push(r); };

    // ── Commitments ─────────────────────────────────────────
    for (const c of R.overdueCommitments(ctx)) {
      const key = `${R.RULES.overdueCommitment}:${c.id}`;
      trip(R.RULES.overdueCommitment);
      findings.push(buildFinding({
        key, ruleId: R.RULES.overdueCommitment,
        finding_type: "commitment_issue",
        title: `Overdue commitment: ${c.title}`,
        summary: `${dueRelevance(c.due_date)}. Status: ${c.status ?? "unknown"}.`,
        severity: "high",
        priority: 90 + priorityWeight(c.priority),
        structured_data: { commitmentId: c.id, dueDate: c.due_date, postponementCount: c.postponement_count ?? 0 },
      }));
      candidates.push(cite(key, refCommitment(c), { relevance: dueRelevance(c.due_date) }));
    }
    for (const c of R.dueSoonCommitments(ctx)) {
      const key = `${R.RULES.dueSoonCommitment}:${c.id}`;
      trip(R.RULES.dueSoonCommitment);
      findings.push(buildFinding({
        key, ruleId: R.RULES.dueSoonCommitment,
        finding_type: "commitment_issue",
        title: `Commitment due soon: ${c.title}`,
        summary: dueRelevance(c.due_date),
        severity: "medium",
        priority: 60 + priorityWeight(c.priority),
        structured_data: { commitmentId: c.id, dueDate: c.due_date },
      }));
      candidates.push(cite(key, refCommitment(c), { relevance: dueRelevance(c.due_date) }));
    }
    for (const c of R.postponedCommitments(ctx)) {
      const key = `${R.RULES.postponedCommitment}:${c.id}`;
      trip(R.RULES.postponedCommitment);
      findings.push(buildFinding({
        key, ruleId: R.RULES.postponedCommitment,
        finding_type: "risk",
        title: `Repeatedly postponed: ${c.title}`,
        summary: `Postponed ${c.postponement_count} time(s). Consider rescheduling with a realistic date or cancelling with a reason.`,
        severity: "medium",
        priority: 50,
        structured_data: { commitmentId: c.id, postponementCount: c.postponement_count },
      }));
      candidates.push(cite(key, refCommitment(c)));
    }

    // ── Tasks ───────────────────────────────────────────────
    for (const t of R.overdueTasks(ctx)) {
      const key = `${R.RULES.overdueTask}:${t.id}`;
      trip(R.RULES.overdueTask);
      findings.push(buildFinding({
        key, ruleId: R.RULES.overdueTask,
        finding_type: "priority",
        title: `Overdue task: ${t.title}`,
        summary: dueRelevance(t.due_date),
        severity: "high",
        priority: 80 + priorityWeight(t.priority),
        structured_data: { taskId: t.id, dueDate: t.due_date },
      }));
      candidates.push(cite(key, refTask(t), { relevance: dueRelevance(t.due_date) }));
    }
    for (const t of R.dueSoonTasks(ctx)) {
      const key = `${R.RULES.dueSoonTask}:${t.id}`;
      trip(R.RULES.dueSoonTask);
      findings.push(buildFinding({
        key, ruleId: R.RULES.dueSoonTask,
        finding_type: "priority",
        title: `Task due soon: ${t.title}`,
        summary: dueRelevance(t.due_date),
        severity: "medium",
        priority: 50 + priorityWeight(t.priority),
        structured_data: { taskId: t.id, dueDate: t.due_date },
      }));
      candidates.push(cite(key, refTask(t)));
    }
    for (const t of R.blockedTasks(ctx)) {
      const key = `${R.RULES.blockedTask}:${t.id}`;
      trip(R.RULES.blockedTask);
      findings.push(buildFinding({
        key, ruleId: R.RULES.blockedTask,
        finding_type: "blocker",
        title: `Blocked task: ${t.title}`,
        summary: `Blocked task requires an unblock decision or owner assignment.`,
        severity: "high",
        priority: 70,
        structured_data: { taskId: t.id, projectId: t.project_id },
      }));
      candidates.push(cite(key, refTask(t)));
    }

    // ── Projects ────────────────────────────────────────────
    for (const p of R.stalledProjects(ctx)) {
      const key = `${R.RULES.stalledProject}:${p.id}`;
      trip(R.RULES.stalledProject);
      const idleDays = daysSince(p.updated_at) ?? 0;
      findings.push(buildFinding({
        key, ruleId: R.RULES.stalledProject,
        finding_type: "risk",
        title: `Stalled project: ${p.name}`,
        summary: `No updates in ${idleDays}d (threshold ${SAM_WORKFLOW_THRESHOLDS.staleProjectDays}d). Status: ${p.status ?? "unknown"}.`,
        severity: "medium",
        priority: 55,
        structured_data: { projectId: p.id, idleDays, threshold: SAM_WORKFLOW_THRESHOLDS.staleProjectDays },
      }));
      candidates.push(cite(key, refProject(p)));
    }
    for (const p of R.atRiskProjects(ctx)) {
      const key = `${R.RULES.atRiskProject}:${p.id}`;
      trip(R.RULES.atRiskProject);
      findings.push(buildFinding({
        key, ruleId: R.RULES.atRiskProject,
        finding_type: "risk",
        title: `At-risk project: ${p.name}`,
        summary: p.risk_summary_missing ? `Marked at_risk.` : `Marked at_risk.${p.blocker_summary ? " " + p.blocker_summary : ""}`,
        severity: "high",
        priority: 70 + priorityWeight(p.priority),
        structured_data: { projectId: p.id },
      }));
      candidates.push(cite(key, refProject(p)));
    }
    for (const p of R.blockedProjects(ctx)) {
      const key = `${R.RULES.blockedProject}:${p.id}`;
      trip(R.RULES.blockedProject);
      findings.push(buildFinding({
        key, ruleId: R.RULES.blockedProject,
        finding_type: "blocker",
        title: `Blocked project: ${p.name}`,
        summary: p.blocker_summary ?? "Marked blocked.",
        severity: "high",
        priority: 75,
        structured_data: { projectId: p.id },
      }));
      candidates.push(cite(key, refProject(p)));
    }

    // ── Goals ───────────────────────────────────────────────
    for (const g of R.goalsAtRisk(ctx)) {
      const key = `${R.RULES.goalAtRisk}:${g.id}`;
      trip(R.RULES.goalAtRisk);
      findings.push(buildFinding({
        key, ruleId: R.RULES.goalAtRisk,
        finding_type: "goal_issue",
        title: `Goal ${g.status}: ${g.title}`,
        summary: `Goal status is ${g.status}.`,
        severity: g.status === "missed" ? "high" : "medium",
        priority: 60,
        structured_data: { goalId: g.id, status: g.status },
      }));
      candidates.push(cite(key, refGoal(g)));
    }
    for (const g of R.goalsBehindProgress(ctx)) {
      const key = `${R.RULES.goalBehind}:${g.id}`;
      trip(R.RULES.goalBehind);
      findings.push(buildFinding({
        key, ruleId: R.RULES.goalBehind,
        finding_type: "goal_issue",
        title: `Goal behind expected progress: ${g.title}`,
        summary: `Actual ${g.current_value ?? 0}/${g.target_value}${g.unit ? " " + g.unit : ""}.`,
        severity: "medium",
        priority: 55,
        structured_data: { goalId: g.id, current: g.current_value, target: g.target_value, derived: true },
      }));
      candidates.push(cite(key, refGoal(g), { citation_type: "supporting" }));
    }
    for (const g of R.goalsWithoutActiveProject(ctx)) {
      const key = `${R.RULES.goalWithoutProject}:${g.id}`;
      trip(R.RULES.goalWithoutProject);
      findings.push(buildFinding({
        key, ruleId: R.RULES.goalWithoutProject,
        finding_type: "goal_issue",
        title: `Goal has no active project: ${g.title}`,
        summary: `No non-completed project references this goal.`,
        severity: "medium",
        priority: 45,
        structured_data: { goalId: g.id, derived: true },
      }));
      candidates.push(cite(key, refGoal(g), { citation_type: "supporting" }));
    }

    // ── Decisions ───────────────────────────────────────────
    for (const d of R.openDecisions(ctx)) {
      const key = `${R.RULES.openDecisionAwaiting}:${d.id}`;
      trip(R.RULES.openDecisionAwaiting);
      findings.push(buildFinding({
        key, ruleId: R.RULES.openDecisionAwaiting,
        finding_type: "decision_needed",
        title: `Decision awaiting action: ${d.title}`,
        summary: `Status: ${d.status}${d.review_date ? `. Review: ${d.review_date}` : ""}.`,
        severity: "medium",
        priority: 65,
        structured_data: { decisionId: d.id, status: d.status },
      }));
      candidates.push(cite(key, refDecision(d)));
    }
    for (const d of R.overdueDecisionReviews(ctx)) {
      const key = `${R.RULES.overdueDecisionReview}:${d.id}`;
      trip(R.RULES.overdueDecisionReview);
      findings.push(buildFinding({
        key, ruleId: R.RULES.overdueDecisionReview,
        finding_type: "decision_needed",
        title: `Decision review overdue: ${d.title}`,
        summary: `Scheduled review date ${d.review_date} has passed.`,
        severity: "high",
        priority: 78,
        structured_data: { decisionId: d.id, reviewDate: d.review_date },
      }));
      candidates.push(cite(key, refDecision(d)));
    }

    // ── Recent completions (bounded observation) ───────────
    const recentActivity = ctx.activity.slice(0, 5);
    if (recentActivity.length > 0) {
      const key = `${R.RULES.recentCompletion}:summary`;
      trip(R.RULES.recentCompletion);
      findings.push(buildFinding({
        key, ruleId: R.RULES.recentCompletion,
        finding_type: "observation",
        title: `Recent activity: ${recentActivity.length} event(s)`,
        summary: recentActivity.map((a) => `${a.action}:${a.entity_type}`).join(", "),
        severity: "informational",
        priority: 10,
        structured_data: { count: recentActivity.length, derived: true },
      }));
      recentActivity.forEach((a) => candidates.push(cite(key, refActivity(a), { citation_type: "supporting" })));
    }

    // ── Ownership / data gaps ──────────────────────────────
    const missingCommitmentOwners = ctx.commitments.filter((c) => !c.owner_user_id && ["open", "in_progress", "waiting"].includes((c.status ?? "").toLowerCase()));
    for (const c of missingCommitmentOwners.slice(0, 5)) {
      const key = `${R.RULES.missingCommitmentOwner}:${c.id}`;
      trip(R.RULES.missingCommitmentOwner);
      findings.push(buildFinding({
        key, ruleId: R.RULES.missingCommitmentOwner,
        finding_type: "missing_information",
        title: `Commitment missing owner: ${c.title}`,
        summary: "Assign an owner to make this actionable.",
        severity: "low",
        priority: 25,
        structured_data: { commitmentId: c.id },
      }));
      candidates.push(cite(key, refCommitment(c)));
    }

    const missingInformation = missingDataSignals(ctx);

    const deduped = dedupeFindings(findings);
    const supported = enforceCitationSupport(deduped, candidates);
    const finalFindings = assignSortOrders(supported.findings);

    return {
      ok: true,
      findings: finalFindings,
      counts: {
        overdue_commitments: R.overdueCommitments(ctx).length,
        due_soon_commitments: R.dueSoonCommitments(ctx).length,
        overdue_tasks: R.overdueTasks(ctx).length,
        blocked_tasks: R.blockedTasks(ctx).length,
        stalled_projects: R.stalledProjects(ctx).length,
        open_decisions: R.openDecisions(ctx).length,
      },
      scores: {
        priorityLoad: finalFindings.filter((f) => f.finding_type === "priority" || f.finding_type === "commitment_issue").length,
        riskLoad: finalFindings.filter((f) => f.finding_type === "risk" || f.finding_type === "blocker").length,
      },
      missingInformation,
      rulesTriggered,
      citationCandidates: candidates,
      providerSynthesisNecessary: finalFindings.length > 0,
      providerSynthesisPayload: {
        ruleset: DAILY_BRIEFING_RULESET_VERSION,
        sections: [
          "executive_summary", "top_priorities", "risks", "decisions_needed",
          "commitments", "goal_watch", "recent_progress", "missing_information",
          "recommended_focus",
        ],
      },
    };
  },
};