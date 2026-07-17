// Multi-hop graph helpers. Deterministic, bounded, RLS-scoped.
// Wraps `getEntityNeighbors` from projection.server.ts to walk up to
// SAM_GRAPH_LIMITS.maxDepth hops with hard caps on nodes/edges.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { SAM_GRAPH_LIMITS } from "@/lib/constants";
import {
  getEntityNeighbors,
  type GraphEdge,
  type GraphEntityType,
  type GraphNode,
} from "./projection.server";

export interface TraversalResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  depthReached: number;
  truncated: boolean;
}

function key(n: { type: GraphEntityType; id: string }) {
  return `${n.type}:${n.id}`;
}

// Generic bounded BFS over neighbours.
export async function traverse(
  supabase: SupabaseClient<Database>,
  orgId: string,
  origin: { type: GraphEntityType; id: string },
  opts: { maxDepth?: number; directions?: "both" | "outbound" | "inbound" } = {},
): Promise<TraversalResult> {
  const maxDepth = Math.min(opts.maxDepth ?? SAM_GRAPH_LIMITS.maxDepth, SAM_GRAPH_LIMITS.maxDepth);
  const dir = opts.directions ?? "both";

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const seenEdge = new Set<string>();
  const visited = new Set<string>([key(origin)]);
  let frontier: Array<{ type: GraphEntityType; id: string }> = [origin];
  let depthReached = 0;
  let truncated = false;

  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: Array<{ type: GraphEntityType; id: string }> = [];
    for (const entity of frontier) {
      if (nodes.size >= SAM_GRAPH_LIMITS.maxNodes || edges.length >= SAM_GRAPH_LIMITS.maxEdges) {
        truncated = true;
        break;
      }
      const { nodes: ns, edges: es } = await getEntityNeighbors(supabase, orgId, entity);
      for (const n of ns) nodes.set(key(n), n);
      for (const e of es) {
        if (dir === "outbound" && !(e.source.type === entity.type && e.source.id === entity.id)) continue;
        if (dir === "inbound" && !(e.target.type === entity.type && e.target.id === entity.id)) continue;
        const ek = `${key(e.source)}->${key(e.target)}:${e.relationship}`;
        if (seenEdge.has(ek)) continue;
        seenEdge.add(ek);
        edges.push(e);
        const other = e.source.type === entity.type && e.source.id === entity.id ? e.target : e.source;
        const okey = key(other);
        if (!visited.has(okey)) {
          visited.add(okey);
          next.push(other);
        }
        if (edges.length >= SAM_GRAPH_LIMITS.maxEdges) { truncated = true; break; }
      }
    }
    depthReached = depth;
    if (truncated) break;
    frontier = next;
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    depthReached,
    truncated,
  };
}

export function getRelatedEntities(
  supabase: SupabaseClient<Database>,
  orgId: string,
  origin: { type: GraphEntityType; id: string },
  maxDepth: number = 2,
) {
  return traverse(supabase, orgId, origin, { maxDepth });
}

export function getUpstreamDependencies(
  supabase: SupabaseClient<Database>,
  orgId: string,
  origin: { type: GraphEntityType; id: string },
  maxDepth: number = SAM_GRAPH_LIMITS.maxDepth,
) {
  return traverse(supabase, orgId, origin, { maxDepth, directions: "outbound" });
}

export function getDownstreamImpact(
  supabase: SupabaseClient<Database>,
  orgId: string,
  origin: { type: GraphEntityType; id: string },
  maxDepth: number = SAM_GRAPH_LIMITS.maxDepth,
) {
  return traverse(supabase, orgId, origin, { maxDepth, directions: "inbound" });
}