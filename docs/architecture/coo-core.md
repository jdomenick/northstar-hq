# AI COO Core - Architecture (Phase 3D.3a)

Northstar's SAM is an AI COO, not a chat assistant.
This document owns the durable core that makes that possible:

- The **operating context** that describes the organization and each venture
  at rest, versioned and reviewable.
- The **memory kind** classification that tells SAM what type of memory it
  is looking at (working / episodic / semantic / operational / strategic).
- The **founder correction and supersede** flow that keeps every claim
  editable without ever losing history.
- The **executive context assembler** that returns a bounded, ranked view
  of the world plus operating context and deterministic contradictions.

Later sub-phases (3D.3b through 3D.3f) build the deterministic engines,
extraction pipeline, briefing workflows, and minimal UI on top of this
foundation.

---

## 1. Data model

### 1.1 `organization_operating_context`

One row per organization. Fields cover the durable operating model:
`company_summary`, `mission`, `current_stage`, `business_model`,
`primary_customers`, `strategic_priorities`, `current_constraints`,
`operating_principles`, `founder_preferences`, `decision_preferences`,
`risk_tolerance`, `time_horizon`, `current_focus`, `major_goals`,
`major_risks`, `important_metrics`, `active_ventures`, `source_lineage`,
`policy_version`, `revision`, `last_reviewed_at`, `last_reviewed_by`.

- `policy_version` is stamped with `COO_OP_CONTEXT_VERSION`
  (`coo.op-context.v1`).
- `revision` is auto-incremented by a trigger every time a meaningful field
  changes.
- `source_lineage` captures which internal records the context was derived
  from so SAM can cite them later.

### 1.2 `venture_operating_context`

One row per venture. Fields mirror the organization table at venture scope:
`venture_summary`, `mission`, `target_customer`, `business_model`,
`current_stage`, `current_objectives`, `roadmap_summary`,
`active_projects`, `major_dependencies`, `current_bottlenecks`,
`current_risks`, `success_metrics`, `strategic_assumptions`,
`market_position`, `offers`, `products`, `services`, `current_priorities`,
`paused_priorities`, `operating_notes`, `source_lineage`,
`policy_version`, `revision`, `last_reviewed_at`, `last_reviewed_by`.

A scope trigger enforces that `venture_id` belongs to `organization_id`.

### 1.3 History tables

`organization_operating_context_history` and
`venture_operating_context_history` are append-only. A `SECURITY DEFINER`
trigger writes a full JSON snapshot after every meaningful update, with
`change_type` of `created` / `updated` / `reviewed`. Reviews that touch no
other field still snapshot, so the audit trail records who signed off on
the current state.

### 1.4 Memory kind

`sam_memory_items.memory_kind` is a nullable enum:
`working | episodic | semantic | operational | strategic`.

- The existing free-text `category` is preserved for backward compatibility.
- `memory_kind` is the typed axis SAM uses to weigh memory:
  - `working` - current conversation / task / entity, short-lived.
  - `episodic` - past events, statements, corrections, outcomes.
  - `semantic` - durable facts about the org, ventures, products, people.
  - `operational` - project state, deadlines, blockers, integration health.
  - `strategic` - goals, roadmaps, priorities, tradeoffs, risks.

`setMemoryKind` and `updateMemory` can classify legacy rows without a full
rewrite.

---

## 2. Access rules

All new tables follow the standard Northstar RLS pattern.

- **Read**: any active member of the organization
  (`is_org_member(organization_id, auth.uid())`).
- **Insert / update**: executive or above
  (`has_org_role(organization_id, auth.uid(), 'executive')`).
- **Delete**: admin or above.

History tables allow read to any active member and insert to executives so
the snapshot triggers can write under the calling user's session.

Personal memory (layers `founder` and `preference`) remains user-private
per ADR-0010; the new `memory_kind` column does not weaken that.

---

## 3. Server functions

All server functions run through `requireSupabaseAuth`. The middleware
injects an authenticated Supabase client so RLS enforces every rule above.

| Function | Purpose |
| --- | --- |
| `getOrgOperatingContext` | Load the current org operating context. Returns `null` if not yet set up. |
| `upsertOrgOperatingContext` | Create or update the org operating context. Stamps `policy_version` + `updated_by`. |
| `reviewOrgOperatingContext` | Founder confirmation touch. Advances `last_reviewed_at` / `last_reviewed_by`; snapshot trigger writes a `reviewed` history row. |
| `listOrgOperatingContextHistory` | Recent history rows, newest first. |
| `getVentureOperatingContext` | Same as above, venture-scoped. |
| `upsertVentureOperatingContext` | Same. Validates venture belongs to org. |
| `reviewVentureOperatingContext` | Same. |
| `listVentureOperatingContextHistory` | Same. |
| `supersedeMemory` | "Replace with a newer truth." Marks the old row `superseded`, links `superseded_by`, inserts a fresh confirmed row, and records a `correction` feedback event. History is preserved. |
| `setMemoryKind` | Classify a memory row into the typed taxonomy. |

The existing `confirmMemory`, `disputeMemory`, `markMemoryOutdated`,
`archiveMemory`, `rejectMemory`, `restoreMemory`, `updateMemory`, and
`submitMemoryFeedback` server functions already cover the rest of the
founder correction contract; 3D.3a only adds supersede + kind.

---

## 4. Executive context assembler

`assembleExecutiveContext(supabase, orgId, input)` returns
`ExecutiveContext`, the single grounded view SAM's pipeline and future
briefing workflows should call when they need "everything SAM knows,
bounded and ranked".

### Shape

```
ExecutiveContext {
  version: 'coo.assembler.v1'
  assembled_at: string
  world: AssembledContext          // existing SAM buildContext output
  operating: {
    organization: OrgOperatingContextRow | null
    venture: VentureOperatingContextRow | null
    organization_stale: boolean    // > 60 days since last review
    venture_stale: boolean
    organization_missing: boolean
    venture_missing: boolean
  }
  contradictions: ContextContradiction[]
  budget: { max_tokens: number; estimated_tokens: number }
  warnings: string[]
}
```

### Bounds and ranking

- The world overlay reuses `buildContext()` and inherits its RLS-scoped,
  bounded retrieval and memory precedence (see
  `docs/sam/03-memory.md`, ADR-0011).
- Token estimate is a soft 4-chars-per-token heuristic. When it exceeds
  `COO_LIMITS.maxAssemblerTokens` (12,000) the assembler emits a warning
  rather than truncating - the caller decides how to narrow.
- Contradiction detection is capped at
  `COO_LIMITS.maxContradictions` (25) to keep the output bounded even
  when both operating context and world are large.

### Deterministic contradictions

The assembler surfaces five kinds:

1. `stale_operating_context` - org or venture context has not been
   reviewed in more than 60 days.
2. `memory_vs_operating` - a confirmed memory mentions the recorded org
   focus or stage in a way that suggests contradiction.
3. `priority_vs_project` - a venture priority has no matching active
   project.
4. `goal_vs_activity` - an active goal has no supporting recent activity
   or matching project.
5. `risk_unattended` - a recorded risk has no recent activity referencing
   it.

These are the same category of signal that later phases (3D.3b bottleneck
engine, 3D.3d insight lifecycle) will formalize as first-class records.
They are surfaced here at assembly time so the SAM pipeline can flag them
directly without a separate query.

---

## 5. Versioning

All 3D.3 outputs are versioned so audit rows stay reproducible across
algorithm changes.

| Constant | Value | Used by |
| --- | --- | --- |
| `COO_CORE_VERSION` | `coo.core.v1.0.0` | Master version for the COO subsystem. |
| `COO_OP_CONTEXT_VERSION` | `coo.op-context.v1` | `organization_operating_context.policy_version` default and stamp. |
| `COO_VENTURE_CONTEXT_VERSION` | `coo.venture-ctx.v1` | `venture_operating_context.policy_version` default and stamp. |
| `COO_EXECUTIVE_ASSEMBLER_VERSION` | `coo.assembler.v1` | `ExecutiveContext.version`. |
| `COO_MEMORY_EXTRACTION_VERSION` | `coo.memory-extraction.v1` | Reserved for 3D.3c extractor. |

Bump the constant and ADR-note the change; do not repurpose an existing
version.

---

## 6. Explicitly out of 3D.3a

3D.3a is the durable foundation. The following belong to later sub-phases
and are intentionally not implemented here:

- Deterministic engines for accountability, bottleneck, project health,
  and prioritization (3D.3b).
- Post-conversation extraction of candidate commitments / decisions /
  memories (3D.3c).
- Feedback synthesis, goal / roadmap alignment analyzer, and insight /
  recommendation lifecycle (3D.3d).
- Daily briefing and weekly review workflows (3D.3e).
- Minimal SAM UI and the Operator to SAM rename (3D.3f).

No fake real-time BI, no provider-authored authoritative project health,
no autonomous mutations to strategy or the roadmap. Every claim SAM makes
on top of this foundation must cite a real record or explicitly mark
itself as an inference.