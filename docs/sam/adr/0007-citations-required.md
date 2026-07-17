# ADR-0007: Every claim requires a citation

- Status: Accepted
- Date: 2026-07-17
- Related: docs/sam/06-citations.md

## Context
Unsourced AI output erodes trust and creates liability. Executives cannot act on claims they cannot verify.

## Decision
The Recommendation Engine drops any recommendation without at least one `direct` or `supporting` citation. Assumptions and inferences are also cited (assumptions cite the assumed record; inferences cite the rule id).

## Alternatives considered
- **Best-effort citations.** Rejected  -  degrades to unsourced output under pressure.

## Rationale
A hard structural requirement is the only way to guarantee explainability at scale.

## Consequences
- Positive: users can always verify.
- Negative: SAM will sometimes stay silent when it could have guessed.
- Follow-ups: rule catalog with stable ids.