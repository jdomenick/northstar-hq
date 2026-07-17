
# Phase 3D.3 - AI COO Core (SAM as Operational Intelligence)

The scope you posted is a full-quarter build (17 domains, 40+ subsystems, ~15 new tables, deterministic engines for accountability / bottlenecks / project health / prioritization, memory extraction pipeline, briefings, and UI). Attempting it in one milestone would either produce shallow stubs across everything or spend the entire session on one slice with the rest incomplete.

Below is the split I recommend, following the same pattern as 3D.2c (i / ii / iii / iv). Each sub-phase ends green with typecheck + build, honest surface, and no fake intelligence.

## Sub-milestones

### 3D.3a - Operating Context + Memory Foundation
- `organization_operating_context` and `venture_operating_context` tables (versioned, source-lineage, `last_reviewed_at`, policy_version).
- Extend `sam_memory_items` with the typed categories (working / episodic / semantic / operational / strategic) and confirmation lifecycle beyond what 3B already ships.
- Founder correction / archive / supersede APIs (server fns, no UI yet).
- `assembleExecutiveContext()` v1: bounded retrieval with token budget, ranking by recency + importance + confirmation, contradiction detection.
- Grants + RLS + audit. Typecheck + build.

### 3D.3b - Deterministic Engines (Accountability, Bottleneck, Project Health, Prioritization)
- `accountability_observations`, `bottleneck_observations`, `project_health_snapshots`, `priority_scores` tables, each with `rule_version` / `calculation_version` and evidence jsonb.
- Pure deterministic engines in `src/lib/coo/engines/*.server.ts` - no provider calls in the base score.
- Registered as automation job types on the 3D.2c Job Engine (scheduled + on-demand), not ad-hoc.
- Typecheck + build.

### 3D.3c - Commitment + Decision Intelligence + Memory Extraction
- Extend `commitments` with `source_type` / `source_id` / `evidence` / `follow_up_at` / status set from spec.
- Decision lifecycle states (needed / proposed / made / reversed / expired / blocked / outcome_unknown) + review dates.
- Post-conversation extractor: candidate memories, candidate commitments, candidate decisions - all land as `proposed` requiring founder confirmation. Extraction version stamped.
- Typecheck + build.

### 3D.3d - Feedback Synthesis + Goal/Roadmap Awareness + Insight/Recommendation Lifecycle
- Structured `user_feedback` (manual-entry only this phase; no connectors), duplicate clustering key, sentiment/urgency.
- Goal + roadmap alignment analyzer (deterministic: projects-not-supporting-goal, goals-with-no-work, too-many-priorities, sequencing conflicts).
- `sam_insights` + `sam_recommendations` lifecycle (proposed / acknowledged / accepted / rejected / superseded / expired) with evidence refs + confidence + rule_id.
- Typecheck + build.

### 3D.3e - Daily Briefing + Weekly Review Workflows
- Register both as SAM workflows on the existing workflow runner (already in `src/lib/sam/workflows/`), scheduled through the 3D.2c Job Engine.
- Deterministic sections first (what changed, overdue commitments, open decisions, bottlenecks, health drops), provider only for prose synthesis with strict citation to real records.
- Persisted `sam_briefings` / `sam_reviews` rows so results are durable and re-openable.
- Typecheck + build.

### 3D.3f - Minimal SAM UI + Rename Operator to SAM
- Rename user-facing "Operator" to "SAM" across shell + route (`/operator` -> `/sam`, keep redirect).
- SAM chat surfaces citations from context assembler; new tabs for Briefing, Recommendations (confirm/reject), Memory (view/correct/archive), Accountability inbox.
- No shell redesign. No new dashboards. Everything reads real records; empty states are honest ("no confirmed commitments yet").
- Typecheck + build.

## Confirmation

Reply with which sub-phase to start with (default: `3D.3a`), and I will build only that sub-phase in one green pass, then stop and wait - same rhythm as 3D.2c-i / ii / iii.

## Explicitly NOT in any 3D.3 sub-phase
- Live social publishing or connectors (blocked per your instructions).
- Autonomous external messaging, financial actions, destructive actions.
- Any "SAM knows everything" claim in UI copy.
- Hardcoded/fake insights - every engine outputs `{ evidence, rule_id, confidence }` or nothing.
- Provider-authored authoritative project health, priority scores, or company strategy edits.

## Technical shape (applies to every sub-phase)
- All new public tables get `GRANT` + RLS + org-scope validation triggers (matching the 3D.2c pattern).
- All server logic goes through `createServerFn` with `requireSupabaseAuth`, or as Job Engine handlers - never Supabase Edge Functions.
- Deterministic engines are pure TS, unit-testable, versioned via `*_VERSION` constants.
- Provider calls only in synthesis stages, always over deterministic inputs, always with citations verified against RLS-visible records (reusing 3B citation verifier).
- No `"—"` characters anywhere per project memory.
