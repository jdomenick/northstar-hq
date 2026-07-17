// Missing-data detection utilities. Deterministic; produce concise strings
// that the analyzer copies into WorkflowDeterministicResult.missingInformation.

import type { WorkflowContext } from "../types";

export function missingDataSignals(ctx: WorkflowContext): string[] {
  const out: string[] = [];
  const commitmentsMissingOwner = ctx.commitments.filter((c) => !c.owner_user_id).length;
  if (commitmentsMissingOwner > 0) out.push(`${commitmentsMissingOwner} commitment(s) missing owner`);

  const commitmentsMissingDue = ctx.commitments.filter(
    (c) => !c.due_date && ["open", "in_progress", "waiting"].includes((c.status ?? "").toLowerCase()),
  ).length;
  if (commitmentsMissingDue > 0) out.push(`${commitmentsMissingDue} open commitment(s) missing due date`);

  const projectsMissingOwner = ctx.projects.filter((p) => !p.owner_user_id).length;
  if (projectsMissingOwner > 0) out.push(`${projectsMissingOwner} project(s) missing owner`);

  const projectsMissingDeadline = ctx.projects.filter((p) => !p.deadline && ["active", "at_risk", "blocked"].includes((p.status ?? "").toLowerCase())).length;
  if (projectsMissingDeadline > 0) out.push(`${projectsMissingDeadline} active project(s) missing deadline`);

  const goalsMissingProgress = ctx.goals.filter((g) => g.target_value != null && g.current_value == null).length;
  if (goalsMissingProgress > 0) out.push(`${goalsMissingProgress} goal(s) missing progress data`);

  const decisionsMissingReview = ctx.decisions.filter(
    (d) => !d.review_date && ["under_review", "waiting_for_founder", "revisit_later"].includes((d.status ?? "").toLowerCase()),
  ).length;
  if (decisionsMissingReview > 0) out.push(`${decisionsMissingReview} open decision(s) missing review date`);

  return out;
}