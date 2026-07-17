// Decision Review analyzer. Requires a selected decision in context.
// Distinguishes facts, assumptions, supporting evidence, contradicting
// evidence, and missing information. SAM never claims to make the decision.

import { DECISION_REVIEW_VERSION, DECISION_REVIEW_RULESET_VERSION } from "@/lib/constants";
import { SamError } from "@/lib/errors";
import type { WorkflowAnalyzer } from "./types";
import type {
  WorkflowContext, WorkflowDeterministicResult,
  WorkflowFinding, WorkflowCitationCandidate,
} from "../types";
import * as R from "./rules";
import { buildFinding, dedupeFindings, enforceCitationSupport } from "./findings";
import { assignSortOrders } from "./scoring";
import {
  cite, refCommitment, refDecision, refProject, refTask, refMemory,
} from "./citation-candidates";
import { isOverdue, daysUntil } from "./dates";

export const decisionReviewAnalyzer: WorkflowAnalyzer = {
  key: "decision_review",
  version: DECISION_REVIEW_VERSION,
  async analyze(ctx: WorkflowContext): Promise<WorkflowDeterministicResult> {
    const d = ctx.selectedDecision;
    if (!d) throw new SamError("record_unavailable");

    const findings: WorkflowFinding[] = [];
    const candidates: WorkflowCitationCandidate[] = [];
    const rulesTriggered: string[] = [];
    const trip = (r: string) => { if (!rulesTriggered.includes(r)) rulesTriggered.push(r); };

    // ── Known facts (from populated fields on the decision itself) ────
    const facts: string[] = [];
    if (d.question) facts.push(`Question: ${d.question}`);
    if (d.context) facts.push(`Context recorded.`);
    if (d.decision_date) facts.push(`Decision date: ${d.decision_date}`);
    if (d.owner_user_id) facts.push(`Owner is set.`);
    if (d.status) facts.push(`Status: ${d.status}`);
    if (facts.length > 0) {
      const key = `decision.fact:${d.id}`;
      findings.push(buildFinding({
        key, ruleId: "workflow.rule.decision_facts",
        finding_type: "observation",
        title: `Known facts on record`,
        summary: facts.join(" · "),
        severity: "informational",
        priority: 40,
        structured_data: { decisionId: d.id, derived: true, evidenceKind: "fact" },
      }));
      candidates.push(cite(key, refDecision({ id: d.id, title: d.title })));
      trip("workflow.rule.decision_facts");
    }

    // ── Options considered / evidence / risks (from JSON fields) ───────
    const optionsCount = Array.isArray(d.options_considered) ? (d.options_considered as unknown[]).length : 0;
    const evidenceCount = Array.isArray(d.evidence) ? (d.evidence as unknown[]).length : 0;
    const risksCount = Array.isArray(d.risks) ? (d.risks as unknown[]).length : 0;

    if (optionsCount === 0) {
      trip(R.RULES.decisionMissingOptions);
      findings.push(buildFinding({
        key: `${R.RULES.decisionMissingOptions}:${d.id}`,
        ruleId: R.RULES.decisionMissingOptions,
        finding_type: "missing_information",
        title: "No alternatives recorded",
        summary: "Consider documenting at least one alternative option before deciding.",
        severity: "medium",
        priority: 60,
        structured_data: { decisionId: d.id },
      }));
    }
    if (evidenceCount === 0) {
      trip(R.RULES.decisionMissingEvidence);
      findings.push(buildFinding({
        key: `${R.RULES.decisionMissingEvidence}:${d.id}`,
        ruleId: R.RULES.decisionMissingEvidence,
        finding_type: "missing_information",
        title: "No supporting evidence recorded",
        summary: "Record verifiable evidence entries before finalizing.",
        severity: "medium",
        priority: 65,
        structured_data: { decisionId: d.id },
      }));
    } else {
      trip("workflow.rule.decision_evidence_present");
      findings.push(buildFinding({
        key: `decision.evidence:${d.id}`,
        ruleId: "workflow.rule.decision_evidence_present",
        finding_type: "observation",
        title: `${evidenceCount} evidence entry(ies) on file`,
        summary: "Provider synthesis may summarize; the raw entries remain the source of truth.",
        severity: "informational",
        priority: 35,
        structured_data: { decisionId: d.id, evidenceCount, derived: true, evidenceKind: "supporting" },
      }));
      candidates.push(cite(`decision.evidence:${d.id}`, refDecision({ id: d.id, title: d.title }), { citation_type: "supporting" }));
    }

    if (risksCount > 0) {
      trip(R.RULES.decisionRisksListed);
      findings.push(buildFinding({
        key: `${R.RULES.decisionRisksListed}:${d.id}`,
        ruleId: R.RULES.decisionRisksListed,
        finding_type: "risk",
        title: `${risksCount} risk(s) listed on this decision`,
        summary: "Risks are captured on the decision record.",
        severity: "medium",
        priority: 55,
        structured_data: { decisionId: d.id, risksCount, derived: true },
      }));
      candidates.push(cite(`${R.RULES.decisionRisksListed}:${d.id}`, refDecision({ id: d.id, title: d.title })));
    } else {
      trip("workflow.rule.decision_risks_missing");
      findings.push(buildFinding({
        key: `decision.risksMissing:${d.id}`,
        ruleId: "workflow.rule.decision_risks_missing",
        finding_type: "missing_information",
        title: "No risks recorded",
        summary: "Consider identifying at least one risk before deciding.",
        severity: "low",
        priority: 40,
        structured_data: { decisionId: d.id },
      }));
    }

    if (d.opportunity_cost) {
      trip(R.RULES.decisionOpportunityCost);
      findings.push(buildFinding({
        key: `${R.RULES.decisionOpportunityCost}:${d.id}`,
        ruleId: R.RULES.decisionOpportunityCost,
        finding_type: "observation",
        title: "Opportunity cost documented",
        summary: d.opportunity_cost.slice(0, 240),
        severity: "informational",
        priority: 30,
        structured_data: { decisionId: d.id, derived: true, evidenceKind: "supporting" },
      }));
      candidates.push(cite(`${R.RULES.decisionOpportunityCost}:${d.id}`, refDecision({ id: d.id, title: d.title }), { citation_type: "supporting" }));
    }

    if (!d.owner_user_id) {
      trip(R.RULES.decisionMissingOwner);
      findings.push(buildFinding({
        key: `${R.RULES.decisionMissingOwner}:${d.id}`,
        ruleId: R.RULES.decisionMissingOwner,
        finding_type: "missing_information",
        title: "Decision has no owner",
        summary: "Assign an owner responsible for closing this decision.",
        severity: "medium",
        priority: 55,
        structured_data: { decisionId: d.id },
      }));
    }
    if (!d.review_date && ["under_review", "waiting_for_founder", "revisit_later"].includes((d.status ?? "").toLowerCase())) {
      trip(R.RULES.decisionMissingReviewDate);
      findings.push(buildFinding({
        key: `${R.RULES.decisionMissingReviewDate}:${d.id}`,
        ruleId: R.RULES.decisionMissingReviewDate,
        finding_type: "missing_information",
        title: "No review date set",
        summary: "Set a review date to keep this decision from drifting.",
        severity: "low",
        priority: 35,
        structured_data: { decisionId: d.id },
      }));
    }
    if (d.review_date && isOverdue(d.review_date)) {
      trip(R.RULES.decisionOverdueReview);
      findings.push(buildFinding({
        key: `${R.RULES.decisionOverdueReview}:${d.id}`,
        ruleId: R.RULES.decisionOverdueReview,
        finding_type: "decision_needed",
        title: "Review date has passed",
        summary: `Scheduled review ${d.review_date} is ${Math.abs(daysUntil(d.review_date) ?? 0)}d overdue.`,
        severity: "high",
        priority: 75,
        structured_data: { decisionId: d.id },
      }));
      candidates.push(cite(`${R.RULES.decisionOverdueReview}:${d.id}`, refDecision({ id: d.id, title: d.title })));
    }

    // ── Downstream impact via related tasks / commitments ─────────────
    const rel = ctx.related;
    if (rel && (rel.tasks.length + rel.commitments.length) > 0) {
      const key = `${R.RULES.decisionDownstreamImpact}:${d.id}`;
      trip(R.RULES.decisionDownstreamImpact);
      findings.push(buildFinding({
        key, ruleId: R.RULES.decisionDownstreamImpact,
        finding_type: "observation",
        title: `Downstream impact: ${rel.tasks.length} task(s), ${rel.commitments.length} commitment(s)`,
        summary: "Records currently depend on this decision landing.",
        severity: "medium",
        priority: 50,
        structured_data: {
          decisionId: d.id,
          taskIds: rel.tasks.map((t) => t.id),
          commitmentIds: rel.commitments.map((c) => c.id),
          derived: true,
        },
      }));
      rel.tasks.slice(0, 5).forEach((t) => candidates.push(cite(key, refTask(t), { citation_type: "supporting" })));
      rel.commitments.slice(0, 5).forEach((c) => candidates.push(cite(key, refCommitment(c), { citation_type: "supporting" })));
    }

    // ── Historical outcome evidence from similar decisions ────────────
    if (rel && rel.decisions.length > 0) {
      const key = `${R.RULES.decisionHistoricalOutcome}:${d.id}`;
      trip(R.RULES.decisionHistoricalOutcome);
      const withOutcomes = rel.decisions.filter((h) => h.outcome);
      findings.push(buildFinding({
        key, ruleId: R.RULES.decisionHistoricalOutcome,
        finding_type: "observation",
        title: `${rel.decisions.length} prior decision(s) available for context`,
        summary: withOutcomes.length > 0
          ? `${withOutcomes.length} of them recorded an outcome.`
          : `None recorded a documented outcome yet.`,
        severity: "informational",
        priority: 25,
        structured_data: { decisionId: d.id, historical: rel.decisions.map((h) => h.id), derived: true },
      }));
      rel.decisions.forEach((h) => candidates.push(cite(key, refDecision(h), { citation_type: "background" })));
    }

    // ── Memory contradictions (trusted vs. uncertain) ─────────────────
    if (ctx.memory.trusted.length > 0) {
      const key = `decision.memorySupport:${d.id}`;
      trip("workflow.rule.decision_memory_support");
      findings.push(buildFinding({
        key, ruleId: "workflow.rule.decision_memory_support",
        finding_type: "observation",
        title: `${ctx.memory.trusted.length} trusted memory item(s) considered`,
        summary: "Confirmed memory considered during analysis.",
        severity: "informational",
        priority: 20,
        structured_data: { decisionId: d.id, derived: true, evidenceKind: "supporting" },
      }));
      ctx.memory.trusted.slice(0, 5).forEach((m) => candidates.push(cite(key, refMemory(m), { citation_type: "supporting" })));
    }

    // ── Project alignment (if the decision has a project) ─────────────
    if (d.project_id && rel && rel.projects.length > 0) {
      const project = rel.projects[0];
      const key = `decision.projectAlignment:${d.id}`;
      trip("workflow.rule.decision_project_alignment");
      findings.push(buildFinding({
        key, ruleId: "workflow.rule.decision_project_alignment",
        finding_type: "observation",
        title: `Related project: ${project.name}`,
        summary: `Project status ${project.status}.`,
        severity: "informational",
        priority: 30,
        structured_data: { decisionId: d.id, projectId: project.id, derived: true },
      }));
      candidates.push(cite(key, refProject(project)));
    }

    const missingInformation: string[] = [];
    if (optionsCount === 0) missingInformation.push("No alternatives recorded");
    if (evidenceCount === 0) missingInformation.push("No supporting evidence entries");
    if (risksCount === 0) missingInformation.push("No risks recorded");
    if (!d.owner_user_id) missingInformation.push("No decision owner");
    if (!d.review_date) missingInformation.push("No review date");

    const deduped = dedupeFindings(findings);
    const supported = enforceCitationSupport(deduped, candidates);
    const finalFindings = assignSortOrders(supported.findings);

    return {
      ok: true,
      findings: finalFindings,
      counts: {
        options_considered: optionsCount,
        evidence_entries: evidenceCount,
        risks_recorded: risksCount,
        related_tasks: rel?.tasks.length ?? 0,
        related_commitments: rel?.commitments.length ?? 0,
        historical_similar: rel?.decisions.length ?? 0,
      },
      scores: {
        supportedEvidence: evidenceCount,
        contradictionSignals: 0,
        assumptionSignals: (optionsCount === 0 ? 1 : 0) + (evidenceCount === 0 ? 1 : 0),
      },
      missingInformation,
      rulesTriggered,
      citationCandidates: candidates,
      providerSynthesisNecessary: finalFindings.length > 0,
      providerSynthesisPayload: {
        ruleset: DECISION_REVIEW_RULESET_VERSION,
        decisionId: d.id,
        sections: [
          "decision_framing", "known_facts", "assumptions", "supporting_evidence",
          "contradicting_evidence", "risks", "opportunity_cost", "goal_alignment",
          "venture_alignment", "missing_information", "recommendation", "alternatives",
        ],
        stance: "SAM must not claim to make the decision. Use language such as 'the evidence currently supports…' or 'the decision remains uncertain because…'.",
      },
    };
  },
};