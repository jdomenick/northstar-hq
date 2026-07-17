// Workflow citation validator. Every emitted citation must reference an
// entity actually loaded in the RLS-authorized context — cross-org and
// private-memory citations are dropped, not silently accepted.

import type {
  WorkflowCitation,
  WorkflowCitationCandidate,
  WorkflowContext,
} from "./types";

export interface CitationValidationResult {
  accepted: WorkflowCitation[];
  rejected: WorkflowCitationCandidate[];
}

export function validateWorkflowCitations(
  ctx: WorkflowContext,
  candidates: WorkflowCitationCandidate[],
): CitationValidationResult {
  const allowed = new Map<string, Set<string>>();
  const add = (type: string, id: string | null | undefined) => {
    if (!id) return;
    if (!allowed.has(type)) allowed.set(type, new Set());
    allowed.get(type)!.add(id);
  };
  ctx.ventures.forEach((v) => add("venture", v.id));
  ctx.projects.forEach((p) => add("project", p.id));
  ctx.tasks.forEach((t) => add("task", t.id));
  ctx.goals.forEach((g) => add("goal", g.id));
  ctx.decisions.forEach((d) => add("decision", d.id));
  ctx.commitments.forEach((c) => add("commitment", c.id));
  ctx.knowledge.forEach((k) => add("knowledge_record", k.id));
  ctx.documents.forEach((d) => add("document", d.id));
  ctx.activity.forEach((a) => add("activity_event", a.id));
  ctx.memory.trusted.forEach((m) => add("memory_item", m.id));
  ctx.memory.uncertain.forEach((m) => add("memory_item", m.id));

  const accepted: WorkflowCitation[] = [];
  const rejected: WorkflowCitationCandidate[] = [];
  for (const c of candidates) {
    if (allowed.get(c.entity_type)?.has(c.entity_id)) {
      accepted.push({ ...c, finding_id: null });
    } else {
      rejected.push(c);
    }
  }
  return { accepted, rejected };
}