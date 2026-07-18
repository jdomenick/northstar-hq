# Founder Activation

Scope: build a single protected page at `/settings/founder-activation` that takes the real records you provided, lets you review/edit/deduplicate/confirm, and imports them into the existing Northstar tables. Then runs a real SAM executive review against the imported data and writes the first Executive Brief. No fake metrics, no invented dates, no invented owners.

## What ships

1. **Route** `src/routes/_authenticated/settings.founder-activation.tsx`
   - Four tabbed steps: Ventures - Projects & Goals - Decisions & Commitments - Review & Import.
   - Every proposed record is prefilled with the exact copy from your brief, editable inline, addable/removable, with per-row Skip / Merge into existing / Create separately toggles.
   - Priority selector, optional due date (blank stays blank), venture assignment.
   - Bottom of Review step: "Import selected records" button, then a completion report panel.

2. **Server functions** `src/lib/founder-activation/*.functions.ts`
   - `proposeFounderActivation` - returns duplicate candidates for each proposed record (name-normalized match against existing `ventures`, `projects`, `goals`, `decisions`, `commitments` in the current org, scoped by RLS).
   - `importFounderActivation` - transactional per-record insert. Skips existing where user chose Skip; merges (updates description/priority only when target field is null) where user chose Merge; else inserts. Writes an `activity_events` row per created/merged record with `actor_label = "Founder Activation"`. Never overwrites populated fields. Returns per-record result (created / merged / skipped / duplicate_of).
   - `runFounderActivationReview` - runs a real SAM workflow against the imported set: computes top-5 priorities, risks, blocked work, overlaps, missing owners, missing deadlines, conflicting priorities, per-venture recommendation, one SAM-executable action, one approval-required action, and a 7-day plan. Uses only imported fields; labels each item Fact / Inference / Recommendation / Missing. Persists as an `executive_insights` row of kind `founder_activation_review` and returns the payload.
   - `createInitialExecutiveBrief` - writes the first Executive Brief as an `executive_insights` row of kind `executive_brief` so Command surfaces it.

3. **Data mapping** - map onto existing tables only, no schema changes:
   - Ventures - `ventures` (name, description, status, priority).
   - Projects - `projects` (name, objective in description, status, priority, venture_id).
   - Goals - `goals` (title, definition_of_success, priority, venture_id).
   - Decisions - `decisions` (title, decision text, rationale, status = `finalized`).
   - Commitments - `commitments` (title, status, blocker, venture_id, no due_at unless provided).

4. **Duplicate detection** - case-insensitive normalized title match within org (and within venture for project/goal/commitment). UI shows the existing record inline with the three-way choice.

5. **Attribution** - every insert stamps `created_by = auth.uid()`; every activity_events row carries `actor_label = "Founder Activation"` in metadata.

6. **Tests** `src/lib/founder-activation/founder-activation.test.mjs` - pure-function coverage for normalization, duplicate detection, merge policy (never overwrites populated fields), and review aggregation (top-5 sort, blocked filter, missing-field detection).

## Out of scope this pass

- No Meta / LinkedIn / X / Reddit work.
- No schema migrations - all target tables already exist.
- No new UI outside the activation route and a single "Founder Activation" link in Settings.
- No fabricated metrics, dates, owners, or performance data in the SAM review or Brief.

## Files

Added:
- `src/routes/_authenticated/settings.founder-activation.tsx`
- `src/lib/founder-activation/types.ts`
- `src/lib/founder-activation/proposals.ts` (the exact record set from your brief)
- `src/lib/founder-activation/duplicates.ts` (pure)
- `src/lib/founder-activation/merge-policy.ts` (pure)
- `src/lib/founder-activation/activation.functions.ts` (server fns above)
- `src/lib/founder-activation/review.server.ts`
- `src/lib/founder-activation/founder-activation.test.mjs`

Modified:
- `src/routes/_authenticated/settings.tsx` - adds a "Founder Activation" entry that links to the new route.

## Completion report

The Review step renders the required 20-item completion report (page created, dup behavior, counts per category prepared / imported / skipped / merged, SAM review summary, Brief id, missing info, tests added, test totals, typecheck, build, files added/modified, exact next action) directly from the import + review results.
