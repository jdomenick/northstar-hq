## Phase 3C - SAM Executive Intelligence

Deliver an Executive Operating System layer on top of existing SAM: deterministic pattern detectors → insights → recommendations → daily digest → executive health score → action center, all fully typed, audited, RLS-scoped, and integrated with the existing `sam_invocations` / audit stack.

There is already an `executive_insights` table in the schema. Phase 3C will build on that instead of creating a parallel `sam_insights` table (avoids duplicating logic - explicit "no duplicated logic" constraint). The user's proposed `sam_insights` shape is a strict subset and will map cleanly.

---

### 1. Data model (one migration)

**Extend existing `executive_insights`** with the fields the phase requires:
- `priority` (`low|normal|high|critical`)
- `confidence` numeric 0..1
- `evidence` jsonb (structured, typed)
- `dismissed_at`, `dismissed_by`, `dismissed_reason`
- `acted_on_at`, `acted_on_by`, `acted_on_action`
- `pattern_key` text (stable detector id, for idempotency)
- `pattern_version` text
- Unique `(organization_id, pattern_key, entity_ref)` where not dismissed

**New tables (all RLS-scoped, GRANTed, audited):**

- `sam_recommendations` - id, org_id, venture_id?, insight_id?, kind, title, rationale, evidence jsonb, expected_impact, confidence, priority, status (`pending|accepted|dismissed|snoozed|converted`), snooze_until, converted_to_ref jsonb, created_at, resolved_at, resolved_by
- `sam_recommendation_events` - append-only audit (accept/dismiss/snooze/assign/convert/open)
- `sam_health_snapshots` - org_id, venture_id?, computed_at, overall numeric, categories jsonb (execution, decision_velocity, project_health, knowledge_freshness, commitment_completion, goal_progress, consistency), inputs jsonb, method_version
- `sam_executive_digests` - org_id, digest_date, sections jsonb, insight_ids uuid[], recommendation_ids uuid[], health_snapshot_id, generated_at, method_version

All tables: `GRANT` block, RLS `is_org_member`, service_role full.

---

### 2. Pattern detectors (`src/lib/sam/intelligence/patterns/`)

One file per detector, all pure over rows fetched by a shared `loadIntelligenceDataset.server.ts`. Each exports:

```
detect(dataset, context) -> DetectorFinding[]
```

Detectors (deterministic, no LLM):
- `stalled-projects` - no task update / status change in N days
- `inactive-ventures` - no activity events in N days
- `postponed-commitments` - due_date pushed >= 3 times
- `missing-owners` - project/task/commitment with null owner
- `duplicate-work` - fuzzy title match across open projects
- `repeated-decisions` - >= 3 decisions in same category / window
- `decision-reversals` - decision superseded by opposing outcome
- `goal-drift` - active goal with no linked project progress in window
- `long-running-projects` - open > 90 days, low completion delta
- `declining-completion-rate` - rolling 30d completion trend negative
- `meeting-overload` - future: gated on meetings table (skip cleanly)
- `knowledge-conflicts` - already surfaced via `sam_memory_conflicts` -> lift as insights

Central registry `patterns/registry.ts` with `PATTERN_VERSION` constants per detector; findings carry stable `pattern_key`.

---

### 3. Insights engine (`src/lib/sam/intelligence/insights.server.ts`)

- `generateInsights({ orgId })` - runs all detectors, upserts into `executive_insights` keyed by `(org, pattern_key, entity_ref)`, resurrects on new evidence, leaves user-dismissed rows dismissed unless evidence materially changes.
- Idempotent, safe to run repeatedly.
- Writes provenance to `sam_invocations` with `intent=executive_insights`.

---

### 4. Recommendation engine (`src/lib/sam/intelligence/recommendations.server.ts`)

Maps insights -> recommended actions via typed handlers:

```
InsightKind -> RecommendationBuilder
```

Kinds: `archive_project`, `reassign_owner`, `merge_knowledge`, `review_goal`, `followup_commitment`, `schedule_review`, `close_stalled_decision`, `delegate_task`, `update_documentation`.

Each recommendation stores: reason, evidence refs, confidence, expected_impact, priority. Never fabricates targets - every rec cites an existing entity id.

---

### 5. Executive Health Score (`src/lib/sam/intelligence/health.server.ts`)

Pure deterministic scoring. Each category returns `{score:0..1, inputs, method}`:

- Execution: task completion rate 30d
- Decision Velocity: median days open -> inverse
- Project Health: share not stalled / at-risk
- Knowledge Freshness: share verified & updated <90d
- Commitment Completion: on-time rate
- Goal Progress: share of goals with positive delta
- Consistency: variance of daily activity

Overall = weighted mean (versioned weights in `HEALTH_WEIGHTS_V1`). Snapshot persisted; trend = last N snapshots.

---

### 6. Executive Digest (`src/lib/sam/intelligence/digest.server.ts`)

Assembles sections from already-computed insights, recommendations, health, existing brief data:
- Today's Priorities (from priority queue + due-today commitments)
- Critical Risks (priority=critical insights)
- Projects Needing Attention (stalled/long-running)
- Upcoming Commitments (next 7d)
- Decisions Waiting (open decisions past review_date)
- Recently Learned (memory items confirmed last 24h)
- Recommended Actions (top 5 pending)
- Recent Wins (goals hit / projects completed last 7d)

Idempotent per `(org, digest_date)`.

---

### 7. Server functions (`src/lib/sam/intelligence/intelligence.functions.ts`)

All `requireSupabaseAuth`:
- `runIntelligenceSweep({orgId})` - detectors + recs + health + digest
- `listInsights({orgId, filters})`
- `dismissInsight({id, reason})`
- `listRecommendations({orgId})`
- `actOnRecommendation({id, action: accept|dismiss|snooze|assign|convert_task|convert_goal|open, payload})`
- `getHealthSnapshot({orgId, ventureId?})`
- `getHealthTrend({orgId, days})`
- `getTodayDigest({orgId})`

Every mutation appends to `sam_recommendation_events` / audit.

---

### 8. Scheduling

Register `intelligence.sweep` handler in the automation registry; cron via existing `pg_cron` tick calls it hourly per org. Digest generated once per org per local day (uses venture/org timezone helper).

---

### 9. UI

**Command Dashboard** at `/` (or `/command` - use existing `_authenticated/index.tsx` which is the current landing) - refactor to executive brief layout:
- Executive Brief header (today's date, org name)
- Top Insights (cards, priority-sorted)
- Recommendations (with action buttons)
- Business Health (overall + category radar/bars + trend sparkline)
- Priority Queue (from brief.functions)
- Recent Decisions
- Learning Feed (recent memory confirmations)

**Action Center** shared component:
- Accept / Dismiss / Remind Later / Assign / Convert to Task / Convert to Goal / Open Related Record

Style: dark, minimal, executive - reuse existing shadcn tokens; no new palette; no emoji; no flashy motion.

New route `/command/insights` for full list + filters.

Live updates via `queryClient.invalidateQueries` after mutations; realtime subscription on `executive_insights` for the current org.

---

### 10. Tests

`*.test.mjs` for each detector (fixture rows -> expected findings), health calc (known inputs -> known score), recommendation mapping, and digest assembly. Existing `bun test` runner.

---

### 11. Constraints reinforced

- No `any`, no mock rows, no placeholder text.
- Every insight/recommendation cites real entity ids via `evidence.refs[]`.
- All server logic behind `requireSupabaseAuth`; admin client only in scheduled sweep handler (loaded inside handler).
- RLS on every new table; GRANTs in same migration; no anon.
- Versioned method strings (`PATTERN_VERSION`, `RECOMMENDATION_VERSION`, `HEALTH_METHOD_V1`, `DIGEST_METHOD_V1`) stamped on every write.
- Typecheck + build must be green; targeted test suite green.

---

### Deliverable

Completion report matching prior phases: files created, tables added, detectors shipped, tests passing, typecheck + build status, and screenshots of the new Command Dashboard.
