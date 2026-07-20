import type { SamCitation, SamResponse } from "./schema";
import type { AssembledContext } from "./context-builder.server";

// Build a deep-link href for a citation entity. Respects NorthStar Labs' routes.
export function citationHref(entityType: SamCitation["entity_type"], id: string): string | null {
  switch (entityType) {
    case "venture":
      return `/ventures/${id}`;
    case "project":
      return `/projects/${id}`;
    case "task":
      return `/projects`; // tasks live inside project detail; no dedicated route
    case "goal":
      return `/goals/${id}`;
    case "decision":
      return `/decisions/${id}`;
    case "commitment":
      return `/commitments/${id}`;
    case "knowledge_record":
      return `/knowledge/${id}`;
    case "document":
      return `/documents/${id}`;
    case "activity_event":
      return null;
    case "memory_item":
      return `/sam/memory#${id}`;
    case "graph_edge":
      return null;
    default:
      return null;
  }
}

// Discard any citation that does not reference a record actually present in
// the assembled organization-scoped context. This is the RLS-backed guarantee:
// the model cannot conjure an id that belongs to another org and have it
// survive validation.
export function verifyCitations(response: SamResponse, context: AssembledContext): SamCitation[] {
  const allowed = new Map<string, Set<string>>();
  const add = (type: string, id: string | null | undefined) => {
    if (!id) return;
    if (!allowed.has(type)) allowed.set(type, new Set());
    allowed.get(type)!.add(id);
  };
  context.ventures.forEach((v) => add("venture", v.id));
  context.projects.forEach((p) => add("project", p.id));
  context.tasks.forEach((t) => add("task", t.id));
  context.goals.forEach((g) => add("goal", g.id));
  context.decisions.forEach((d) => add("decision", d.id));
  context.commitments.forEach((c) => add("commitment", c.id));
  context.knowledge.forEach((k) => add("knowledge_record", k.id));
  context.documents.forEach((d) => add("document", d.id));
  (context.memory?.trusted ?? []).forEach((m) => add("memory_item", m.id));
  (context.memory?.uncertain ?? []).forEach((m) => add("memory_item", m.id));

  return response.citations.filter((c) => allowed.get(c.entity_type)?.has(c.entity_id));
}