# Phase 3D - Incremental Delivery Plan

Phase 3D touches DB schema, crawlers, file parsing, content review, provider abstraction, SAM context, and Search. Shipping it in one generation would be unsafe (RLS surface area, credential handling, SSRF risk). Broken into 6 sub-milestones. Stop after each for a report + typecheck + production build. Do not advance until the previous is stable.

All integrations remain read-only. No autonomous actions. No scheduled sync. No SAM writes to external systems.

---

## Sub-milestone 3D.1 - Integration foundation + schema

Database + framework only. No UI beyond stubs. No network I/O yet.

- Migrations for: `integration_connections`, `integration_sources`, `integration_sync_runs`, `ingested_content_items`, `ingested_content_versions`. Full org-scoped RLS + GRANTs + `updated_at` triggers.
- `src/lib/integrations/` skeleton: `types.ts`, `errors.ts`, `registry.server.ts`, `auth.server.ts`, `audit.server.ts`, `freshness.server.ts`, `normalization.server.ts`. No connectors yet.
- Centralized limits in `src/lib/constants.ts` (`INTEGRATION_LIMITS`): max pages, depth, response size, file size, CSV rows, JSON items, content length, sync duration, sources per venture, manual sync interval.
- Sanitized error code enum.
- Regenerate Supabase types.

Exit: typecheck + prod build pass. No routes changed.

---

## Sub-milestone 3D.2 - Website ingestion connector

First real connector. Manual "Sync now" only.

- `connectors/website.server.ts`: URL validation, scheme allow-list (`https:`, `http:`), block localhost/private IP ranges (10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7) at DNS resolution time, robots.txt respect, same-domain bounded crawl, sitemap discovery, page limit, depth limit, response-size limit, timeout.
- Readable-text extraction (lightweight; no headless browser - Worker runtime forbids it).
- Content hashing (SHA-256 of normalized text), version-on-change.
- `sync.server.ts` orchestrator with the 15-step sequence, sanitized failures, prior-content preservation.
- Server functions: `createWebsiteConnection`, `syncConnection`, `listConnections`, `getConnection`, `archiveConnection`.
- Routes: `/settings/integrations`, `/settings/integrations/new`, `/settings/integrations/$connectionId` under `_authenticated/`.

Exit: user can add a public site, sync, see extracted pages with version history.

---

## Sub-milestone 3D.3 - File + manual content ingestion + Content Inbox

- Storage bucket `venture-content` (private). Signed URLs. MIME allow-list. Size limit.
- Parsers: PDF, DOCX, TXT, MD, CSV, JSON. Text extraction stored separately from original. Parse-failure state surfaced honestly. Image-only PDFs marked `ocr_required`.
- Manual paste/URL/note/transcript intake.
- Routes: `/knowledge/inbox`, `/knowledge/sources`, `/knowledge/sources/$sourceId`.
- Review states: `pending | reviewed | accepted | rejected | archived`.

Exit: upload → parse → review flow works for all listed types.

---

## Sub-milestone 3D.4 - App connections (generic) + knowledge promotion

- Connection types: Supabase read-only (allow-listed tables), public REST, webhook import endpoint, CSV/JSON import, generic API-token.
- Credentials stored via `secrets` tool per connection (never client-visible). Field-mapping UI.
- Suggested mappings; user confirmation required before creating operational records (ventures/projects/tasks/etc.).
- Promotion flow: reviewed inbox item → verified knowledge with full lineage (connection → source → URL/file → content_item → reviewer → date → verification → version).
- SAM citations resolve promoted knowledge back to origin.

Exit: read-only Supabase connection works end-to-end; promotion creates traceable knowledge.

---

## Sub-milestone 3D.5 - OpenAI provider through abstraction

- Extend `src/lib/sam/providers/` with `openai.server.ts` implementing `CompletionProvider`.
- Model allow-list (server-enforced). No client-supplied model names.
- API key stored server-side via secrets; per-org config in new `sam_provider_configs` table.
- Fallback chain to existing Lovable provider preserved.
- Settings route: `/settings/sam/providers`. Shows status, model, last success/failure, test button, disable, remove credentials.
- Sanitized provider errors.

Exit: user can enable OpenAI, test, run a SAM invocation through it, fall back on failure.

---

## Sub-milestone 3D.6 - SAM context + Global Search integration

- Extend `context-builder.server.ts` and workflow `context.server.ts` to pull ingested content, segmented by trust: `trusted | reviewed | unreviewed | stale | disputed`. Unreviewed never enters as trusted evidence.
- Wrap all ingested text as `<untrusted-context>` (constitution rule 8 already covers behavior).
- Freshness labels flow into SAM output; SAM must state stale/unverified.
- Global Search extended with source, verification, freshness, venture, last-updated columns.

Exit: SAM answers cite ingested content correctly and labels trust/freshness; search returns ingested items.

---

## Cross-cutting rules (apply to every sub-milestone)

- Every new `public` table: `GRANT` + `ENABLE RLS` + policies in the same migration.
- No service-role credentials in client bundles. `client.server` imported only inside handler bodies.
- Website crawler resolves DNS and blocks private/link-local/loopback before every request (not just at submit time - guards against DNS rebinding).
- No auto-created operational records. Everything requires explicit user approval.
- No em dashes anywhere (existing project rule).
- Report format after each sub-milestone matches the 20-item template you provided, scoped to that sub-milestone.

---

## Confirm before I start

Reply with:
1. "Proceed with 3D.1" to start the foundation, or
2. Any changes to sequencing, scope, or exit criteria.

I will not touch code until you confirm.