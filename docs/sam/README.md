# SAM  -  Executive Intelligence Architecture

SAM is NorthStar Labs' proprietary executive intelligence system. It is not a
chatbot and not an LLM wrapper. The LLM is one replaceable component inside
a larger pipeline whose defensibility comes from the Executive Graph, the
Memory layers, the Reasoning Framework, the Confidence model, the Citation
system, the Learning loop, and the Audit trail  -  all of which NorthStar Labs
owns end to end.

This directory is the blueprint. Nothing here is wired to a provider yet;
Phase 3 will implement the Provider Abstraction Layer and connect the
first model behind it.

## Documents

- [01  -  Intelligence Pipeline](./01-pipeline.md)
- [02  -  Executive Graph](./02-executive-graph.md)
- [03  -  Memory Architecture](./03-memory.md)
- [04  -  Executive Reasoning Framework](./04-reasoning.md)
- [05  -  Confidence Framework](./05-confidence.md)
- [06  -  Citation Architecture](./06-citations.md)
- [07  -  Learning Framework](./07-learning.md)
- [08  -  Executive Workflows](./08-workflows.md)
- [09  -  Provider Abstraction Layer](./09-provider-abstraction.md)
- [10  -  Audit Trail](./10-audit-trail.md)
- [11  -  Architecture Decision Records](./adr/README.md)

## Design principles

1. **Provider independence.** SAM's value is the pipeline around the model,
   not the model itself. Swapping OpenAI for Anthropic, Gemini, or an
   on-prem model must be a config change, never a rewrite.
2. **Explainability first.** No recommendation ships without citations and
   a confidence object. If SAM cannot cite it, SAM does not claim it.
3. **Executive reasoning, not chat.** SAM produces briefings,
   recommendations, and reviews with a fixed internal reasoning contract.
   It never free-associates.
4. **User sovereignty over memory.** Every memory layer is user-editable
   and versioned. SAM never permanently locks a fact about a founder or
   an organization.
5. **Per-organization isolation.** All intelligence artifacts inherit the
   same RLS boundary as the underlying records. There is no cross-tenant
   inference, ever.
6. **Auditability.** Every response is reconstructible from its audit row:
   prompt version, context sources, provider, model, confidence, feedback.
7. **Defensibility.** The Executive Graph + Memory + Learning loop is the
   moat. The model is a commodity.

## What this phase is NOT

No chat UI, no provider integration, no embeddings, no vector database, no
document parsing, no OCR, no autonomous actions. Existing Phase 1–2D
functionality is untouched.

## Implementation status

- **Phase 3A**  -  SAM Foundation: live `/sam` route, provider abstraction,
  deterministic pipeline, deterministic confidence, audit trail, rate
  limits, prompt-injection defenses.
- **Phase 3B**  -  SAM Memory + Executive Graph:
  - `sam_memory_items`, versions, feedback, conflicts
  - `executive_graph_edges` with same-org DB-level trigger
  - `sam_learning_events`, `sam_response_feedback`
  - Precedence v1 (`ADR-0011`), Decay v1, Confidence v2 (memory-aware)
  - Memory workspace at `/sam/memory`; SAM Settings form; response feedback
  - Archive Center restore completed for ventures / goals / decisions /
    commitments (Phase 2D leftover)
  - Privacy: founder + preference memory user-private (`ADR-0010`)

## Architecture ownership

NorthStar HQ owns:

- company/business state
- revenue
- proposals
- billing
- client workspace
- delivery
- goals/projects/decisions/commitments
- executive intelligence

SAM Core owns:

- SAM operational memory
- directives
- missions
- mission work items
- agent approvals
- runtime/task execution
- work-request protocol
- capability execution
- application credentials
- social OAuth connections
- agent autonomy
- learning
- execution audit

Standalone SAM owns:

- public SAM marketing website
- auth handoff to SAM Core

The old standalone SAM platform layer is legacy/frozen.