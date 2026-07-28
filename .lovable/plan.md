# NorthStar Labs Proposal Management System

Focused proposal workflow reusing existing data. Parallel to legacy `revenue_proposals` (kept intact for pipeline reporting).

## 1. Existing data mapped (verified via psql)

- `revenue_clients` (org, venture, name, status, mrr_cents) - client source of truth
- `revenue_pipeline` - optional deal linkage
- `revenue_discovery_briefs` (pain_points, goals, budget_range, decision_makers, questions, research_summary) - populates challenges/assessment
- `revenue_launch_docs` - populates deliverables/timeline where present
- `organization_operating_context` + `venture_operating_context` - populates business overview
- `organizations`, `profiles` - client/prepared-by identities
- `activity_events` - existing activity stream (org-wide notifications)
- Role helpers: `has_org_role(_org, _user, _min)`, `is_org_member(_org, _user)`, enum `org_role` (owner/admin/executive/member/viewer)
- Auth: `requireSupabaseAuth` middleware, bearer attacher already registered

Roles used (existing only):
- `member` = create/edit drafts, add comments
- `executive` = submit, approve, return, send, supersede
- No new roles invented.

## 2. Database (one migration)

New enum `nsl_proposal_status`: draft, internal_review, approved, ready_to_send, sent, viewed, accepted, declined, expired, superseded, cancelled.

Tables (all org-scoped, all with GRANTs to authenticated + service_role, NO anon grants):
- `nsl_proposals` - spec fields; `public_token_hash` (sha256 hex) + `public_token_expires_at`; no raw token stored
- `nsl_proposal_versions` - immutable jsonb snapshots
- `nsl_proposal_activity` - action log
- `nsl_proposal_signatures` - electronic acceptance evidence (no fake "signed_pdf_url")
- `nsl_proposal_comments` - internal only

RLS:
- SELECT: `is_org_member(org, auth.uid())`
- INSERT/UPDATE drafts: `has_org_role(org, auth.uid(), 'member')`
- Approve/send/supersede: enforced in server functions via `has_org_role(..., 'executive')` (RLS also allows executive writes)
- Signatures/activity/versions: server-writes only (RLS restricts INSERT to executive; public routes use `supabaseAdmin` behind token verification)

Guards (triggers):
- Prevent UPDATE of `nsl_proposals` when `locked_at IS NOT NULL` (except by service_role)
- Cross-org validation trigger: client_id and pipeline_id must share organization_id

Atomic acceptance RPC `nsl_proposal_accept(token_hash, signer_name, signer_email, acknowledgement, ip, ua)`:
- Single transaction, security-definer
- Validates status/expiry/lock, inserts signature (ON CONFLICT on `(proposal_id, signer_email)` = idempotent), updates proposal to accepted+locked, inserts activity, all-or-nothing
- Returns proposal id + accepted_at (or error code)

## 3. State machine

```text
draft -> internal_review -> approved -> ready_to_send -> sent
internal_review -> draft (return with reason)
sent -> viewed | accepted | declined | expired
accepted -> [locked terminal]
* -> superseded | cancelled  (by executive)
```

Enforced in server functions via a `transition(from, to)` guard table. Invalid transition returns `invalid_transition` error.

## 4. Server functions (`src/lib/proposals/*.functions.ts`)

Authenticated:
- `generateProposal({ clientId, pipelineId? })` - assembles draft from existing data, leaves missing sections blank with sentinel `[Needs input]` markers
- `listProposals({ status? })`, `getProposal({ id })`
- `updateProposalDraft` - snapshots version only when hash of content sections changes
- `submitForReview`, `approveProposal`, `returnProposalToDraft(reason)`, `sendProposal`, `markSuperseded`
- `addComment`, `listComments`
- `getProposalMetrics` (counts + sums only; no forecasting)
- `prepareBillingHandoff(proposalId)` -> `{ status: 'pending_billing_integration', client, totals }` + activity `billing_pending_setup`. No Stripe.

`sendProposal` returns `{ url, token }`; raw token exists only in response, never stored.

## 5. Public server routes (`src/routes/api/public/proposals/*.ts`)

All use `supabaseAdmin` (loaded via `await import` inside handler), verify token hash first, sanitize output (strip internal comments/activity/audit metadata):
- `POST view` - marks first view only (guard on `viewed_at IS NULL`), idempotent
- `POST accept` - calls `nsl_proposal_accept` RPC, idempotent by signer_email
- `POST decline` - sets declined, blocks further acceptance
- `GET pdf?token=...` - streams PDF

CORS: same-origin only (no external callers expected).

## 6. PDF

Server-rendered via `@react-pdf/renderer` (pure JS, Worker-safe). One template with fixed sections, NorthStar wordmark asset, page numbers, cover, and (post-acceptance) evidence page with signer name/email/acknowledgement/timestamp/version/proposal id. No claim of "cryptographic signature" anywhere.

## 7. UI (`/labs/proposals/*`, Executive Precision theme)

- `labs.proposals.tsx` - list + compact metrics header
- `labs.proposals.new.tsx` - client picker (+ optional pipeline) -> Generate
- `labs.proposals.$id.tsx` - tabbed: Editor (fixed sections, textareas with lightweight markdown) | Preview | Versions | Activity | Comments. Actions: Save, Submit, Approve, Return, Send (shows copyable link once), Copy Link, Download PDF, Supersede. Read-only after `sent_at` / `locked_at`.
- Public route `src/routes/proposal.$token.tsx` (top-level, unauthenticated) - view, download, accept form (name/email/acknowledgement checkbox), decline. Calls the public API routes.
- Nav entry added under Labs in `app-shell.tsx`.

## 8. Activity & notifications

Every mutation writes exactly one `nsl_proposal_activity` row. Also writes a summary row into existing `activity_events` for org-wide feed on: submitted_for_review, approved, sent, first-viewed, accepted, declined, expired. No email infra claimed.

## 9. Verification

- `bun run tsgo` clean
- `build:dev` green
- Unit test `src/lib/proposals/proposals.test.mjs` covering: state transitions, idempotent acceptance, cross-org rejection, token expiry, superseded/expired rejection, sanitization of public payload, unauthorized approve/send rejection, billing handoff truthfulness, PDF renders bytes
- Playwright end-to-end: generate -> edit -> approve -> send -> open public link -> accept -> confirm locked + evidence rendered

## 10. Files

- 1 migration (tables, enum, RLS, GRANTs, `nsl_proposal_accept` RPC, lock trigger, scope trigger)
- ~10 files under `src/lib/proposals/` (functions, pdf renderer, hash util, transitions, sanitizer, activity helper, test)
- 4 server routes under `src/routes/api/public/proposals/`
- 4 UI routes + 1 public top-level route + small components
- `app-shell.tsx` nav edit

## Explicit non-goals

- No Stripe, no fake payment events, no email delivery, no cryptographic/handwritten signatures
- No CRM, no generic block editor, no drag-and-drop, no forecasting
- No touch of `revenue_proposals`, existing pipeline reporting, or `_app`-style layouts
- No new roles or auth helpers

Proceed?
