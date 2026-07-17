# ADR-0008: Audit rows are mandatory for delivery

- Status: Accepted
- Date: 2026-07-17
- Related: docs/sam/10-audit-trail.md

## Context
Auditing added after the fact is always incomplete. Enterprise, SOC2, and internal post-mortems all require full reconstruction.

## Decision
Every SAM invocation writes its `sam_invocations` row and child context/provider rows before the response is shown to the user. A failed audit write blocks delivery.

## Alternatives considered
- **Async / best-effort audit.** Rejected — creates silent gaps.

## Rationale
Delivery-blocking audit is the only guarantee that history is complete.

## Consequences
- Positive: reproducibility, compliance-ready.
- Negative: audit write is on the hot path (mitigated by narrow schema + async provider-raw storage).
- Follow-ups: latency budget for the audit write documented in Phase 3.