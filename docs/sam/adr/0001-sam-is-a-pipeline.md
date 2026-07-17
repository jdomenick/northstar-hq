# ADR-0001: SAM is an intelligence pipeline, not an LLM wrapper

- Status: Accepted
- Date: 2026-07-17
- Deciders: Northstar engineering
- Related: docs/sam/01-pipeline.md, docs/sam/09-provider-abstraction.md

## Context
SAM's value must be defensible against any single LLM commoditizing. The
market is full of thin chat wrappers whose moat evaporates when a provider
ships a comparable native feature.

## Decision
SAM is architected as a 12-stage pipeline (Intent → Context → Graph →
Knowledge → Rules → Memory → Reasoning → Recommendation → Confidence →
Citation → Formatter → Audit). The LLM is only invoked at stage 7 and
only through the Provider Abstraction Layer.

## Alternatives considered
- **Direct LLM chat with tool calls.** Rejected  -  vendor lock-in, no
  proprietary structure, no auditability floor.
- **RAG-only wrapper.** Rejected  -  retrieval alone doesn't encode
  executive reasoning, rules, or memory conflict resolution.

## Rationale
The pipeline stages Northstar owns (Graph, Rules, Memory, Confidence,
Citations, Learning, Audit) are the moat. The LLM is a replaceable
component.

## Consequences
- Positive: provider independence; auditability; explainability by construction.
- Negative: more surface area to build and maintain than a thin wrapper.
- Follow-ups: Phase 3 first end-to-end wiring via Daily Briefing.