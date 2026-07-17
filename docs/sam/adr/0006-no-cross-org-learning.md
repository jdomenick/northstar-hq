# ADR-0006: No cross-organization learning

- Status: Accepted
- Date: 2026-07-17
- Related: docs/sam/07-learning.md

## Context
Aggregating learning across tenants can improve models but creates real data-leakage and competitive-intel risks Northstar's audience will not tolerate.

## Decision
All learning rows, metrics, and calibration are scoped to a single `organization_id`. There is no cross-tenant aggregation, ever.

## Alternatives considered
- **Anonymized cross-org aggregation.** Rejected — anonymization is fragile at low n; not worth the trust cost.

## Rationale
Trust and defensibility beat the marginal model-quality gain from shared learning.

## Consequences
- Positive: strong privacy story; simple RLS story.
- Negative: new orgs bootstrap with only their own signal.
- Follow-ups: neutral starting priors documented per intent.