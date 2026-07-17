# ADR-0004: Confidence is structured metadata, not styling

- Status: Accepted
- Date: 2026-07-17
- Related: docs/sam/05-confidence.md

## Context
Confidence often ships as a color badge with no underlying model, making calibration and audit impossible.

## Decision
Every SAM output carries a `ConfidenceObject` with a numeric score, band, seven typed signals, human-readable reasons, and a stamped method version. UI renders it however it wants; the intelligence layer owns the data.

## Alternatives considered
- **Free-form "low/med/high" string.** Rejected  -  not calibratable, not auditable.
- **Model-emitted self-confidence only.** Rejected  -  LLMs are poorly calibrated on their own confidence.

## Rationale
Deterministic signals + versioned weights let us tune per org and prove behavior over time.

## Consequences
- Positive: calibratable, auditable, explainable.
- Negative: more work than a color.
- Follow-ups: Phase 4 per-org weight calibration from Historical Memory.