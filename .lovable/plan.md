
## Ground truth from the repo (must resolve before I write code)

The brief references "existing sam_objectives / work-item architecture", "existing autonomy/kill-switch architecture", and directives. Actual state:

- **No `sam_objectives` table. No work-items table. No `sam_directives` table.** Verified via `\dt public.sam*`. The 20 sam_* tables cover invocations, memory, workflows, digests, health, recommendations, feedback, MCP - none of them are objectives or missions.
- **`content_ops_autonomy` and `content_ops_kill_switches` exist but are scoped to Content Operations only.** There is no org-wide "Pause SAM / Emergency Stop" primitive.
- **`automation_definitions` is empty** (0 rows), so there is no seeded proof automation to run.
- `sam.functions.ts` / `askSam` is analysis-only. `operations/dispatch.server.ts` exists and can propose typed ops, but `askSam` never calls it.
- `automation_jobs` + worker + `runWorkerTick` + `pg_cron` tick are real and working.

So the acceptance tests cannot be met by "wiring existing systems". Roughly 60% of what the brief calls "existing" has to be built. I want to confirm the scope with you before I write a large multi-migration + multi-file change and then discover we disagree on shape.

## Proposed proof slice (one turn of code, then verify)

Build the smallest end-to-end honest slice that satisfies acceptance tests 1-8 for one real path. No fake data, no fake completion.

### 1. Migrations (single migration)
- `sam_directives` (id, organization_id, venture_id nullable, text, scope: permanent|temporary, priority int, status: active|paused|archived, starts_at, expires_at nullable, created_by, timestamps). RLS: members read/write own org. Audited via activity_events.
- `sam_missions` (id, organization_id, venture_id nullable, title, description, status: draft|active|blocked|completed|cancelled, priority, source: chat|directive|manual, created_by, timestamps).
- `sam_mission_work_items` (id, mission_id, organization_id, title, description, status: pending|running|blocked|completed|failed, automation_job_id nullable FK, artifact jsonb, timestamps).
- `sam_org_autonomy` (organization_id PK, state: active|paused|emergency_stopped, reason, changed_by, changed_at). One row per org, upsert semantics.
- Register one `automation_definition` row per org on demand: `sam_proof_mission`.
- All tables: GRANT to authenticated + service_role, RLS scoped to org membership.

### 2. Server layer
- `src/lib/sam/directives/directives.functions.ts` - list/create/update/deactivate. Enforces org membership + `manage_sam` permission (owner/admin).
- `src/lib/sam/missions/missions.functions.ts` - list/get/create mission + work items.
- `src/lib/sam/autonomy/org-autonomy.functions.ts` - readState / pause / resume / emergencyStop / runProofMission. Emergency stop cancels queued jobs for org and requires a typed confirmation payload.
- `src/lib/sam/context-builder.server.ts` extended to include active directives in SAM system prompt (constitution first, then company constitution, then active directives ordered by priority).
- `sam.functions.ts::askSam` extended: after conversational answer, run `proposeOperationFromText`. If `status=ready` and operation is a mission-creating intent (createMission / runProofMission / setDirective), execute through a new `executeSamOperation()` that returns a structured `ActionReceipt { status, kind, ids, explanation, blockers }`. Attach receipt to the assistant message metadata as `action_receipt`. If autonomy = paused, receipt.status = blocked with reason.
- Register `sam_proof_mission` handler in `src/lib/automation/jobs/`. It:
  - Loads org + venture context, active directives.
  - Calls Lovable AI Gateway to produce a **qualified-prospect research brief** grounded in org data (name, ventures, goals). If key missing, produces a deterministic templated brief from real org data. Either way, real artifact.
  - Writes artifact to `sam_mission_work_items.artifact` (jsonb) and marks work item completed.
  - Idempotent via `idempotency_key = 'proof:<mission_id>'`.
  - Emits activity_events and sam_invocations rows for audit.

### 3. UI
- `/sam` masthead copy: remove "Read only" + false EmptyState line. Replace with: "SAM executes within your authority. When it lacks authority or information, it reports the blocker."
- Directives drawer on `/sam` (mobile-first slide-over, desktop right rail): list active directives with priority chips, add/edit/deactivate for owners/admins. Every mutation confirms + audits.
- Chat: when assistant message has `action_receipt`, render an inline receipt card under the message: status pill (Completed / Blocked / Failed / Ambiguous), created IDs as deep links, human explanation, "next step" if any. Truthful queued -> running -> completed transitions via 5-second poll on referenced mission id.
- `/sam/control`: add a Founder Controls card with Start/Resume, Pause, Emergency Stop (typed confirmation "STOP"), Run Proof Mission. Shows current operating state + active mission summary. Deep-links to mission page, work-item job page, activity feed.
- New route `/sam/missions/$id` showing mission, work items, linked jobs, artifact, audit trail.

### 4. Tests (vitest + node)
- Directive persistence + org isolation.
- Autonomy state transitions + emergency-stop cancels queued jobs.
- `parseOperationProposal` + `executeSamOperation` for mission-creating intent returns structured receipt (ready / needs_fields / blocked).
- Proof mission job handler: idempotent, produces artifact, transitions statuses, emits activity.
- Truthful "blocked" when autonomy paused.

### 5. Verification
- typecheck (tsgo) + vite build.
- Run new tests via existing `bunx vitest` path.
- Live smoke: create a directive, ask SAM "focus on getting NorthStar its first 3 customers", verify mission row + linked work item + activity event; then "run SAM proof mission" and observe job queued -> running -> completed with artifact.

## Decision I need from you

Reply **"go"** and I execute this slice in one code pass (single migration + code + tests + build). Or say **"trim"** with what to drop. I will not proceed until you confirm, because if I invent a schema you disagree with, we throw away a lot of work.

Explicit non-goals for this pass (call out if you want any of them in): full CRM/pipeline integration, real prospect research from external sources, LinkedIn/X/Meta live posting, richer digest UI, permission editor, per-user directive scoping.
