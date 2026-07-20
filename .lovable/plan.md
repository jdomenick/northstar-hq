## Strategic renames (UI only, internal names preserved)

- Rename Command Center references to **Mission Control** in nav/headers where they still exist.
- Rename Hunter to **Growth Operator** in every user-facing label, description, empty state, badge, dialog, and audit note.
- Rename Builder to **Delivery Operator** the same way.
- Keep the DB enum values `hunter` and `builder` untouched. All renames live in a single `src/lib/mission-control/labels.ts` (`OPERATOR_LABELS[kind]`, `OPERATOR_DESCRIPTIONS[kind]`) so future changes are one edit. No migration.

## The Revenue Machine as a real state machine

Introduce a shared canonical lifecycle both operators drive together, replacing the loose "task queue" with stages that carry ownership, gates, and KPIs.

```text
Prospect -> Researched -> Contacted -> Engaged -> Discovery Scheduled
   -> Discovery Held -> Proposal Sent -> Won | Lost
   -> Project Kickoff -> In Delivery -> Launched -> Case Study
   -> Referral -> back into Prospect
```

Growth Operator owns Prospect through Won. Delivery Operator owns Project Kickoff through Referral. Won -> Project Kickoff is the handoff gate.

### Database (one migration)

- `revenue_stage` enum (12 values above) + `operator_kind` reuse.
- Add to `revenue_pipeline`: `stage revenue_stage` (backfilled from existing `stage` text), `owner_operator operator_kind`, `next_action text`, `next_action_due timestamptz`, `discovery_brief_id uuid`, `proposal_id uuid`, `close_reason text`, `lost_reason text`. Keep the old `stage` column for one release and mirror on write.
- New tables (all org-scoped, RLS on, GRANTs for authenticated + service_role, updated_at triggers):
  - `revenue_playbook_steps` (per stage: `stage`, `operator_kind`, `title`, `description`, `default_due_offset_hours`, `requires_approval bool`, `automation_key text`, `order_index`). Seeded, editable per org.
  - `revenue_stage_events` (append-only audit: `deal_id`, `from_stage`, `to_stage`, `actor_user_id`, `operator_kind`, `reason`, `payload jsonb`, `created_at`). This is the auditability spine.
  - `revenue_discovery_briefs` (`deal_id`, `client_id`, `pain_points jsonb`, `goals jsonb`, `budget_range`, `decision_makers jsonb`, `questions jsonb`, `research_summary`, `prepared_by`, `status`).
  - `revenue_launch_docs` (`deal_id`, `project_id`, `summary`, `deliverables jsonb`, `handover_url`, `status`).
  - `revenue_case_studies` (`deal_id`, `client_id`, `headline`, `metrics jsonb`, `quote`, `status`, `published_url`).
  - `revenue_kpi_snapshots` (nightly rollup: `period`, `mrr`, `pipeline_value`, `won_count`, `lost_count`, `avg_cycle_days`, `win_rate`, `by_stage jsonb`, `by_operator jsonb`).
- Extend `operator_tasks` with `deal_id uuid`, `stage revenue_stage`, `playbook_step_id uuid`, `blocks_stage_advance bool default false`, `approval_state text` (`not_required` | `pending` | `approved` | `rejected`).

### Server layer (`src/lib/mission-control/revenue-machine.server.ts`)

- `advanceStage({ dealId, toStage, reason })` - validates the transition, checks any `blocks_stage_advance` tasks are done, writes `revenue_stage_events`, updates the deal, and fans out playbook tasks for the new stage to the correct operator.
- `spawnStagePlaybook({ dealId, stage })` - inserts one `operator_tasks` row per active playbook step, respecting `requires_approval`.
- `transitionGuards` - won requires a proposal; project kickoff requires a signed close reason; launched requires a launch doc; case study requires a testimonial.
- `getDealTimeline(dealId)` - returns the ordered `revenue_stage_events` + tasks for the deal detail drawer.
- `computeRevenueKpis({ orgId, window })` - MRR from clients, pipeline value by stage, win rate, avg cycle time, per-operator throughput. Writes into `revenue_kpi_snapshots`.

### Growth Operator playbooks (seeded)

Prospect: qualify fit, enrich account. Researched: identify decision makers, capture website audit notes. Contacted: send personalized outreach draft (requires approval). Engaged: schedule discovery. Discovery Scheduled: prepare discovery brief (blocks stage advance). Discovery Held: log notes, decide go/no-go. Proposal Sent: track response, follow-up sequence. Won: trigger handoff. Lost: capture reason, feed learning.

### Delivery Operator playbooks (seeded)

Project Kickoff: create `projects` row linked to the deal, generate implementation checklist. In Delivery: weekly status check, unblock. Launched: publish launch doc (blocks stage advance). Case Study: request testimonial + metrics (requires approval to publish). Referral: send referral ask, log outcome; a successful referral seeds a new `revenue_pipeline` row in Prospect, closing the loop.

### SAM feedback loop

- On Won and on Launched, write a `sam_learning_events` row (`event_type='revenue_outcome'`) with the deal's stage timeline and any close/lost reason. No new SAM UI in this pass; the data is there for the next SAM run.

## Mission Control UI

- **Revenue Machine board** (`/mission-control` gets a new top block, and `/revenue` gets a Pipeline view rebuilt as a Kanban): one column per stage, cards showing client, owner operator, next action, days-in-stage, blocking task count. Drag or use the stage dropdown to advance; the transition goes through `advanceStage` so guards fire.
- **Deal detail drawer**: timeline (stage events + tasks), discovery brief, proposal link, launch doc, case study, referral outcomes. Approve/reject buttons on `requires_approval` tasks.
- **Operator panels** on Mission Control: labels become "Growth Operator" and "Delivery Operator", each shows queue by stage plus KPI tiles (Growth: new prospects/week, meetings booked, win rate; Delivery: active projects, on-time launches, testimonials collected).
- **KPI header** on Mission Control: MRR (current + delta), pipeline value, weighted pipeline, win rate, avg cycle days, sourced from `computeRevenueKpis`.
- **Empty states stay truthful**: when a stage has no playbook steps yet, show "No playbook defined - add steps in Settings" (Settings editor deferred to a follow-up; steps are editable via SQL in this pass).

## Automation and approvals

- Every playbook step declares `automation_key`. This pass ships with all keys set to `manual` so no external calls fire. The registry in `src/lib/mission-control/automation-registry.ts` maps keys to future handlers (`outreach.draft`, `proposal.generate`, `checklist.generate`, `testimonial.request`). The UI renders "Automated" vs "Manual" per step and, for manual steps, shows the task in the operator queue.
- `requires_approval` tasks route through the existing operator approval flow. Nothing marked "requires approval" auto-advances the stage.
- Every advance, approve, reject, complete, and cancel writes `operator_audit` and, for stage moves, `revenue_stage_events`. Full auditability with actor, timestamp, and reason.

## KPIs and dashboards

- Mission Control top strip: MRR, MRR delta, pipeline value, weighted pipeline, win rate, avg cycle days.
- Revenue page tabs: Pipeline (Kanban), Clients, Proposals, Cashflow, Referrals, plus a new **KPIs** tab reading `revenue_kpi_snapshots` with a 30/90/365 day toggle.
- A nightly `pg_cron` job hits an existing `/api/public/automation/tick` handler that calls `computeRevenueKpis` for every org with any deal.

## What ships this pass vs what stays truthful-blocked

Ships: rename, migration, playbook seed, state machine + guards + audit, deal drawer, Kanban, KPI computation, SAM learning writes, nightly KPI snapshot job, operator labels everywhere.

Truthful-blocked (visible in UI as "Manual" until armed): outreach drafting, proposal generation, testimonial requests, referral asks. These are wired as `automation_key` slots so a future pass turns them on without UI changes.

Not in this pass: playbook editor UI, per-org KPI targets, external lead sources (email/LinkedIn ingestion), Delivery calendar sync.

## Verification

- Typecheck clean.
- Manual walkthrough: create client -> create deal in Prospect -> advance through every stage -> confirm playbook tasks appear on the right operator, approval gates block advance, audit rows land, and Won triggers Delivery Operator's project kickoff tasks.
- SQL check that `revenue_stage_events` has one row per transition and `sam_learning_events` gets a `revenue_outcome` row on Won and Launched.
