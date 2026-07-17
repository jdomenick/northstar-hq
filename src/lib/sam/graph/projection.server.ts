// Logical Executive Graph projection over the existing relational schema.
// Does NOT use a graph database. Deterministic, RLS-scoped, bounded.
// See docs/sam/02-executive-graph.md and ADR-0012.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SAM_GRAPH_LIMITS } from "@/lib/constants";

export type GraphEntityType =
  | "organization"
  | "profile"
  | "member"
  | "venture"
  | "project"
  | "task"
  | "goal"
  | "decision"
  | "commitment"
  | "knowledge"
  | "document"
  | "memory"
  | "activity";

export interface GraphNode {
  id: string;
  type: GraphEntityType;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id?: string;
  source: { type: GraphEntityType; id: string };
  target: { type: GraphEntityType; id: string };
  relationship: string;
  weight?: number;
  source_of_edge: "derived" | "stored" | "memory";
}

// ---------------------------------------------------------------------------
// Neighbours for a single node — mixes derived edges (FKs) with stored ones.
// ---------------------------------------------------------------------------
export async function getEntityNeighbors(
  supabase: SupabaseClient<Database>,
  orgId: string,
  entity: { type: GraphEntityType; id: string },
): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const push = (n: GraphNode) => {
    if (!nodes.find((x) => x.type === n.type && x.id === n.id)) nodes.push(n);
  };
  const pushEdge = (e: GraphEdge) => edges.push(e);

  switch (entity.type) {
    case "venture": {
      const { data: v } = await supabase
        .from("ventures").select("id, name").eq("id", entity.id).maybeSingle();
      if (!v) return { nodes, edges };
      push({ id: v.id, type: "venture", label: v.name });
      const [{ data: projects }, { data: goals }, { data: docs }] = await Promise.all([
        supabase.from("projects").select("id, name").eq("venture_id", v.id).is("deleted_at", null).limit(SAM_GRAPH_LIMITS.maxNeighbors),
        supabase.from("goals").select("id, title").eq("venture_id", v.id).is("deleted_at", null).limit(SAM_GRAPH_LIMITS.maxNeighbors),
        supabase.from("documents").select("id, title").eq("venture_id", v.id).is("deleted_at", null).limit(SAM_GRAPH_LIMITS.maxNeighbors),
      ]);
      for (const p of projects ?? []) {
        push({ id: p.id, type: "project", label: p.name });
        pushEdge({ source: { type: "project", id: p.id }, target: entity, relationship: "belongs_to", source_of_edge: "derived" });
      }
      for (const g of goals ?? []) {
        push({ id: g.id, type: "goal", label: g.title });
        pushEdge({ source: { type: "goal", id: g.id }, target: entity, relationship: "advances", source_of_edge: "derived" });
      }
      for (const d of docs ?? []) {
        push({ id: d.id, type: "document", label: d.title });
        pushEdge({ source: { type: "document", id: d.id }, target: entity, relationship: "references", source_of_edge: "derived" });
      }
      break;
    }
    case "project": {
      const { data: p } = await supabase
        .from("projects").select("id, name, venture_id, goal_id").eq("id", entity.id).maybeSingle();
      if (!p) return { nodes, edges };
      push({ id: p.id, type: "project", label: p.name });
      if (p.venture_id) {
        const { data: v } = await supabase.from("ventures").select("id, name").eq("id", p.venture_id).maybeSingle();
        if (v) {
          push({ id: v.id, type: "venture", label: v.name });
          pushEdge({ source: entity, target: { type: "venture", id: v.id }, relationship: "belongs_to", source_of_edge: "derived" });
        }
      }
      if (p.goal_id) {
        const { data: g } = await supabase.from("goals").select("id, title").eq("id", p.goal_id).maybeSingle();
        if (g) {
          push({ id: g.id, type: "goal", label: g.title });
          pushEdge({ source: entity, target: { type: "goal", id: g.id }, relationship: "advances", source_of_edge: "derived" });
        }
      }
      const { data: tasks } = await supabase.from("tasks").select("id, title").eq("project_id", p.id).is("deleted_at", null).limit(SAM_GRAPH_LIMITS.maxNeighbors);
      for (const t of tasks ?? []) {
        push({ id: t.id, type: "task", label: t.title });
        pushEdge({ source: { type: "task", id: t.id }, target: entity, relationship: "belongs_to", source_of_edge: "derived" });
      }
      break;
    }
    default:
      break;
  }

  // Stored edges from executive_graph_edges (both directions).
  const { data: stored } = await supabase
    .from("executive_graph_edges")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .or(
      `and(source_entity_type.eq.${entity.type},source_entity_id.eq.${entity.id}),and(target_entity_type.eq.${entity.type},target_entity_id.eq.${entity.id})`,
    )
    .limit(SAM_GRAPH_LIMITS.maxEdges);
  for (const e of stored ?? []) {
    pushEdge({
      id: e.id,
      source: { type: e.source_entity_type as GraphEntityType, id: e.source_entity_id },
      target: { type: e.target_entity_type as GraphEntityType, id: e.target_entity_id },
      relationship: e.relationship_type,
      weight: Number(e.weight ?? 1),
      source_of_edge: "stored",
    });
  }

  return { nodes, edges };
}

// Convenience — venture graph slice used by context builder.
export async function getVentureGraph(
  supabase: SupabaseClient<Database>,
  orgId: string,
  ventureId: string,
) {
  return getEntityNeighbors(supabase, orgId, { type: "venture", id: ventureId });
}

export async function getOrganizationGraphContext(
  supabase: SupabaseClient<Database>,
  orgId: string,
) {
  const { data: stored } = await supabase
    .from("executive_graph_edges")
    .select("*")
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .limit(SAM_GRAPH_LIMITS.maxEdges);
  return stored ?? [];
}