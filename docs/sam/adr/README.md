# Architecture Decision Records (ADR)

ADRs are the official engineering history of SAM. Every non-obvious
decision  -  architectural, structural, or policy  -  is captured as a
numbered ADR under this directory. ADRs are append-only; if a decision
changes, write a new ADR that supersedes the old one and set the old
ADR's status to `Superseded by ADR-NNNN`.

## Filename convention

```
adr/NNNN-short-slug.md
```

`NNNN` is a zero-padded monotonic counter. Never renumber.

## Template

```
# ADR-NNNN: <Title>

- Status: Proposed | Accepted | Superseded by ADR-XXXX | Deprecated
- Date: YYYY-MM-DD
- Deciders: <names / roles>
- Related: ADR-…, doc links

## Context
What situation forced this decision? What are the constraints?

## Decision
What did we decide? Be specific and imperative.

## Alternatives considered
- Alt A  -  why rejected
- Alt B  -  why rejected

## Rationale
Why the chosen decision beats the alternatives given today's constraints.

## Consequences
- Positive: …
- Negative / trade-offs: …
- Follow-ups required: …
```

## Rules

1. One decision per ADR.
2. Written when the decision is made, not retrospectively.
3. Never edited after Accepted except to change Status or point to the superseding ADR.
4. Discoverable via the index below.

## Index

- [ADR-0001: SAM is an intelligence pipeline, not an LLM wrapper](./0001-sam-is-a-pipeline.md)
- [ADR-0002: Executive Graph is logical, not a graph database](./0002-executive-graph-logical.md)
- [ADR-0003: Provider Abstraction Layer is the only vendor boundary](./0003-provider-abstraction-boundary.md)
- [ADR-0004: Confidence is structured metadata, not styling](./0004-confidence-is-metadata.md)
- [ADR-0005: Memory is layered, user-editable, and never permanently locked](./0005-memory-user-sovereignty.md)
- [ADR-0006: No cross-organization learning](./0006-no-cross-org-learning.md)
- [ADR-0007: Every claim requires a citation](./0007-citations-required.md)
- [ADR-0008: Audit rows are mandatory for delivery](./0008-audit-mandatory.md)
## Phase 3B
- [0010  -  Memory privacy scopes](./0010-memory-privacy-scopes.md)
- [0011  -  Memory precedence v1](./0011-memory-precedence-v1.md)
- [0012  -  Executive graph as relational projection](./0012-executive-graph-relational-projection.md)
