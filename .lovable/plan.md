# S1f-2b - Editorial Workspace

This is the largest UI/data change since S1c. To keep it shippable, verifiable, and reversible, I want to break it into four in-order sub-stages, all inside S1f-2b, each ending with typecheck + build + tests green. No X connector work until all four are done.

## Scope split

### S1f-2b.1 - Data model & field expansion (backend-first)

New nullable columns on `social_content_items` (parent-only fields live in metadata JSON to keep variants tight):

Variant fields (real columns, backwards compatible):
- `working_title text`, `final_title text` (existing `title` becomes an alias/computed view surfaced as "Working Title" until we backfill)
- Everything else lives in a typed `editorial` JSONB blob on the row, versioned into `social_content_versions.editorial` for revision integrity:
  - creative_brief, designer_notes, sam_notes, internal_notes, platform_notes
  - external_links[], source_documents[], reference_urls[]
  - mentioned_people[], mentioned_companies[], mentioned_brands[]
  - target_audience

Parent-only fields (on parent row's metadata + surfaced as first-class):
- `evergreen_topic`, `evergreen_tags[]` (new column `evergreen_tags text[]` for index + future semantic search)
- pillar / campaign / target_audience already exist; keep

New table: `content_evergreen_topics` (org+venture scoped, seed with Healing Path canonical list). Tagging becomes a real relation later; v1 stores tags as text[] with a validated vocabulary loaded from this table (extensible, editable). Backend keeps unknown tags but flags them.

Migration includes GRANTs, RLS, updated_at trigger, and a snapshot into `social_content_versions` of the full editorial blob (add `editorial jsonb` there too).

### S1f-2b.2 - Autosave, approval-integrity, version compare/restore (server + minimal UI)

Server:
- `autosaveVariant` server fn: same shape as `saveVariant` but idempotent by (contentItemId, contentVersion, clientEditToken) - dedupes rapid saves and returns `{ savedAt, contentVersion, revokedApproval }`.
- Approval revocation is already partial; extend to editorial blob changes and record an "approval_revoked_due_to_change" `content_ops_approvals` row so history shows the reason line "Approval removed because content changed."
- `restoreVariantVersion(contentItemId, version)` server fn: writes a new version cloned from an old one; increments content_version; snapshots.
- `diffVariantVersions(a, b)`: pure server helper returning a text diff per field (no external deps; uses a small LCS in TS).

UI (in EditorShell):
- Autosave state machine badge in header: Saving / Saved / Offline / Retrying / Failed. Debounced 800ms, coalesces field changes, backs off on network error.
- Revision drawer gets Compare (pick two versions, per-field diff) and Restore actions.
- Approval-revoked banner surfaces on any variant whose latest approval was auto-revoked.

### S1f-2b.3 - Field UI, evergreen tags, executive action bar, rich text

- New collapsible sections in the variant editor: Editorial (working/final title, creative brief, notes), References (links, source docs, reference URLs), People & Brands (mentioned people/companies/brands with chip inputs), Audience & Topics (target audience, evergreen topic single-select, evergreen tags multi-select from vocabulary with free-add).
- Executive action bar (sticky footer): Save, Submit, Approve, Reject, Request Revision, Duplicate, Archive, Restore, Schedule, Publish (routes to calendar with prefilled slot; live publish still gated by connectors), Delete. Each action goes through existing permission checks (`requireMembership` executive/member) and disables when not allowed. Wires Duplicate and Archive/Restore to new server fns; Schedule opens the existing `content-ops/calendar` schedule dialog.
- Rich text: minimal ProseMirror alternative is overkill. Ship a lightweight contenteditable-based editor built on `@tiptap/core + @tiptap/starter-kit` (small, tree-shaken; already Worker-safe as pure JS) supporting Bold, Italic, H2/H3, bullets, numbered lists, blockquote, link, inline image (from Media Picker). Body stored as Markdown (converted server-side); platforms that need plain text render from Markdown deterministically. Existing plain-text bodies read fine as-is.

### S1f-2b.4 - Performance, tests, docs, verification

- Split EditorShell into `EditorShell`, `VariantEditor`, `RevisionDrawer`, `ExecutiveBar`, `ReferencesSection`, `PeopleBrandsSection`, `TopicsSection`, `RichTextEditor`. Memoize per-variant draft state so typing in one section doesn't rerender previews for other variants. `useDeferredValue` on the preview pipeline.
- Draft state moves to `useReducer` keyed by variantId; heavy derived state (validation, preview) behind `useMemo` keyed by the specific fields consumed.
- Tests (added, not replacing):
  - Pure: diff helper (LCS), evergreen tag normalization, autosave dedupe key, approval-revocation predicate, executive-action permission matrix.
  - Server (contract): saveVariant revokes approval on editorial change; restoreVariantVersion increments version; duplicate/archive/restore transitions.
  - Existing 77 tests continue passing.
- Docs: extend `docs/architecture/content-editor.md` with autosave state machine, revision model, evergreen taxonomy, executive action permissions table.

## Architecture decisions

- Editorial fields go in a typed `editorial` JSONB blob + a dedicated `evergreen_tags text[]` column. Rationale: 15+ new fields as columns bloats the row and slows migrations; JSONB is versioned atomically alongside body/hook in `social_content_versions`; `evergreen_tags` is indexed as `text[]` for cheap GIN search now and vector-search later.
- Autosave uses `clientEditToken` for idempotency, not a distributed lock. Server refuses stale saves (contentVersion mismatch) with a specific error the UI translates to "Refresh - someone else edited this."
- Rich text stored as Markdown, not HTML/JSON. Portable across platforms, cheap to render, safe to fingerprint for duplicate detection.
- Schedule and Publish in the executive bar do NOT bypass connector gates; a blocked connector shows the truthful blocked reason inline.
- No breaking changes: every new field is nullable/optional; existing rows read cleanly; existing server fns keep their contracts.

## Deferred (explicitly not this stage)

- Real semantic search on evergreen_tags (needs embeddings pipeline). We add the column and taxonomy now; search wires up in a later stage.
- Collaborative multi-cursor editing. Autosave + version integrity is the collaboration layer for v1.
- SAM Review Panel warnings inside the editor (S1f-2c or S1e continuation).

## Order of execution

I will do .1 -> .2 -> .3 -> .4 as separate turns, each ending with typecheck + build + tests green and a short report. I stop and wait between .1 and .2 only if the migration reveals a schema issue; otherwise I proceed straight through.

Confirm this scope, or tell me what to cut, and I'll start with .1 (migration).
