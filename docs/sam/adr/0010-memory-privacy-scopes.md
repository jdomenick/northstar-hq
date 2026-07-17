# ADR-0010  -  Memory Privacy Scopes

Status: Accepted (Phase 3B)

## Context

SAM Memory spans six layers. Some describe the organization or a venture
(visible to members); others describe the founder personally or store their
individual preferences. Broad organization membership must not silently
expose one member's private preferences to the rest of the team.

## Decision

- Layers `founder` and `preference` are **user-private** by default.
  - RLS only permits `SELECT` when `owner_user_id = auth.uid()`.
  - `INSERT`/`UPDATE` require the acting user to be that owner.
  - Admins do not implicitly see or edit another user's private memory.
- Layers `organization`, `venture`, `operational`, and `historical` are
  organization-scoped and visible to active members. `venture`-layer memory
  additionally requires a venture in the same organization.
- Hard `DELETE` is admin-only; the app performs soft-delete via `status =
  'archived'` + `deleted_at`.

## Consequences

- Personal memory follows the user, not the seat.
- If org policy later demands that admins see personal memory, that is an
  explicit product decision requiring a schema-level flag and a new ADR;
  RLS defaults never allow the leak.
- Founder memory created before the user has an active membership is
  unreachable  -  the app must guarantee membership at creation time.