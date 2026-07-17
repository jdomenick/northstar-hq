# 01 — Intelligence Pipeline

Every SAM invocation flows through the same twelve stages. The pipeline is
deterministic in structure; only Stage 7 (Executive Reasoning) delegates
to an LLM, and that call is bounded by the Provider Abstraction Layer.

```text
 User request / scheduled trigger
          │
          ▼
 ┌──────────────────────┐
 │ 1  Intent Classifier │
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐   ┌───────────────────────────┐
 │ 2  Context Assembler │◀──│ Org / venture / user scope│
 └──────────┬───────────┘   └───────────────────────────┘
            ▼
 ┌──────────────────────┐   ┌───────────────────────────┐
 │ 3  Graph Retrieval   │◀──│ Executive Graph (doc 02)  │
 └──────────┬───────────┘   └───────────────────────────┘
            ▼
 ┌──────────────────────┐   ┌───────────────────────────┐
 │ 4  Knowledge Retrieval│◀─│ Knowledge + Documents     │
 └──────────┬───────────┘   └───────────────────────────┘
            ▼
 ┌──────────────────────┐   ┌───────────────────────────┐
 │ 5  Rules Engine      │◀──│ Accountability rules,     │
 │                      │   │ org policies, deadlines   │
 └──────────┬───────────┘   └───────────────────────────┘
            ▼
 ┌──────────────────────┐   ┌───────────────────────────┐
 │ 6  Memory Engine     │◀──│ Memory layers (doc 03)    │
 └──────────┬───────────┘   └───────────────────────────┘
            ▼
 ┌──────────────────────┐
 │ 7  Executive         │
 │    Reasoning Engine  │ ── Provider Abstraction (doc 09)
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 8  Recommendation    │
 │    Engine            │
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 9  Confidence Engine │
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 10 Citation Builder  │
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 11 Response Formatter│
 └──────────┬───────────┘
            ▼
 ┌──────────────────────┐
 │ 12 Audit Logger      │
 └──────────────────────┘
```

## Stage contracts

### 1. Intent Classifier
- **Purpose.** Map a raw request or trigger to one of SAM's intent types:
  `briefing`, `question`, `recommendation`, `review`, `plan`, `explain`,
  `draft`, `summarize`, `compare`, `risk_scan`.
- **Inputs.** Raw prompt text or workflow trigger, active workspace scope
  (org, venture, project, entity id if any), calling surface (Command,
  Decision detail, Briefing).
- **Outputs.** `{ intent, scope, entityRefs[], requestedDetailLevel }`.
- **Dependencies.** None — pure function over request + scope.
- **Extensibility.** New intents register via an `IntentRegistry` (string
  key → classifier fn + downstream contract). Zero-training rule matcher
  first, LLM-assisted fallback later.

### 2. Context Assembler
- **Purpose.** Resolve the working scope into a `ContextBundle`: which
  org, venture, projects, members, and time window are in play.
- **Inputs.** Intent, current route, `OrgProvider` state, user identity.
- **Outputs.** `ContextBundle { orgId, ventureIds[], userId, role,
  timeWindow, surface }`.
- **Dependencies.** `OrgProvider`, permissions helper.
- **Extensibility.** Surface adapters (Command, Decision detail, external
  webhook) each implement `assembleContext(request) → ContextBundle`.

### 3. Executive Graph Retrieval
- **Purpose.** Walk the Executive Graph (doc 02) from the entities in
  scope to gather neighbors relevant to the intent (e.g. a decision pulls
  its owning venture, related projects, blocking risks, cited knowledge).
- **Inputs.** ContextBundle, intent.
- **Outputs.** `GraphSlice { nodes[], edges[], depth, truncated }`.
- **Dependencies.** Data-hooks layer / server functions that project the
  relational schema into graph nodes and edges.
- **Extensibility.** Traversal policies per intent (e.g. `risk_scan`
  favours Risk + Commitment + Decision edges; `briefing` favours
  time-bounded activity edges).

### 4. Knowledge Retrieval
- **Purpose.** Pull the most relevant Knowledge Records and Documents for
  the intent — deterministic filters first (venture, tag, importance,
  verification, recency). Semantic retrieval is a Phase-3 add via the
  same interface.
- **Inputs.** ContextBundle, intent, GraphSlice.
- **Outputs.** `KnowledgeSet { records[], documents[], reasonPerItem }`.
- **Dependencies.** Knowledge + Documents tables, `RetrievalStrategy`
  interface (see doc 09).
- **Extensibility.** Strategies are pluggable: `filter`, `bm25`, `vector`,
  `hybrid`. Only `filter` ships now.

### 5. Rules Engine
- **Purpose.** Apply Northstar's deterministic executive rules before any
  model call: overdue detection, stalled-project thresholds, decision
  waiting states, goal-at-risk math, postponement rules. These are the
  same rules that already power `src/lib/accountability.ts`.
- **Inputs.** GraphSlice, KnowledgeSet, ContextBundle.
- **Outputs.** `RuleFindings[] { code, severity, entityRef, evidence }`.
- **Dependencies.** `src/lib/accountability.ts`, future org-level policy
  DSL.
- **Extensibility.** Rules are registered by code; org-level overrides
  loaded from Organization Memory (doc 03).

### 6. Memory Engine
- **Purpose.** Fetch the memory slices the reasoning engine will need —
  founder preferences, org norms, venture history, prior recommendations
  on this entity — and resolve conflicts per doc 03.
- **Inputs.** ContextBundle, intent, entityRefs.
- **Outputs.** `MemoryBundle` grouped by layer with per-item confidence
  and source.
- **Dependencies.** Memory tables (doc 03), conflict resolver.
- **Extensibility.** Layer readers implement a common `MemoryReader`
  interface; new layers plug in without touching the engine.

### 7. Executive Reasoning Engine
- **Purpose.** Execute the Reasoning Framework (doc 04) with the assembled
  context. This is the only stage that talks to a model, always via the
  Provider Abstraction Layer.
- **Inputs.** `ReasoningRequest { intent, contextBundle, graphSlice,
  knowledgeSet, ruleFindings, memoryBundle, promptVersion }`.
- **Outputs.** `ReasoningTrace` — structured internal record of every
  reasoning slot (objectives, evidence for/against, gaps, risks,
  opportunities, alignment, candidate actions). Never shown to users
  verbatim.
- **Dependencies.** Provider Abstraction (doc 09), prompt registry.
- **Extensibility.** Reasoning strategies (single-pass, plan-then-critique,
  multi-actor) are named strategies selected per intent.

### 8. Recommendation Engine
- **Purpose.** Distill the ReasoningTrace into 0..N `Recommendation`
  objects with proposed actions that map to real Northstar mutations
  (create task, reschedule commitment, mark decision waiting).
- **Inputs.** ReasoningTrace, RuleFindings, ContextBundle.
- **Outputs.** `Recommendation[] { id, kind, title, rationaleRefs[],
  proposedActions[], impactedEntities[] }`.
- **Dependencies.** Action catalog mapping to existing data hooks.
- **Extensibility.** Recommendation kinds registered per surface;
  autonomous execution (Phase 4+) reuses the same shape.

### 9. Confidence Engine
- **Purpose.** Attach a `ConfidenceObject` (doc 05) to every
  recommendation and to the response as a whole.
- **Inputs.** ReasoningTrace, KnowledgeSet, RuleFindings, MemoryBundle.
- **Outputs.** `ConfidenceObject` per recommendation + rollup.
- **Dependencies.** Confidence scoring functions (deterministic).
- **Extensibility.** Scoring weights configurable per org; historical
  reliability sourced from Learning Framework (doc 07).

### 10. Citation Builder
- **Purpose.** For every claim and recommendation, emit `Citation[]`
  pointing to real Northstar records (doc 06). Also classify each cite
  as direct evidence, supporting evidence, assumption, or inference.
- **Inputs.** ReasoningTrace, Recommendations, GraphSlice, KnowledgeSet.
- **Outputs.** `Citations` graph keyed by claim id.
- **Dependencies.** Entity URL builders, deep-link routes.
- **Extensibility.** New entity types plug in a `Citable` adapter.

### 11. Response Formatter
- **Purpose.** Render the recommendations, citations, and confidence into
  the shape the calling surface expects (Briefing card, Decision panel,
  Priorities list). Never leaks the raw ReasoningTrace.
- **Inputs.** Recommendations, Citations, Confidence, surface.
- **Outputs.** Surface-specific view model.
- **Dependencies.** Surface renderers.
- **Extensibility.** Add a formatter per surface without touching earlier
  stages.

### 12. Audit Logger
- **Purpose.** Persist the full audit row (doc 10) for the invocation:
  prompt version, context source ids, provider, model, confidence,
  recommendation ids, response version. Feedback is stitched in later.
- **Inputs.** Everything.
- **Outputs.** `audit_events` row + linked child rows.
- **Dependencies.** Audit tables.
- **Extensibility.** Additional signals (latency, cost, provider health)
  are additive columns.

## Cross-cutting rules

- Stages 1–6 and 8–12 are deterministic. Only stage 7 is probabilistic.
- Every stage receives and returns typed contracts. No stage reads
  Supabase ad-hoc — retrieval is centralized in stages 3, 4, 6.
- Any stage can short-circuit with a `Deferred` result ("insufficient
  data") which the formatter renders as an honest empty state — never a
  hallucinated answer.
- The whole pipeline runs inside an org-scoped server function so RLS is
  enforced by the database, not by SAM.