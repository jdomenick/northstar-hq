# Phase 3B — SAM Memory & Executive Graph

This phase builds Northstar's structured Memory system and Executive Graph foundation on top of the Phase 3A SAM pipeline, without adding autonomous actions, external integrations, or model training. It also finishes the deferred Archive Center restore wiring.

Scope is large; I will implement in the order below to keep each step verifiable.

## 1. Database Migrations (single migration, approval-gated)

New tables (all `public`, organization-scoped, RLS on, GRANT to authenticated + service_role):

- `sam_memory_items` — layered structured memory (founder / organization / venture / operational / historical / preference), with status (proposed/confirmed/disputed/outdated/superseded/archived), confidence, source refs, effective/expiry, soft-delete.
- `sam_memory_versions` — immutable snapshots per material edit.
- `sam_memory_feedback` — accurate / inaccurate / incomplete / outdated / disputed.
- `sam_memory_conflicts` — detected pairs w/ status (open/resolved/dismissed).
- `executive_graph_edges` — normalized edge table w/ constrained relationship_type, same-org validation via trigger.
- `sam_learning_events` — structured learning capture, per-org, per-user.
- `sam_response_feedback` — helpful/not/partial/incorrect/missing_context on `conversation_messages`.

Enums:
- `sam_memory_layer`, `sam_memory_status`, `sam_memory_source_type`
- `graph_relationship_type`, `graph_entity_type`
- `sam_learning_event_type`, `sam_feedback_type`, `sam_response_feedback_type`

RLS:
- Memory: org members read organization/venture/operational/historical layers; **founder & preference memory readable only by `owner_user_id`** (or admin only if explicitly configured — default deny to others). Writes gated by role via `has_org_role`.
- Graph edges: read for active org members; writes require member+; trigger validates both endpoints belong to same org.
- Learning events & feedback: user-scoped write, org-scoped read for admins.

Helper SQL functions:
- `sam_can_read_memory(item_id)` (security definer) to centralize privacy checks.
- `sam_validate_graph_edge()` trigger.
- `sam_memory_version_on_update()` trigger writing to `sam_memory_versions` on material change.

## 2. Server-Side Modules (`src/lib/sam/`)

- `memory/schema.ts` — Zod types for layers, statuses, items, proposals, versions, feedback.
- `memory/precedence.ts` — deterministic precedence algorithm (versioned as `MEMORY_PRECEDENCE_VERSION = "v1"`).
- `memory/decay.ts` — confidence decay by age/expiry (`MEMORY_DECAY_VERSION = "v1"`).
- `memory/conflict.ts` — deterministic conflict detection (same layer + category + subject/venture, contradictory statement heuristics).
- `memory/proposals.server.ts` — proposal engine: classify candidates from a conversation turn into `{layer, category, statement, structured_value, source, confidence, expiration_hint, reason}`; always saved as `status='proposed'`.
- `memory/memory.functions.ts` — `listMemory`, `getMemory`, `createMemory`, `updateMemory`, `confirmMemory`, `rejectMemory`, `disputeMemory`, `markOutdated`, `archiveMemory`, `restoreMemory`, `listProposals`, `listVersions`, `submitFeedback`, `listConflicts`, `resolveConflict`. All use `requireSupabaseAuth`; server validates org, owner, venture scope; forbids client-set `organization_id` / `owner_user_id` overrides.
- `graph/projection.server.ts` — logical projection over existing tables (`organization|profile|member|venture|project|task|goal|decision|commitment|knowledge|document|memory|activity`) + `executive_graph_edges`.
- `graph/traversal.server.ts` — `getEntityNode`, `getEntityNeighbors`, `getRelatedEntities`, `getSupportingEvidence`, `getContradictions`, `getUpstreamDependencies`, `getDownstreamImpact`, `getVentureGraph`, `getOrganizationGraphContext`. Bounded (depth ≤ 3, edges ≤ 200, results ≤ 50).
- `graph/graph.functions.ts` — narrow, non-arbitrary server fns (never a raw query endpoint).
- `learning/events.server.ts` + `learning/learning.functions.ts` — record accepted/rejected/edited/… events.
- Update `context-builder.server.ts` — pull confirmed memory + graph neighbors; exclude expired/superseded/proposed from trusted context; label uncertainty context; log memory considered/selected/excluded + graph depth + conflicts into audit metadata.
- Update `confidence.ts` — memory-aware signals (confirmation, source reliability, age, expiration, supporting count, conflicts, scope match). Bumped to `v2.deterministic`.
- Update `citations.ts` — support `memory_item`, `memory_source`, `graph_edge`; lineage chain in the response schema.
- Update `pipeline.server.ts` — feed memory + graph into context; after final response, offer proposals via proposal engine (never auto-confirm).
- Update `audit.server.ts` — new fields (memory_considered_ids, memory_selected_ids, memory_excluded_ids, conflict_count, graph_nodes, graph_edges_traversed, graph_depth, precedence_version, memory_framework_version, confidence_framework_version, citation_lineage, learning_event_refs).
- Update `constants.ts` — new limits + version constants:
  - `MEMORY_FRAMEWORK_VERSION`, `MEMORY_PRECEDENCE_VERSION`, `MEMORY_DECAY_VERSION`, `EXECUTIVE_GRAPH_VERSION`, `GRAPH_TRAVERSAL_VERSION`, `LEARNING_EVENT_SCHEMA_VERSION`, `RESPONSE_FEEDBACK_VERSION`
  - `SAM_MEMORY_MAX_LIST`, `SAM_MEMORY_MAX_CONTEXT`, `SAM_GRAPH_MAX_DEPTH`, `SAM_GRAPH_MAX_NODES`, `SAM_GRAPH_MAX_EDGES`, `SAM_LEARNING_EVENT_MAX_LIST`.

## 3. Client Hooks & UI

- `src/lib/data-hooks.ts` — add memory / proposal / version / feedback / conflict / learning-event / response-feedback hooks with targeted invalidation.
- New route: `src/routes/_authenticated/sam.memory.tsx` (child of `/sam`) — Memory workspace tabs: **All**, **Proposals**, **Conflicts**, **Archive**. Filters: layer, venture, status; search. Row actions: confirm / edit / reject / dispute / mark outdated / archive / restore / view versions / view source.
- Reusable components under `src/components/sam/memory/`:
  - `MemoryList`, `MemoryRow`, `MemoryDetailSheet`, `MemoryEditorDialog`, `ProposalReviewCard`, `ConflictCard`, `VersionHistoryDrawer`, `SourceCitationChip`, `MemoryLayerBadge`, `MemoryStatusBadge`.
- SAM chat surface: add message-level feedback control (helpful / not / partial / incorrect / missing_context + optional note); shows "SAM proposed N memories" affordance linking to review.
- SAM Settings tab: real form backed by `sam_settings` (style, challenge level, show citations, show confidence, allow memory proposals, include founder/org/venture memory toggles, retain history, memory review reminders). Owner/admin-only fields gated by `has_org_role`.

## 4. Archive Center Completion

Wire the already-created `useRestoreVenture / Goal / Decision / Commitment` hooks into the Archive UI (confirmation dialog, activity log entry, targeted invalidation, role check). Contained cleanup — no schema changes.

## 5. Docs

- `docs/sam/adr/0010-memory-privacy-scopes.md` — founder/preference memory is per-user private by default.
- `docs/sam/adr/0011-memory-precedence-v1.md`
- `docs/sam/adr/0012-executive-graph-relational-projection.md`
- Update `docs/sam/README.md` with 3B status.

## 6. Verification

- `tsgo` typecheck, production build.
- Adversarial checks: cross-org memory, cross-org edges, forged `owner_user_id`, proposal-as-fact, expired-in-trusted-context.
- Browser smoke: create manual memory → refresh → confirm proposal → conflict surfaces → archive restore round-trip → SAM reply cites memory.

## Explicit Non-Goals (unchanged from your brief)

No autonomous actions, no external integrations, no background agents, no fine-tuning, no exposure of chain-of-thought, no cross-org learning, no arbitrary client graph query endpoint, no replacement of curated `knowledge_records` with memory.

## Deliverable Order (each step ends with a verifiable state)

1. Migration (approval).
2. Server memory + graph modules + hooks (no UI).
3. Context builder + confidence + citations + audit updates.
4. Memory UI + SAM Settings form + response feedback.
5. Archive Center restore wiring.
6. ADRs + version constants + docs.
7. Typecheck + build + smoke test + final report.

Ready to start with the migration on approval.
