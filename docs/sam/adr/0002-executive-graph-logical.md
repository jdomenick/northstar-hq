# ADR-0002: Executive Graph is logical, not a graph database

- Status: Accepted
- Date: 2026-07-17
- Related: docs/sam/02-executive-graph.md

## Context
SAM needs graph-shaped traversals across entities that already live in Postgres with RLS. Introducing a dedicated graph DB (Neo4j, etc.) would double the operational surface and duplicate the tenant-isolation model.

## Decision
Model the Executive Graph as a logical projection over the existing relational schema. Pure functions in `src/lib/sam/graph/*` materialize nodes and edges on demand from Supabase reads.

## Alternatives considered
- **Neo4j / DuckDB PGQ.** Rejected  -  operational cost, second RLS story, premature.
- **Postgres recursive CTEs only.** Kept as an implementation detail behind the projection.

## Rationale
RLS stays authoritative. Traversal policies live in TypeScript where they're easy to test and iterate. If scale later demands a real graph DB, the projection layer is the seam.

## Consequences
- Positive: one source of truth, one RLS model, easy testing.
- Negative: some traversals will be less efficient than a native graph DB.
- Follow-ups: benchmark traversal cost per intent in Phase 3.