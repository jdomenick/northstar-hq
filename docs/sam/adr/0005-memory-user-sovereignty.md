# ADR-0005: Memory is layered, user-editable, and never permanently locked

- Status: Accepted
- Date: 2026-07-17
- Related: docs/sam/03-memory.md

## Context
"AI memory" often becomes an opaque store users cannot inspect or correct, creating trust and compliance issues.

## Decision
SAM memory is six explicit layers (Founder, Organization, Venture, Operational, Historical, Preference). Every non-historical row is user-editable; Historical rows are append-only but soft-hideable from retrieval. User edits always beat inferences. Every row is versioned via `supersedesId`.

## Alternatives considered
- **Single blob memory.** Rejected  -  unauditable, un-scopeable.
- **Model-managed memory.** Rejected  -  no user sovereignty.

## Rationale
Trust requires inspection and correction. Layers make ownership and lifetime explicit.

## Consequences
- Positive: user trust, compliance clarity, deterministic conflict resolution.
- Negative: more schema and UI surface.
- Follow-ups: Memory settings surface in Phase 3.