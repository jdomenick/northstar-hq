# ADR-0012  -  Executive Graph as a Relational Projection

Status: Accepted (Phase 3B)

## Context

Northstar's architecture calls for an Executive Graph without introducing a
graph database or unbounded traversal endpoints exposed to clients.

## Decision

- The graph is a **logical projection** over existing Supabase tables
  (ventures, projects, tasks, goals, decisions, commitments, knowledge,
  documents, memory, activity, members, profiles, organization).
- Derived edges come from existing foreign keys; stored edges live in
  `public.executive_graph_edges` with a database trigger
  `validate_graph_edge_scope` that rejects any edge whose endpoints aren't
  both in `organization_id`.
- Traversal is **bounded** by `SAM_GRAPH_LIMITS` (depth ≤ 3, neighbours ≤
  50, edges ≤ 500) and only accessible through narrowly-typed server fns
  (`getNeighbors`, `getVentureGraphFn`). There is no raw query surface.
- RLS on `executive_graph_edges` limits reads to active organization
  members; writes require `member+`; hard deletes require admin.

## Consequences

- Cross-organization edges are impossible at the database layer, not just
  at the app layer.
- We can adopt a real graph store later without changing the API contract.
- Rich traversal metrics (upstream / downstream / contradiction) are added
  incrementally on top of `getEntityNeighbors`.