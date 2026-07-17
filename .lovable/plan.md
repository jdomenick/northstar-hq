
# SAM Content Operations Engine - Staged Plan

This milestone is a full vertical business loop (strategy -> plan -> generate -> approve -> schedule -> publish -> verify -> measure -> learn -> replan). It is genuinely multiple weeks of work across many turns. I will not pretend to ship it in one turn, and I will not fake a "complete" connector. Below is how I propose to sequence it so every turn ends on green typecheck + build and each stage produces something real.

Before I start, two decisions are needed from you (question 1 and 2 below). Everything else I will drive from existing Northstar architecture.

## Reuse (no duplication)

I will build on top of, not beside:
- `integration_connections`, `integration_sources`, `integration_sync_runs`
- `automation_jobs`, `automation_definitions`, scheduler, worker, retry, recovery, health
- Existing `social_*` tables (accounts, campaigns, content_plans, content_items, content_versions, content_metrics, publication_attempts) - these already cover most of section 3's model
- `venture_brand_profiles`, `venture_operating_context`, `organization_operating_context`
- SAM pipeline, memory, workflows, provider abstraction
- Paper & Ink primitives in `src/components/editorial.tsx`

Gaps I expect to fill (not rebuild): venture content operating profile fields not yet on `venture_brand_profiles`, autonomy mode + kill switches, content_learnings table, publishing verification state machine on top of `social_publication_attempts`, connector adapter contract in `src/lib/social/providers/`.

## Stages (each stage = one or more turns, each ends green)

1. Audit + gap doc. Read existing social_*, brand profiles, automation runtime, SAM planner surface. Produce `docs/architecture/content-operations.md` mapping every section-3 concept to an existing or new table. No code changes.
2. Domain migration. Additive columns + new tables (`content_learnings`, `venture_content_autonomy`, kill-switch flags). GRANTs + RLS + audit history. No app code yet.
3. Server services: profile, strategy, calendar, content item, variant, asset brief, approval, autonomy, kill switch. `createServerFn` under `src/lib/content-ops/`. Schema-validated. Reuses automation queue for scheduling.
4. Planning + generation pipeline. Deterministic validators (promo ratio, pillar balance, duplication, platform rules) run before persistence. Provider call via existing PAL. Structured output only.
5. Paper & Ink Content Operations workspace under `/_authenticated/content/` (Command, Calendar, Drafts, Approvals, Scheduled, Published, Performance, Learnings, Settings). Editorial calendar + approval queue on real data.
6. One real publishing connector, end to end, honestly. Choice driven by question 2 below. Real OAuth, real publish, real external URL, real verification, real metrics where the API allows. Idempotency key + content fingerprint. Uses `automation_jobs` for scheduling and retry.
7. Metrics collection + learning engine. Scheduled metric refresh job. Learnings only when minimum sample thresholds are met, always with evidence refs.
8. SAM typed commands + Brief integration + notifications. Typed action contracts, not text parsing. Brief items link back to source records.
9. E2E verification with Healing Path in Approval Required mode. Completion report per section 28.

I will run typecheck at the end of every stage and the production build at the end of stages 2, 5, 6, and 9. I will not advance a stage while red.

## Explicit non-goals for this milestone

- No Gmail / Calendar / Drive ingestion work beyond what directly feeds Content Ops.
- No second visual redesign.
- No parallel scheduler, connector framework, or org/venture model.
- No Full Autopilot default. New ventures start in Approval Required.
- No "complete" claim on any connector that cannot actually publish + verify with real credentials.

## Technical notes (for the record, safe to skim)

- Content model: extend `social_content_items` + `social_content_versions` rather than forking. Add `content_learnings`, `venture_content_autonomy`, `content_ops_kill_switches`, and audit history tables. Every new `public.*` table gets GRANTs in the same migration.
- Publishing: `automation_jobs` with `job_type='social_publish'`, handler registered via existing `registerHandler`. Idempotency key = hash(content_item_id, content_version, social_account_id). Content fingerprint stored on the attempt.
- Adapter contract lives in `src/lib/social/providers/` (already stubbed). Real adapter added only for the chosen initial platform.
- Autonomy + kill switches evaluated server-side inside the publish handler, not the UI.
- Learnings require min sample size + baseline comparison; provider may explain, must not invent.

## Questions before I start

1. Approval scope for section 25. Confirm: initial live validation runs in Approval Required mode against Healing Path, and I do not publish anything publicly without you explicitly approving each item in the UI. Yes/no.
2. Initial real connector. You listed Beehiiv, Facebook Page, Instagram Business, LinkedIn, X, Reddit. Which ONE do you already have working credentials + publishing permissions for today? (Meta/Instagram require app review for Instagram Content Publishing; X requires paid tier for posting; LinkedIn organization posting needs a reviewed app; Beehiiv is usually the fastest real path via API key.) Tell me the one and I will build that adapter end to end first.

Once you answer those two, I will start with Stage 1 (audit + gap doc) in the next turn.
