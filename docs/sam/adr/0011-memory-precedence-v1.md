# ADR-0011  -  Memory Precedence v1

Status: Accepted (Phase 3B)

## Context

Multiple memory items can be relevant to the same executive question. SAM
needs a deterministic, versioned rule for which item wins when they
disagree  -  with no dependence on the model provider.

## Decision

Precedence is a deterministic rank, `MEMORY_PRECEDENCE_VERSION = "sam.memory.precedence.v1"`,
computed by `rankMemory()` in `src/lib/sam/memory/precedence.ts`:

`rank = statusRank * 10 + layerSpecificity + scopeBoost + personalBoost + stalenessPenalty`

Order (lower rank ⇒ higher precedence):

1. `confirmed` beats `disputed`, `proposed`, `outdated`, `superseded`, `archived`.
2. Personal (`preference`, `founder`) and venture-specific layers are more
   specific than organization-wide.
3. Items matching the active venture get a scope boost.
4. Personal layers owned by the current user get a personal boost.
5. Older-than-90d items get a small staleness penalty; older-than-180d get a
   larger one. Expired items are demoted and capped at confidence 0.2.

## Consequences

- Two auditors starting from the same input reach the same ranking.
- Provider output cannot change precedence.
- Any material change to the algorithm bumps the version constant and
  invalidates cached rankings; audit rows retain the version used.