## Phase 2 — Realistic Sequencing

The Phase 2 spec covers ~13 domains, dozens of screens, full CRUD + detail pages, filters, board views, structured JSONB editors, document uploads, global search, activity logging, member management, and permission gating. Delivering all of it correctly in one turn would produce shallow, buggy code across every module. I want to split it into four focused sub-phases so each ships working, tested, and matches the premium UI bar.

### Sub-phase 2A — Foundation + Projects + Tasks + Activity (this turn)
The pieces most other modules depend on.

1. **Activity logging service** (`src/lib/activity.ts`) — one `logActivity()` helper used everywhere. Wired into every mutation below.
2. **Permissions helper** (`src/lib/permissions.ts`) — role-aware `can()` reading from `OrgProvider`. Drives disabled states across the app.
3. **Data-hooks expansion** — repository-style hooks in `src/lib/data-hooks.ts` (projects, tasks, activity), all org-scoped, all invalidating cleanly.
4. **Projects** — full CRUD, list + board view, filters (venture/status/priority/owner), search, sort, status/priority/progress editors, archive/restore, project detail page with tabs (Overview, Tasks, Decisions, Commitments, Activity). Activity events on create/status-change/complete.
5. **Tasks** — nested under project detail, plus a focused drawer. Create/edit/complete/reopen/cancel/archive, subtasks via `parent_task_id`, due date, priority, status, overdue calc. Activity on complete/reopen.
6. **Command screen** — swap mock "recent activity" for real `activity_events` feed.

### Sub-phase 2B — Decisions + Commitments + Goals (next turn)
- Decisions: full CRUD, structured JSONB editors (options/evidence/risks), detail screen with all sections, "Analyze with Operator" honest-disabled state, decided-state validation.
- Commitments: full CRUD, postponement logic (preserve `original_due_date`, increment `postponement_count` only on later moves), accurate overdue via computed date comparison, Accountability screen with all 7 real sections and live executive statements.
- Goals: CRUD, progress calc (safe divide), venture/org scope, achieved-state activity.

### Sub-phase 2C — Knowledge + Documents + Venture Detail (next turn)
- Knowledge records: CRUD, verification lifecycle, edit-resets-verification, detail view, filters.
- Documents: upload to private bucket with `organization_id/documents/document_id/filename` path, signed-URL downloads, size/type validation (25 MB constant), metadata table.
- Venture detail: complete all tabs with live related data (goals, projects, decisions, commitments, knowledge, documents, activity).

### Sub-phase 2D — Settings + Members + Global Search + Command polish (next turn)
- Organization settings form (owner/admin only), slug uniqueness.
- Members section: list active members, role changes with final-owner protection, "invitations coming later" notice.
- Global search: cmd-palette wired to real data across all 8 entity types, debounced, grouped, keyboard nav.
- Command screen: today's-priorities scoring, decisions-waiting, projects-at-risk, commitments-due/overdue sections all from live data.

### Why split it this way
Every later sub-phase depends on the activity service, permissions helper, and repository patterns established in 2A. Building 2A properly (with a project detail page that actually looks premium, not a wireframe) is roughly a full turn of work on its own. Attempting all 13 domains at once will produce a broken build, missed activity hooks, half-wired forms, and permission gaps — exactly what the spec warns against.

### Constants and conventions I'll establish in 2A (reused by later phases)
- `STALLED_PROJECT_DAYS = 7`
- `MAX_DOCUMENT_BYTES = 25 * 1024 * 1024`
- `ALLOWED_DOCUMENT_MIME_TYPES = [...]`
- Repository hooks live in `src/lib/data-hooks.ts` (extended, not scattered)
- Activity via `logActivity({ entity_type, action, summary, ... })` — never inlined
- Mutations use React Query; invalidate `['projects', orgId]`, `['activity', orgId]`, etc.
- Forms use shadcn Dialog for simple records, dedicated route pages for complex ones (projects, decisions)

### What stays out of scope for all of Phase 2 (per your instructions)
Operator AI, OpenAI, Gmail, Calendar, Drive, Stripe, Slack, Notion, Airtable, analytics, semantic search, embeddings, OCR, document parsing, email invitations.

**Confirm and I'll start on 2A now.** If you'd rather I attempt more per turn (2A+2B together, higher risk of shallow work) or less (just Projects this turn), say the word.