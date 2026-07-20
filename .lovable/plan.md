# Platform Restructure: NorthStar Labs + SAM

Reorganize the app so NorthStar Labs (the company/product/admin shell) and SAM (the autonomous intelligence product) live side-by-side in this repo with clean boundaries and a future extraction path for SAM.

## Product boundaries

**NorthStar Labs** - `/` and `/labs/*` (public + authenticated company shell)
- Marketing/home at `/`
- Company admin: ventures, projects, goals, decisions, knowledge, documents, accountability, commitments, revenue, mission-control, operator
- Founder settings, profile, org, billing
- Owns branding, navigation shell, auth, org context

**SAM** - `/sam/*` (autonomous operating system, feels like a distinct product)
- `/sam` - conversation/ask
- `/sam/control` - Mega Control Panel
- `/sam/memory` - memory & constitution
- `/sam/objectives` - goals SAM is driving
- `/sam/approvals` - approval queue
- `/sam/work` - execution timeline / automation jobs
- `/sam/automations` - schedules, workers, triggers
- `/sam/integrations` - SAM's own connectors (Meta, Beehiiv, MCP, etc.)
- `/sam/content` - content-ops (calendar, editor, library) - SAM's publishing surface
- `/sam/reports` - executive intelligence, health, digests

## Route moves

```text
_authenticated/
  index.tsx                    -> labs.tsx           (Labs home / dashboard)
  ventures.*, projects.*,
  goals.*, decisions.*,
  knowledge.*, documents.*,
  accountability.tsx,
  commitments.$id.tsx,
  revenue.tsx,
  mission-control.tsx,
  operator.tsx                 -> labs.<same>.tsx    (all under /labs/*)
  settings.*                   -> labs.settings.*    (org/founder settings)

  sam.tsx                      -> sam.index.tsx
  sam-control.tsx              -> sam.control.tsx
  sam.memory.tsx               -> sam.memory.tsx     (unchanged path)
  content-ops.tsx              -> sam.content.tsx
  content-ops.calendar.tsx     -> sam.content.calendar.tsx
  content-ops.library.tsx      -> sam.content.library.tsx
  content-ops.editor.$id.tsx   -> sam.content.editor.$id.tsx
  integrations.tsx             -> sam.integrations.tsx
  (new) sam.approvals.tsx, sam.work.tsx, sam.objectives.tsx,
        sam.automations.tsx, sam.reports.tsx  (thin shells wiring
        existing lib data; no new business logic this pass)
```

`src/routes/index.tsx` becomes the public NorthStar Labs landing page (keeps the current placeholder-replacement rule).

## Module reorg (extraction-ready)

```text
src/lib/
  labs/            <- ventures, projects, goals, decisions, accountability,
                      mission-control, revenue, founder-activation, coo
  sam/             <- existing sam/, sam-control/, sam-mcp/, content-ops/,
                      automation/, social/, signals/, activity   (all SAM)
  shared/          <- auth-context, org-context, permissions, errors,
                      ai-gateway.server, storage, utils, constants,
                      data-hooks, actor-names, integrations (shared connector
                      framework used by both)
```

Move files with `git mv`-equivalent shell `mv`, then update imports. Public API of each domain is a single `index.ts` barrel so a future SAM extraction is a folder copy + swap of `shared/` for a thin package.

```text
src/components/
  labs/            <- page-header (Labs variant), editorial (Labs docs)
  sam/             <- sam-mcp-connection-panel, executive-intelligence-panel,
                      content-ops/*
  shared/          <- app-shell, ui/*
```

## Navigation & shell

`app-shell.tsx` gets a two-section sidebar:
- **NorthStar Labs** group: Home, Ventures, Projects, Goals, Decisions, Knowledge, Accountability, Revenue, Mission Control, Settings
- **SAM** group (visually distinct - product-within-product): Ask SAM, Control, Approvals, Work, Automations, Integrations, Content, Memory, Reports

Header shows current product context (Labs vs SAM) so SAM reads as its own product.

## Redirects (no broken links)

Add a small redirect map so legacy URLs keep working:
- `/mission-control` -> `/labs/mission-control`
- `/ventures`, `/projects`, `/goals`, `/decisions`, `/knowledge`, `/documents`, `/accountability`, `/revenue`, `/operator`, `/settings/*` -> `/labs/*`
- `/sam-control` -> `/sam/control`
- `/content-ops*` -> `/sam/content*`
- `/integrations` -> `/sam/integrations`

Implemented as tiny route files that `throw redirect(...)` in `beforeLoad`.

## Out of scope this pass

- No new SAM features. Approvals/Work/Objectives/Automations/Reports pages wire existing data only; deep functionality lands in follow-ups.
- No visual redesign beyond adding the Labs/SAM split in the shell.
- No repo split; SAM stays in this repo. Boundaries make extraction a mechanical move later.
- Marketing/public `/labs/*` pages (case studies, portfolio) are stubbed - content lands in a separate pass.

## Verification

- `bun run build` green, `tsgo` green.
- Playwright: `/`, `/labs`, `/labs/ventures`, `/sam`, `/sam/control`, `/sam/content`, `/sam/integrations` all render; legacy `/mission-control`, `/sam-control`, `/integrations` redirect.
- Sidebar shows both product groups; SAM group visually distinct.

## Delivery order

1. **Shape** - create `src/lib/{labs,sam,shared}` and `src/components/{labs,sam,shared}` folders, move files, update imports. Build must stay green after this step.
2. **Routes** - rename route files to the `labs.*` / `sam.*` layout, add redirects for legacy paths, update `<Link to>` call sites.
3. **Shell** - split sidebar into Labs + SAM groups, add product-context header.
4. **Stubs** - add empty `sam.approvals`, `sam.work`, `sam.objectives`, `sam.automations`, `sam.reports` route shells reading existing data.
5. **Verify** - build, typecheck, Playwright smoke on the routes above.

Confirm this shape (especially the Labs vs SAM ownership of Mission Control, Revenue, Operator, and Founder Activation) and I'll execute.
