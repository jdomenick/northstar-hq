# 03  -  Memory Architecture

SAM's memory is layered, user-editable, versioned, and always sourced.
No layer is a black box: every field can be read, edited, exported, or
deleted by an appropriately privileged user.

## Layers at a glance

| Layer | Scope | Primary owner | Typical lifetime | Store |
| --- | --- | --- | --- | --- |
| Founder Memory | one user | that user | until user edits/deletes | `sam_memory_founder` |
| Organization Memory | one org | admins/owner | until org edits/deletes | `sam_memory_org` |
| Venture Memory | one venture | venture owner + admins | while venture exists | `sam_memory_venture` |
| Operational Memory | one org | system (write) / member (read) | 90 days rolling | `sam_memory_operational` |
| Historical Memory | one org | system, append-only | forever | `sam_memory_history` |
| Preference Memory | one user OR one org | user / admin | until edited | `sam_memory_preference` |

All tables inherit the same RLS shape as the corresponding entity: rows
are scoped by `organization_id` (and `user_id` where applicable) and
guarded by the existing `has_role` / membership predicates.

## Common memory record shape

```
MemoryRecord {
  id: uuid
  layer: 'founder' | 'organization' | 'venture' | 'operational' | 'historical' | 'preference'
  scope: { orgId: uuid, ventureId?: uuid, userId?: uuid }
  key: string                     // stable slug, e.g. 'communication.tone'
  value: Json
  source: {
    kind: 'user_edit' | 'onboarding' | 'derived' | 'sam_inference'
    refs: EntityRef[]             // citations back into the Executive Graph
  }
  confidence: number              // 0..1, see doc 05
  createdAt, updatedAt: timestamptz
  createdBy, updatedBy: uuid
  expiresAt: timestamptz | null
  supersedesId: uuid | null       // version chain
  status: 'active' | 'superseded' | 'archived'
}
```

## Layer contracts

### Founder Memory
- **Ownership.** The individual founder. Only that user and org owners
  may read; only the user may edit.
- **Lifetime.** Persists until edited or explicitly cleared.
- **Editable fields.** All non-system fields (preferred name, working
  hours, communication style, focus areas, private notes to SAM).
- **Confidence.** Direct user edits = 1.0. SAM inferences <= 0.7.
- **Source tracking.** Every record carries `source.kind` + refs.
- **Expiration.** None by default. Onboarding-derived facts get a 180-day
  soft-refresh flag (SAM asks to reconfirm, never overwrites).
- **Conflict resolution.** User edit always wins over inference.

### Organization Memory
- **Ownership.** Org owners + admins.
- **Lifetime.** Until edited.
- **Editable fields.** Mission, operating principles, policy overrides
  for the Rules Engine, escalation ladder, cadences.
- **Confidence.** Admin edit = 1.0.
- **Source tracking.** `updatedBy` + optional linked Decision/Document.
- **Expiration.** None.
- **Conflict resolution.** Latest admin edit wins; superseded row kept
  with `status='superseded'` for audit.

### Venture Memory
- **Ownership.** Venture owner + org admins.
- **Lifetime.** Deleted when the venture is hard-deleted; archived when
  the venture is archived.
- **Editable fields.** Positioning, ICP, stage, north-star metric, key
  constraints. Structured so the Reasoning Engine can consume it.
- **Confidence.** Same rules as Founder.
- **Source.** Owner edit or derived-from Decision/KnowledgeRecord.
- **Expiration.** Follows venture lifecycle.
- **Conflict.** Owner edits win; derived facts marked stale after 60
  days without confirmation.

### Operational Memory
- **Ownership.** System-written, member-readable.
- **Purpose.** Short-term working set: what SAM saw recently, what was
  surfaced in the last Briefing, cursors for incremental workflows.
- **Lifetime.** Rolling 90 days; anything older migrates to Historical.
- **Editable fields.** None directly  -  users clear by clearing the
  underlying entity or via a "reset SAM working memory" admin action.
- **Confidence.** Not applicable; this is a cache/cursor layer.
- **Source.** Always `derived`.
- **Expiration.** `expiresAt` mandatory; a nightly job archives past it.
- **Conflict.** Last-write-wins on the key.

### Historical Memory
- **Ownership.** Org, append-only.
- **Purpose.** Immutable record of past recommendations, briefings,
  reviews, and feedback for post-mortems and learning.
- **Lifetime.** Forever unless the org is deleted.
- **Editable fields.** None. Corrections are new rows that supersede.
- **Confidence.** Frozen at time of write.
- **Source.** SAM invocations (audit-linked).
- **Expiration.** None.
- **Conflict.** Never overwritten. A user "delete" hides from UI and
  removes from retrieval, but the row persists for audit.

### Preference Memory
- **Ownership.** User- or org-scoped depending on the key.
- **Purpose.** Interaction preferences: briefing time, verbosity,
  channels, do-not-disturb, SAM tone.
- **Lifetime.** Until edited.
- **Editable fields.** All.
- **Confidence.** Direct edit = 1.0.
- **Source.** `user_edit`.
- **Expiration.** None.
- **Conflict.** User pref overrides org default for that user; org
  default applies otherwise.

## Read model

The Memory Engine (pipeline stage 6) exposes:

```
resolveMemory({ orgId, userId, ventureId, keys[] }) → MemoryBundle
```

Precedence for a given key when multiple layers define it:

```
Preference (user)  >  Founder  >  Preference (org)  >  Venture
                                                  >  Organization
                                                  >  Operational (derived)
                                                  >  Historical (frozen inference)
```

The resolver returns every layer's value with confidence and source so
the reasoning engine can weigh conflicts explicitly rather than silently
picking one.

## Conflict resolution rules

1. **User edit beats inference** at the same or lower layer.
2. **Higher-specificity layer beats lower** (user > venture > org).
3. **Newer beats older** within the same layer/key; older row becomes
   `superseded` with `supersedesId` pointing forward.
4. **Never silently merge structured values.** If two active rows exist
   for the same key, the resolver returns both and the Reasoning Engine
   is required to note the conflict in its ReasoningTrace.

## What SAM never does

- Never permanently locks a memory. Every row has an editable path or a
  supersede path.
- Never writes to Founder/Organization/Venture/Preference memory without
  a user-initiated action or an explicit confirmation flow.
- Never crosses `orgId`. Memory is tenant-local; there is no shared
  cross-org "learning".