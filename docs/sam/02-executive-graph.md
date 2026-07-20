# 02  -  Executive Graph

The Executive Graph is NorthStar Labs' proprietary knowledge structure. It is a
logical model  -  not a graph database. It projects the existing relational
schema into a typed node/edge space that every SAM stage reasons over.

## Node types

| Node | Source table | Notes |
| --- | --- | --- |
| Founder | `profiles` (owner role) | The human at the center. |
| Organization | `organizations` | Tenant boundary; RLS root. |
| Member | `organization_members` + `profiles` | Person inside an org. |
| Venture | `ventures` | Business inside the org. |
| Project | `projects` | Delivery unit under a venture or org. |
| Task | `tasks` | Executable atom under a project. |
| Goal | `goals` | Measurable outcome. |
| Commitment | `commitments` | Promise with an owner + due date. |
| Decision | `decisions` | Structured choice with options/evidence/risks. |
| KnowledgeRecord | `knowledge_records` | Verified organizational fact. |
| Document | `documents` | File asset with metadata. |
| Meeting | *future* | Scheduled or logged conversation. |
| Risk | *derived from decisions.risks + rules* | First-class node. |
| KPI | *future* | Numeric metric with target + cadence. |
| SOP | *future subtype of KnowledgeRecord* | Repeatable procedure. |
| Customer | *future* | External party the org serves. |
| Opportunity | *future* | Pipeline item. |

Every node exposes:

```
Node {
  id: string
  type: NodeType
  orgId: string           // RLS anchor  -  never crosses this
  ventureId?: string
  title: string
  status?: string
  ownerUserId?: string
  createdAt: string
  updatedAt: string
  refs: { table: string, id: string }   // back-pointer to source row
}
```

## Edge types

Edges are directional and typed. All edges are org-local.

| Edge | From → To | Semantics |
| --- | --- | --- |
| `MEMBER_OF` | Member → Organization | Membership + role. |
| `OWNS` | Founder/Member → Venture/Project/Task/Commitment/Decision/Goal | Accountability. |
| `PART_OF` | Venture → Organization; Project → Venture/Org; Task → Project | Containment. |
| `SUBTASK_OF` | Task → Task | `parent_task_id`. |
| `BLOCKS` | Task/Project/Risk → Task/Project/Decision | Explicit blocker. |
| `DEPENDS_ON` | Task/Project → Task/Project/Decision | Sequencing. |
| `TARGETS` | Goal → Venture/Org | What the goal moves. |
| `MEASURED_BY` | Goal → KPI | Future. |
| `DECIDES` | Decision → Project/Goal/Venture | What the decision changes. |
| `CITES` | Decision/Recommendation → KnowledgeRecord/Document | Evidence link. |
| `SUPPORTS` / `CONTRADICTS` | KnowledgeRecord/Document → Decision/Recommendation | Signed evidence. |
| `PROMISES` | Commitment → Project/Goal/Decision | Which work the promise serves. |
| `RAISES` | Decision/Project/Rule → Risk | Risk provenance. |
| `MITIGATES` | Task/Commitment/Decision → Risk | Response. |
| `ATTACHED_TO` | Document → any node | Association table. |
| `DERIVES_FROM` | KnowledgeRecord → Document/KnowledgeRecord | Provenance chain. |
| `REFERENCED_BY` | any → any | Weak co-mention link (from activity). |
| `SUPERSEDES` | KnowledgeRecord → KnowledgeRecord | Version history. |

## Traversal rules

1. **Org boundary is absolute.** Every traversal starts from a node whose
   `orgId` matches the caller's active org. Edges to any other `orgId` are
   dropped at retrieval time, not filtered later.
2. **Bounded depth.** Default max depth = 2. `risk_scan` and `briefing`
   intents can request depth = 3 with a hard node cap.
3. **Edge weighting.** Each traversal policy carries an edge-weight map
   (e.g. `briefing` upweights `OWNS`, `BLOCKS`, `PROMISES`; `explain`
   upweights `CITES`, `SUPPORTS`, `CONTRADICTS`). Highest-weight edges
   are followed first until the node budget is reached.
4. **Recency decay.** Nodes older than the intent's time window are only
   included if reached via a strong-typed edge (`OWNS`, `PART_OF`,
   `CITES`).
5. **Truncation is explicit.** GraphSlice always reports
   `truncated: true` when the node budget was hit, so downstream stages
   can lower confidence and the formatter can surface "showing top N".
6. **No implicit joins outside the graph.** If two nodes are not
   connected by an edge listed above, SAM does not assert a relationship.

## Projection layer

The graph is materialized on demand by pure functions in
`src/lib/sam/graph/*` (Phase 3):

- `projectNode(row, type) → Node`
- `edgesForNode(node, policy) → Edge[]`  -  each edge type has one resolver
  that reads from Supabase via existing data hooks or dedicated
  server functions.
- `traverse(seedIds, policy) → GraphSlice`

No graph database is required. If future scale demands one, the
projection layer is the seam to swap in Neo4j / DuckDB PGQ / Postgres
recursive CTEs without touching downstream stages.

## Future extensions

- Meeting, KPI, SOP, Customer, Opportunity become first-class nodes as
  their tables ship; their edge kinds are already reserved above.
- A `snapshot_at(timestamp)` view will let SAM reason over the graph as
  it existed at an earlier point (for post-mortems and Weekly Review).