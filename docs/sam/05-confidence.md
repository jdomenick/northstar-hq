# 05  -  Confidence Framework

No recommendation, briefing, or answer ships without a `ConfidenceObject`.
Confidence is structured metadata, not a color. The UI decides how to
render it; the intelligence layer decides what it is.

## ConfidenceObject

```
ConfidenceObject {
  score: number                    // 0..1, calibrated
  band: 'low' | 'moderate' | 'high' | 'very_high'
  signals: {
    dataCompleteness: number
    dataRecency: number
    verificationCoverage: number   // cited verified knowledge / cited knowledge
    corroboration: number
    contradictionPenalty: number
    missingContextPenalty: number
    historicalReliability: number  // from Learning Framework
  }
  reasons: string[]
  computedAt: timestamptz
  method: 'v1.deterministic'
}
```

## Scoring

Weights live in a versioned `sam_confidence_weights` table.

```
score = clamp01(
   0.20 * dataCompleteness
 + 0.15 * dataRecency
 + 0.15 * verificationCoverage
 + 0.15 * corroboration
 + 0.15 * historicalReliability
 - 0.10 * contradictionPenalty
 - 0.10 * missingContextPenalty
)
```

Bands: `>=0.85 very_high`, `>=0.65 high`, `>=0.40 moderate`, `<0.40 low`.

## Signal definitions

- **dataCompleteness**  -  non-empty ReasoningTrace slots ratio.
- **dataRecency**  -  median age of cited entities vs. intent window.
- **verificationCoverage**  -  verified knowledge ÷ cited knowledge.
- **corroboration**  -  independent supporting sources, normalized (1→0.3, 2→0.6, 3+→1.0).
- **contradictionPenalty**  -  weighted count of evidenceAgainst.
- **missingContextPenalty**  -  high-impact `missingInformation` items.
- **historicalReliability**  -  rolling accuracy for this org/intent (doc 07). Neutral 0.5 for new orgs.

## Rules

1. Confidence exists per recommendation AND per response (rollup = min unless the strategy overrides).
2. Low confidence is a first-class outcome  -  SAM may say "I don't know enough" and propose gathering more.
3. Never inflate confidence to be persuasive. Every drop below `high` must expose its `reasons[]`.
4. `method` is stamped so audit rows stay interpretable across formula changes.

## Extensibility

- Add signals by extending the object + weights config and bumping `method`.
- Per-org calibration (fit weights from historical outcomes) is a Phase 4 goal.