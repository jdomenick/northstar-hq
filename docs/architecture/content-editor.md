# Shared Content Operations editor (S1b)

The Content Operations editor is the single authoring surface for every
outbound content destination in Northstar. Its job is to make one operator
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
