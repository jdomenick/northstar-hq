import type { Json } from "@/integrations/supabase/types";
import type { WorkflowCitationCandidate } from "../types";

export type EntityRef = { entity_type: string; entity_id: string; title: string; href?: string | null };

export function cite(
  findingKey: string,
  ref: EntityRef,
  opts?: { relevance?: string; citation_type?: "direct" | "supporting" | "background"; lineage?: Json },
): WorkflowCitationCandidate {
  return {
    findingKey,
    citation_type: opts?.citation_type ?? "direct",
    entity_type: ref.entity_type,
    entity_id: ref.entity_id,
    title: ref.title.slice(0, 240),
    href: ref.href ?? null,
    relevance: opts?.relevance ?? null,
    lineage: (opts?.lineage ?? {}) as Json,
  };
}

export function refProject(p: { id: string; name: string }): EntityRef {
  return { entity_type: "project", entity_id: p.id, title: p.name, href: `/projects/${p.id}` };
}
export function refTask(t: { id: string; title: string }): EntityRef {
  return { entity_type: "task", entity_id: t.id, title: t.title, href: `/tasks/${t.id}` };
}
export function refCommitment(c: { id: string; title: string }): EntityRef {
  return { entity_type: "commitment", entity_id: c.id, title: c.title, href: `/accountability/${c.id}` };
}
export function refDecision(d: { id: string; title: string }): EntityRef {
  return { entity_type: "decision", entity_id: d.id, title: d.title, href: `/decisions/${d.id}` };
}
export function refGoal(g: { id: string; title: string }): EntityRef {
  return { entity_type: "goal", entity_id: g.id, title: g.title, href: `/goals/${g.id}` };
}
export function refVenture(v: { id: string; name: string }): EntityRef {
  return { entity_type: "venture", entity_id: v.id, title: v.name, href: `/ventures/${v.id}` };
}
export function refActivity(a: { id: string; action: string; entity_type: string }): EntityRef {
  return { entity_type: "activity_event", entity_id: a.id, title: `${a.action} on ${a.entity_type}`, href: null };
}
export function refKnowledge(k: { id: string; title: string }): EntityRef {
  return { entity_type: "knowledge_record", entity_id: k.id, title: k.title, href: `/knowledge/${k.id}` };
}
export function refMemory(m: { id: string; title: string }): EntityRef {
  return { entity_type: "memory_item", entity_id: m.id, title: m.title, href: `/sam/memory/${m.id}` };
}