# Stage S2a-Meta: Credential-Independent Infrastructure

Build the complete Meta (Facebook + Instagram) publishing infrastructure so tomorrow's only remaining steps are: add secrets, complete OAuth, select destinations, approve, publish. No fake credentials, no simulated posts, no "live" claims until real OAuth succeeds.

## Guiding invariants (enforced in every file)

- Meta capabilities report `configured=false / connected=false / reason="Meta credentials required"` until `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` all exist AND a real OAuth token is persisted.
- Meta-targeted jobs stop at a truthful `Blocked: Connector Not Configured` terminal state (not a retry loop) until connected.
- No provider HTTP call is made without real credentials + real OAuth token. Request builders exist, are unit-tested against fixtures, but are never invoked in blocked state.
- OAuth routes exist at real paths, return `503 meta_not_configured` until secrets exist. `META_APP_SECRET` never leaves server modules.
- Idempotency key = sha256(org|contentItem|approvedVersion|destination|provider|publishGeneration). Enforced in DB via unique index on `automation_jobs.idempotency_key`.
- Server-driven scheduler only. Existing `automation_jobs` worker + pg_cron tick is the sole executor. No client timers.
- Approval invalidation is trigger-enforced: any change to caption/media/destination/schedule after `approved` bumps state to `approval_revoked` with reason.

## Phase A - Data model + capability contract

- Migration `20260718_meta_infrastructure.sql`:
  - Extend `social_content_items.status` enum to cover the full state set (Draft, Awaiting Approval, Approved, Scheduled, Queued, Publishing, Processing Media, Pending Verification, Published, Failed, Canceled, Approval Revoked).
  - New table `meta_oauth_states` (org, state, code_verifier, redirect_uri, requested_by, expires_at, consumed_at, purpose).
  - New table `meta_destinations` (org, venture, social_account_id, kind=facebook_page|instagram_business, external_id, name, username, connected_ig_id, connected_fb_page_id, granted_permissions[], page_tasks[], publish_available, insights_available, last_capability_check, last_capability_reason).
  - New table `meta_page_tokens` (destination_id, encrypted_token, scopes[], obtained_at, expires_at, last_refresh_at). Encryption via `pgsodium` secret box using service-role-only key derived from `SUPABASE_SERVICE_ROLE_KEY` at server layer (tokens never selected client-side).
  - Extend `social_accounts` to carry `provider_user_id`, `provider_long_lived_token_ref`, `granted_scopes[]`, `last_token_check_at`.
  - New table `content_publication_history` (content_item_id, generation, destination_id, provider_post_id, permalink, api_version, request_snapshot, response_snapshot, verified_at, verification_response_ref, actor).
  - New table `meta_media_delivery_tokens` (asset_id, org, token, expires_at, consumed_at, delivered_url, purpose='ig_container').
  - Extend `automation_jobs` with unique `idempotency_key` (nullable, unique when not null) and `blocked_reason` text column (already may exist; add if missing).
  - Grants + RLS for all new tables. `meta_page_tokens` has NO authenticated SELECT policy - service role only.
  - Trigger `invalidate_approval_on_material_change` on `social_content_items` and `social_content_versions`.

## Phase B - Provider adapter framework

Files:
- `src/lib/social/providers/meta/config.server.ts` - env presence check, `getMetaConfig()`, `isMetaConfigured()`.
- `src/lib/social/providers/meta/oauth.server.ts` - state gen, PKCE, authorize URL builder, code exchange, long-lived token exchange, granted-permission fetch, deauthorization signature verify, data-deletion signature verify + confirmation payload.
- `src/lib/social/providers/meta/graph.server.ts` - low-level v25.0 fetch wrapper (never called without token; classifies errors).
- `src/lib/social/providers/meta/destinations.server.ts` - `/me/accounts` FB Page discovery + `instagram_business_account` linkage + capability probe (publish + insights).
- `src/lib/social/providers/meta/tokens.server.ts` - encrypted persistence + retrieval (server-only).
- `src/lib/social/providers/facebook.ts` - implements `SocialProviderAdapter`. Request builders: text, link, photo, multi-photo. Response parser. `capabilities()` derives live from config + connection + granted permissions.
- `src/lib/social/providers/instagram.ts` - single-image + carousel container workflow (create child, create parent, poll status_code, publish), builders + parsers, capability derivation.
- `src/lib/social/providers/meta/index.ts` - unified `meta` provider registration surface.
- `src/lib/social/providers/meta/errors.ts` - normalized error codes for the failure taxonomy in Section 13.
- `src/lib/social/providers/meta/verification.server.ts` - `GET /{post-id}` and `GET /{media-id}` handlers, checksum comparison of approved caption/title vs provider content.
- `src/lib/social/providers/meta/metrics.server.ts` - capability-filtered metric selection for v25.0 (FB post_impressions/_organic/reactions_by_type_total/clicks/video_views; IG reach/likes/comments/saved/shares/views/total_interactions/profile_activity/profile_visits/follows/reposts). Never invents values; missing = `unavailable`.

Register `facebook` and `instagram` in `src/lib/social/registry.server.ts`.

## Phase C - OAuth + media-delivery routes

- `src/routes/api/public/oauth/meta/authorize.ts` (GET) - authenticated (via signed launch token from app), builds authorize URL, persists state, redirects. 503 `meta_not_configured` when secrets missing.
- `src/routes/api/public/oauth/meta/callback.ts` (GET) - validates state (single-use, unexpired, org-scoped), exchanges code, obtains long-lived user token, discovers destinations, persists tokens + destinations, redirects to `/settings/integrations/meta`.
- `src/routes/api/public/oauth/meta/deauthorize.ts` (POST) - verifies Meta `signed_request`, marks account disconnected, kills page tokens.
- `src/routes/api/public/oauth/meta/data-deletion.ts` (POST) - verifies signed_request, enqueues deletion job, returns `{ url, confirmation_code }` per Meta spec.
- `src/routes/api/public/media/meta-delivery.$token.ts` (GET) - validates single-use, unexpired delivery token; streams asset with correct MIME; scoped to org+asset+purpose; records delivery attempt; never exposes bucket listing.

All routes: input validated with Zod, no PII in responses, no secret logging.

## Phase D - Publish job runner + idempotency + failure taxonomy

- Extend `src/lib/social/jobs/beehiiv-publish.server.ts` pattern - create `src/lib/social/jobs/meta-publish.server.ts` registered for `social_publish` when `provider in (facebook, instagram)`.
- Refactor `src/lib/automation/executor.server.ts` job dispatch to route `social_publish` by `payload.provider`.
- Runner steps (each a pure function, individually tested):
  1. Load job + content item + approved version.
  2. Recheck approval state + version checksum.
  3. Recheck destination still linked + permissions still granted.
  4. Recheck media attachments exist + accessible.
  5. Recheck provider capabilities (`isMetaConfigured` + token present + capability probe cache < 24h else refresh).
  6. Compute idempotency key; short-circuit to existing `content_publication_history` row if present.
  7. Blocked state exits: return `blocked_terminal` (no retry) with structured `blocked_reason`.
  8. When all clear AND real token exists: invoke provider adapter.
  9. Persist request/response snapshots to `content_publication_history`.
  10. Enqueue verification job (delay 60s for FB, poll loop for IG container).
  11. Emit activity event + Brief signal + SAM recommendation stub.
- `src/lib/social/failure-taxonomy.ts` - the 22 stable codes from Section 13, each with `retryable: boolean`, `userMessage`, `recommendedAction`.

## Phase E - UI: Connector Health + Validation Panel + tests

- `src/components/social/meta-connector-health.tsx` - reads live capability state, renders the pre/post-connection matrix from Section 14. Wired into `/content-ops` and `/settings/integrations`.
- `src/components/social/meta-validation-panel.tsx` - the Section 15 panel. Pre-credential: shows scheduler/worker/approval/media/provider readiness. Post-connection: uses the same production publish path (no separate test workflow).
- Extend `/content-ops` route with a "Meta" tab that mounts these panels.
- Tests (`.test.mjs`, pure functions where possible; server tests via test harness pattern already used):
  - `meta-oauth-state.test.mjs` - state gen, expiration, replay protection, org scoping.
  - `meta-request-builders.test.mjs` - FB text/link/photo/multi-photo, IG single/carousel container + publish payloads against v25.0 fixtures.
  - `meta-response-parsers.test.mjs` - success + all error classes.
  - `meta-capabilities.test.mjs` - configured/connected/publish-available matrix for every credential+token+permission combo.
  - `meta-idempotency.test.mjs` - key derivation stability, duplicate prevention, generation bump.
  - `approval-invalidation.test.mjs` - each material-change vector revokes approval.
  - `publish-runner-blocked.test.mjs` - blocked-terminal exit paths, no HTTP call attempted, no retry consumed indefinitely.
  - `failure-taxonomy.test.mjs` - all 22 codes classified.
  - `media-delivery-token.test.mjs` - single-use, expiration, org-scope, MIME.
  - `verification-state-machine.test.mjs`.
  - `metrics-capability-filter.test.mjs` - unavailable != zero.
  - Extend existing scheduler/worker tests to cover Meta-provider dispatch + restart recovery.

## Deliverables + report

At end: run all `.test.mjs` suites, typecheck, production build. Produce the 23-item completion report exactly as specified in Section 17, including tomorrow's exact 5-step user action list and the enumerated "unproven until live OAuth" surfaces.

## Execution note

This is 4-6 hours of work across ~40 files. I will execute Phase A -> B -> C -> D -> E sequentially in this single turn without further questions, verifying build + tests at Phase B/D/E boundaries. If any phase reveals a blocking discovery (e.g. missing pgsodium extension), I'll adapt (fall back to app-layer AES-GCM via WebCrypto keyed on service role) rather than stop.
