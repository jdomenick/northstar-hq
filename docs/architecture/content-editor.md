# Shared Content Operations editor (S1b)

The Content Operations editor is the single authoring surface for every
outbound content destination in NorthStar Labs. Its job is to make one operator
intent (a "content item") faithfully compose across an open-ended set of
platforms - Facebook, Instagram, X, LinkedIn, Reddit today; Threads, TikTok,
YouTube, Pinterest, Bluesky, Beehiiv, and email tomorrow - without needing
platform-specific UIs.

## Data model

No schema changes were required for S1b. Existing tables carry the model:

- `social_content_items` - one row per platform variant. A "content group"
  is one root row plus zero or more child rows joined by
  `parent_content_item_id`.
- `social_content_versions` - immutable snapshot per save (content hash,
  actor, change reason). Provides real revision history.
- `content_ops_approvals` - immutable approval log with `content_version`,
  action, actor. Supports approve / reject / requested_revision /
  batch_approved / revoked.

Additive metadata lives inside existing JSONB columns rather than new
columns:

- `metadata.editor_platform` - editor's platform key (may be non-DB, e.g.
  `beehiiv` / `email`; the DB `platform` column is coerced to `other` in
  that case).
- `metadata.mentions`, `metadata.media` (mirrored to `media_requirements`
  on save), `metadata.pillar_id`, `metadata.objective`,
  `metadata.promotion_classification`, `metadata.risk_score`,
  `metadata.generation_provenance`.

Adding a new field is a metadata key, not a migration.

## Module layout

```
src/lib/content-ops/
  platform-registry.ts    single source of truth per destination
  editor-validation.ts    pure ruleset (JSON-serialisable issues)
  editor.functions.ts     server fns (load / save / create / delete /
                          submit / requestRevision / updateParentMeta /
                          listCampaigns / listPillars / validate)
  approvals.functions.ts  approve / reject / batchApprove
src/components/content-ops/
  editor-shell.tsx        editor UI, variant tabs, side-by-side,
                          revision history, action bar
  platform-preview.tsx    per-shape preview (feed / microblog /
                          community / newsletter / email)
src/routes/_authenticated/content-ops.editor.$id.tsx
```

## Extending to a new destination

1. Add a `PlatformConfig` entry in `platform-registry.ts` (fields, hard
   limits, recommendations, allowed content types, preview shape).
2. Confirm the connector adapter's `getCapabilities()` matches or narrows
   what the registry advertises; the adapter is allowed to narrow, never
   to widen, at publish time.

No editor changes. No validation changes. No preview changes.

## Save semantics

- Every save writes to `social_content_items` AND inserts a
  `social_content_versions` row keyed by monotonically increasing
  `content_version`.
- Saving an approved variant is refused unless the caller passes
  `overrideApproved: true`. The UI prompts a confirm; on override the
  server flips `approval_status` to `changes_requested` and the variant
  must be re-approved.
- `submitForApproval` and `approve` are blocked by validation errors.

## Non-goals for S1b

- Media upload pipeline (S1d).
- Provider-side scheduling / month calendar UI (S1c).
- SAM-authored variants beyond existing structured generation (S1e).
- Any actual connector to Facebook / Instagram / X / LinkedIn / Reddit;
  S1b writes to the DB only.

## Versioning

- `northstar.contentops.editor.registry.v1` - platform registry.
- `northstar.contentops.editor.validation.v1` - validation ruleset.
- `northstar.contentops.policy.v1` - inherited policy version stamped on
  every version snapshot and approval row.

## S1c: Editorial Calendar and Scheduler

The scheduler is a server-side operator interface over `automation_jobs`.
The client never mutates schedules directly.

### Modules
- `src/lib/content-ops/timezone.ts` - pure venture-timezone helpers built on `Intl.DateTimeFormat` (DST-safe).
- `src/lib/content-ops/schedule-gates.ts` - deterministic pre-schedule and pre-publish gate ruleset; produces `CalendarState`, `editorialAllowed`, `executableAllowed`, and typed failure records. Versioned by `SCHEDULE_GATES_VERSION`.
- `src/lib/content-ops/schedule-audit.server.ts` - append-only audit writes to `content_ops_schedule_audit`.
- `src/lib/content-ops/scheduling.functions.ts` - all mutating server functions: schedule, reschedule, unschedule, cancel, duplicate to date/platform, batch, publishNow, manualRetry, emergencyPause/resume, plus `listScheduledContent` and `previewScheduleGates`.

### Idempotency and duplicate prevention
Publish jobs use `buildPublishIdempotencyKey({ contentItemId, contentVersion, destinationKey, scheduledForIsoMinute })`. Because the key is stored in the unique `automation_jobs.idempotency_key`, two attempts for the same variant, version, and minute collapse to a single row. Rescheduling explicitly cancels the previous job first, then enqueues a new one.

### Editorial vs executable states
`connector_ready` and `destination_selected` are treated as `editorial_only` failures: the calendar accepts the slot for planning even when publishing is not yet possible. Every other blocking failure prevents scheduling entirely. When the connector arrives later, the scheduled item can be re-scheduled or `publishNow`ed to enqueue the executable job.

### Emergency pause
`emergencyPauseVenture` sets `content_ops_autonomy.emergency_pause = true` and moves all queued/scheduled/retrying `social_publish` jobs to `blocked` with `error_code = 'emergency_pause'`. `resumePublishing` restores them. Both operations are audited.

### Calendar UI
- `src/components/content-ops/calendar-view.tsx` - Month, Week, and Agenda views. Uses `formatInVentureTimezone` for every timestamp; nothing is rendered in the operator's local browser tz.
- `src/routes/_authenticated/content-ops.calendar.tsx` - Paper & Ink route with emergency pause / resume controls.

### Why the backend owns execution
`automation_jobs` runs via server workers. Scheduled publications continue when the PWA is closed, the browser is offline, or the user is signed out - matching the "deployed PWA, backend-executed" requirement.
