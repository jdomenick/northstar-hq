# Content Operations Engine - Audit & Gap Map (Stage 1)

Status: Stage 1 of the SAM Content Operations Engine milestone. Audit only; no
code or schema changes. This document maps every concept in the milestone's
domain model (spec sections 3-19) to either existing NorthStar Labs infrastructure
that will be reused, or a specific additive change that later stages will
introduce. It is the contract every subsequent stage builds against.

Guiding rule: reuse first, extend second, add last. No parallel scheduler, no
parallel connector framework, no parallel org/venture model.

---

## 1. Infrastructure reused as-is

These are already in the codebase and are load-bearing for Content Ops. No
changes planned in this milestone.

| Concern | Reused surface |
| --- | --- |
| Organization + venture scoping | `organizations`, `ventures`, `organization_members`, `has_org_role`, `is_org_member`, `shares_org_with` |
| Auth (server) | `requireSupabaseAuth` middleware, `context.supabase`, `context.userId` |
| Admin (server) | `supabaseAdmin` from `@/integrations/supabase/client.server`, loaded inside handlers only |
| Connector credentials + OAuth | `integration_connections`, `integration_sources`, `integration_sync_runs`, `src/lib/integrations/*` |
| Job queue + scheduling | `automation_jobs`, `automation_definitions`, `automation_claim_next_job`, `automation_cancel_job`, `automation_recover_stale_jobs`, `automation_advance_definition` |
| Worker runtime, retry, recovery, health | `src/lib/automation/{worker,retry,recovery,health,scheduler,concurrency}.server.ts` |
| Handler registry | `registerHandler` / `getHandler` in `src/lib/automation/executor.server.ts` |
| Signals bus | `signals`, `src/lib/automation/signals.server.ts` |
| SAM pipeline + memory + workflows | `src/lib/sam/**` (pipeline, memory, workflows, providers) |
| Provider abstraction (PAL) | `src/lib/sam/providers/*` - the only place vendor SDKs live |
| Venture / org operating context | `venture_operating_context(+_history)`, `organization_operating_context(+_history)` |
| Storage | `organization-documents` bucket for creative assets referenced by URL, never raw bytes in table columns |
| Paper & Ink UI | `src/components/editorial.tsx`, `src/components/page-header.tsx`, `src/components/app-shell.tsx` |
| Notifications, activity | `activity_events`, existing surfaces (extended, not replaced) |

---

## 2. Existing social_* tables - reused, some columns to extend

The prior social milestones already shipped the shape of most section-3
concepts. This milestone extends them rather than forking.

### 2.1 Reused as-is (columns already sufficient)

| Spec concept | Existing table | Notes |
| --- | --- | --- |
| Content strategy (per venture, versioned) | `social_campaigns` | Reuse for "strategy period" grouping; `metadata` jsonb carries strategic rationale + SAM recommendation |
| Editorial calendar entry (planned slot) | `social_content_plans` | One row per planned publication slot; already scoped to venture + campaign |
| Content item (core + variants) | `social_content_items` | 41 columns already; already supports platform, contentType, body, hashtags, media_requirements, risk_band, approval_status, scheduled_for, external_post_id, external_post_url, duplicate_fingerprint, source_lineage, brand_profile_version, policy_version, content_version |
| Content revision history | `social_content_versions` + `validate_scv_scope` trigger | Reuse verbatim |
| Publication record + attempts | `social_publication_attempts` + `validate_spa_scope` | Already carries idempotency_key, content_version, connector_version, external_post_id, external_post_url, error_code, status, response_summary |
| Performance / metrics | `social_content_metrics` + `validate_scmet_scope` | 27 columns; sufficient for per-platform normalized metrics |
| Connected account | `social_accounts` | Reuse; token storage handled via `integration_connections` |
| Brand profile | `venture_brand_profiles` (38 cols) | Reuse; see 2.2 for the small extension |
| Deduplication contract | `src/lib/social/deduplication.server.ts` | Reused unchanged |
| Publishing types + repost policy | `src/lib/social/publishing.types.ts` | Reused |
| Provider adapter contract stub | `src/lib/social/providers/index.ts` | Real adapter registered in Stage 6 |

### 2.2 Additive column extensions (Stage 2 migration)

Small, backward-compatible additions to existing tables. All new columns are
nullable with sensible defaults so existing rows and code paths keep working.

`venture_brand_profiles`:
  - `content_pillars jsonb not null default '[]'::jsonb` - canonical pillar list
  - `audience_segments jsonb not null default '[]'::jsonb`
  - `promotion_ratio_limit numeric(4,3)` - e.g. 0.200 for 20%
  - `posting_cadence jsonb not null default '{}'::jsonb` - per-platform per-week
  - `preferred_posting_windows jsonb not null default '[]'::jsonb`
  - `hashtag_policy jsonb not null default '{}'::jsonb`
  - `emoji_policy jsonb not null default '{}'::jsonb`
  - `profanity_policy jsonb not null default '{}'::jsonb`
  - `faith_language_policy jsonb not null default '{}'::jsonb`
  - `crisis_language_rules jsonb not null default '{}'::jsonb`
  - `required_disclaimers jsonb not null default '[]'::jsonb`
  - `sensitive_topic_guidance jsonb not null default '{}'::jsonb`
  - `competitor_references jsonb not null default '[]'::jsonb`
  - `visual_identity jsonb not null default '{}'::jsonb`

Note: `venture_brand_profiles` is already versioned via `brand_profile_version`
carried on content items; no new versioning table required.

`social_campaigns` (treated as the "strategy" record per period):
  - `strategy_period_start date`
  - `strategy_period_end date`
  - `platform_mix jsonb not null default '{}'::jsonb`
  - `promotion_ratio_limit numeric(4,3)`
  - `strategic_rationale text`
  - `sam_recommendation jsonb`
  - `superseded_by uuid references social_campaigns(id)`

`social_content_items`:
  - `parent_content_item_id uuid references social_content_items(id)` - for
    platform variants that share a core idea
  - `hook text`, `cta text`, `alt_text text`, `image_prompt text`,
    `newsletter_subject text`, `newsletter_preview text`
  - `learning_refs jsonb not null default '[]'::jsonb` - learning ids that
    influenced this piece (evidence chain)

`social_publication_attempts`:
  - `verification_status text not null default 'pending'` - values:
    `pending`, `verified`, `partial`, `failed`, `unknown`. Explicit state
    machine so "API 2xx" does not silently mean "post is live".
  - `verified_at timestamptz`
  - `content_fingerprint text` - separate from idempotency_key, mirrors the
    content_version hash used for duplicate detection at the platform

### 2.3 New tables (Stage 2 migration)

All new `public.*` tables ship GRANTs, RLS, and org+venture scope-validation
triggers in the same migration.

1. `content_ops_autonomy` - per-venture autonomy mode + kill switches.
   Columns: `id`, `organization_id`, `venture_id` (unique), `mode`
   (`draft_only|approval_required|batch_approval|guarded_autopilot|full_autopilot`,
   default `approval_required`), `platform_pauses jsonb`,
   `campaign_pauses jsonb`, `emergency_pause boolean default false`,
   `emergency_pause_reason text`, `changed_by`, `changed_at`, `policy_version`,
   audit history in `content_ops_autonomy_history` (append-only via trigger).

2. `content_ops_kill_switches` - separate table for org-wide and
   platform-wide switches that outrank venture autonomy. Columns:
   `id`, `organization_id`, `scope` (`organization|platform|venture`),
   `scope_ref` (nullable uuid or platform key), `active boolean`,
   `reason text`, `set_by`, `set_at`.

3. `content_learnings` - evidence-backed learnings produced in Stage 7.
   Columns: `id`, `organization_id`, `venture_id`, `platform`,
   `content_pillar`, `hook_pattern`, `topic`, `format`, `cta`,
   `publishing_time_bucket`, `audience_segment`,
   `observed_metric text`, `observed_delta numeric`, `baseline_metric numeric`,
   `sample_size integer`, `confidence numeric(4,3)`, `evidence_refs jsonb`
   (array of `social_content_metrics.id`), `recommendation text`,
   `valid_from date`, `valid_until date`, `superseded_by uuid`,
   `engine_version text`, `created_at`, `created_by`.
   Constraint: `sample_size >= min` enforced in service layer (not CHECK,
   because `min` depends on platform + metric).

4. `content_ops_approvals` - append-only approval log (who approved what,
   at which content_version, with which policy_version). One row per
   approval action, referencing `social_content_items.id` +
   `content_version`. Enables auditability and batch approval receipts.

### 2.4 Not adding

- No new job scheduler. Publishing uses `automation_jobs` with
  `job_type='social_publish'`, `job_family='social'`. Metrics refresh uses
  `job_type='social_metrics_refresh'`. Both registered via existing
  `registerHandler` in Stage 6/7.
- No new credential store. Provider tokens continue to live in
  `integration_connections` (encrypted at rest) and are read only inside
  server handlers.
- No new org/venture model.
- No new signals bus.

---

## 3. Service layer (Stage 3+)

New folder: `src/lib/content-ops/`. All server functions. No client imports of
`.server.ts`. Publishable module names end in `.functions.ts`. Structure:

```
src/lib/content-ops/
  autonomy.functions.ts       # get/set autonomy + kill switches (admin gated)
  profile.functions.ts        # read/write extended brand profile fields
  strategy.functions.ts       # create/approve/supersede strategy (via social_campaigns)
  calendar.functions.ts       # calendar CRUD (via social_content_plans)
  content.functions.ts        # content item + variant CRUD, revision
  approvals.functions.ts      # approve/reject/request-revision + batch
  scheduling.functions.ts     # enqueue social_publish job; cancel/reschedule
  metrics.functions.ts        # refresh + read normalized metrics
  learnings.functions.ts      # produce/list/supersede learnings
  sam-commands.functions.ts   # typed SAM action contracts
  services/
    validators.ts             # promo ratio, pillar balance, duplication, platform rules
    fingerprint.ts            # content_fingerprint + idempotency_key
    autonomy-eval.server.ts   # server-only autonomy + kill-switch evaluation
    publish-eligibility.server.ts # pre-publish revalidation gate
  schemas/
    profile.ts strategy.ts calendar.ts content.ts approval.ts publish.ts
```

All planning/generation model calls go through the existing PAL
(`src/lib/sam/providers/*`); Content Ops never imports a vendor SDK.

---

## 4. Publishing handler + connector adapter (Stage 6)

- Job type: `social_publish`. Handler registered in
  `src/lib/social/jobs/publish.server.ts`, auto-loaded from
  `src/lib/automation/executor.server.ts` alongside `website-sync`.
- Handler responsibilities: load content_item at pinned content_version,
  re-evaluate autonomy + kill switches + eligibility, resolve adapter from
  `SOCIAL_PROVIDERS` registry, call `publish`, persist
  `social_publication_attempts` row with `verification_status`, verify via
  adapter's `retrievePublication`, update content item state, emit signal.
- Idempotency: `automation_jobs.idempotency_key = hash(content_item_id,
  content_version, social_account_id)`. Attempt-level
  `content_fingerprint = hash(rendered_payload)`.
- Adapter contract lives in `src/lib/social/providers/types.ts` (Stage 6):
  `validateConnection`, `validatePermissions`, `validateContent`,
  `publish`, `retrievePublication`, `retrieveMetrics`,
  `cancelScheduled?`, `refreshCredentials`, `normalizeError`.
- Only one real adapter ships in this milestone. Choice deferred to the
  operator's answer to plan-question 2. Every other platform stays a
  truthful `implementationStatus: "not_implemented"` blocked state in the
  UI and refuses to publish at the service layer.

---

## 5. UI (Stage 5)

Route root: `src/routes/_authenticated/content/`. Uses only Paper & Ink
primitives; no rounded SaaS cards, no chat bubbles, no fake graphs.

```
content/route.tsx        # masthead + section nav
content/index.tsx        # "Command" - what needs attention today
content/calendar.tsx     # month/week/agenda editorial calendar
content/drafts.tsx       # generated but unapproved
content/approvals.tsx    # approval queue (single, variant, batch, campaign)
content/scheduled.tsx    # queue view (from automation_jobs)
content/published.tsx    # published ledger with external URLs
content/performance.tsx  # normalized metrics + real comparisons only
content/learnings.tsx    # evidence-backed learnings
content/settings.tsx     # autonomy + kill switches + brand profile
```

The Brief (`_authenticated/index.tsx`) gains a Content Ops section wired to
real approval/scheduled/failure/performance queries. No fabricated activity.

---

## 6. Explicit blockers acknowledged up front

- Instagram Content Publishing, Facebook Page publishing, LinkedIn
  organization posting, and X posting all require reviewed apps or paid
  API tiers. The milestone spec (section 11) requires exactly one real
  connector; the rest ship as truthful blocked states. The operator picks
  the initial platform (plan question 2) based on which credentials +
  publishing permissions actually exist today.
- No provider is called until Stage 6, so Stage 2-5 can complete
  regardless of the connector choice.

---

## 7. Stage exit criteria

Each stage must end green (typecheck for every stage; production build for
stages 2, 5, 6, 9). A stage that leaves a public route pointing at a
not-yet-implemented service is not "done".

| Stage | Exit criteria |
| --- | --- |
| 1 (this doc) | Doc merged; no code changes |
| 2 | Migration applied with GRANTs + RLS + triggers; typecheck + build green |
| 3 | Service layer + schemas + validators shipped; unit tests for validators |
| 4 | Planning + generation pipeline callable end to end against Healing Path; structured output validated; no unvalidated writes |
| 5 | Paper & Ink workspace live on real data with empty/loading/error states; approvals wired; typecheck + build green |
| 6 | One real connector: real OAuth, real publish, real external URL, real verification, retry + idempotency proven with a live test post; typecheck + build green |
| 7 | Metrics refresh job scheduled; learnings only above min sample; learnings feed next plan |
| 8 | Typed SAM commands + Brief items linked to source records |
| 9 | E2E Healing Path run in Approval Required mode; completion report per section 28; typecheck + build green |

---

## 8. Deviations from the milestone spec (documented, not silent)

1. Spec section 3 lists "content strategy" and "editorial calendar" as
   separate top-level concepts. This audit reuses `social_campaigns` as the
   strategy record and `social_content_plans` as the calendar. The
   underlying columns already cover the spec's fields; adding two more
   tables would fork the model without benefit.
2. Spec section 3 lists "publication record" and section 13 lists a
   detailed verification state machine. Rather than a new
   `publications` table, this audit adds `verification_status` +
   `verified_at` to the existing `social_publication_attempts` and treats
   the latest attempt per (content_item, content_version, social_account)
   as the authoritative publication record.
3. Autonomy is intentionally split into two tables (`content_ops_autonomy`
   at the venture level, `content_ops_kill_switches` at the
   org/platform/venture scope) so an org-wide emergency pause can outrank
   a venture's autonomy without editing venture rows.
4. `content_learnings.sample_size` minimums are enforced in the service
   layer, not as a CHECK constraint, because minimums are per-platform
   + per-metric and would require a mutable CHECK.

Any further deviation must be added to this section in the same PR that
introduces it.

## Stage 2 - 5 Progress

Stage 2 (migration): shipped additive extensions to
`venture_brand_profiles`, `social_campaigns`, `social_content_items`, and
`social_publication_attempts`; new tables `content_ops_autonomy`,
`content_ops_autonomy_history`, `content_ops_kill_switches`,
`content_learnings`, `content_ops_approvals`. RLS + scope triggers
enabled.

Stage 3 (server services, `src/lib/content-ops/`): `constants`, `errors`,
`membership.server`, Zod `schemas`. Server functions:
`autonomy.functions` (get/set + emergency pause + kill switches +
`assertPublishingAllowed`), `profile.functions`, `strategy.functions`,
`calendar.functions`, `content.functions`, `approvals.functions` (single +
batch, deliberate confirmation token required),
`scheduling.functions` (blocks unapproved items; enqueues
`social.publish` automation job), `metrics.functions`, `learnings.functions`.

Stage 4 (planning + generation): `planning.server` deterministic slot
planner (pillar balance + promo ratio); `generation.server` validates
structured LLM output against `GenerationOutputSchema`. Provider adapter
contract updated (`PublishInput`/`PublishResult`/`MetricsResult`,
`implementationStatus` widened to include `blocked_no_credentials`).
`beehiivAdapter` registered as truthfully blocked
(`blocked_no_credentials`); requires `BEEHIIV_API_KEY` +
`BEEHIIV_PUBLICATION_ID` and `posts:write` scope. Publish is a noop until
those are present and the adapter's POST/verify flow is wired.

Stage 5 (UI): `src/routes/_authenticated/content-ops.tsx` renders the
workspace in Paper & Ink (Autonomy panel, Awaiting approval, Scheduled,
Strategies, Learnings). Uses the first accessible venture; a venture
switcher lands in a later stage.

### Live publishing status

Beehiiv: BLOCKED - `BEEHIIV_API_KEY` and `BEEHIIV_PUBLICATION_ID` are not
present in the environment. Provide both, confirm the account has
`posts:write` on the target publication, then wire the POST + verify
calls in `src/lib/social/providers/beehiiv.ts`. No other platform has
valid credentials in the environment either, so no silent switch is
possible; end-to-end publishing remains blocked pending credentials.