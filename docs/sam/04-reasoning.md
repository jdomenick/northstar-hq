# 04 — Executive Reasoning Framework

SAM never answers off the top of the model. Every invocation runs through a
fixed internal reasoning contract. The contract is proprietary IP: it is
not shown to end users verbatim. Users see an explainable summary drawn
from it.

## The Reasoning Trace (internal only)

```
ReasoningTrace {
  intent: IntentType
  slots: {
    objectives: Statement[]
    context: Statement[]
    evidenceFor: Evidence[]
    evidenceAgainst: Evidence[]
    missingInformation: Gap[]
    risks: RiskAssessment[]
    opportunities: OpportunityAssessment[]
    alignment: {
      organizationGoals: AlignmentScore[]
      ventureGoals: AlignmentScore[]
      founderPreferences: AlignmentScore[]
    }
    candidateActions: ActionCandidate[]
    selectedActions: ActionCandidate[]
    rejectedActions: { action, reason }[]
    confidenceInputs: ConfidenceSignal[]
  }
  provenance: {
    graphNodeIds: string[]
    knowledgeIds: string[]
    documentIds: string[]
    memoryKeys: string[]
    ruleFindingIds: string[]
  }
  promptVersion: string
  strategy: ReasoningStrategy
}
```

Every `Statement`, `Evidence`, `Gap`, `Risk`, `Opportunity`,
`AlignmentScore`, and `ActionCandidate` carries `sourceRefs[]` pointing
into the Executive Graph so the Citation Builder can render them later.

## Reasoning strategies

| Strategy | Used for | Shape |
| --- | --- | --- |
| `single_pass` | quick questions, summaries | fill slots in one model call |
| `plan_then_critique` | recommendations, decision reviews | draft → self-critique → revise |
| `multi_actor` | risk / weekly reviews | analyst + critic + executive passes merged deterministically |
| `deterministic_only` | anything the Rules Engine can fully answer | skip stage 7 entirely |

## Contract rules

1. **No slot left empty by default.** Missing information is a first-class slot; blank slots are a bug.
2. **Contradicting evidence is mandatory.** If none is found, the engine records why.
3. **Actions must map to real mutations** in the Action Catalog.
4. **Alignment is scored on a bounded scale** (-1/0/+1 + reason).
5. **The trace is auditable.** Nothing appears in the response that isn't in the trace.

## User-facing surface

```
ExplainableSummary {
  headline: string
  why: string[]                    // 2–4 bullets from evidenceFor + alignment
  watchOuts: string[]              // from evidenceAgainst + risks
  gaps: string[]                   // from missingInformation
  suggestedActions: ActionRef[]
  citations: CitationRef[]
  confidence: ConfidenceObject
}
```

Never surfaced: full slot map, rejected actions with internal reasons, raw chain-of-thought, prompt text.

## Extensibility

- New strategies implement `ReasoningStrategy.run(request) → ReasoningTrace`.
- New slots bump `promptVersion` and extend the audit schema — never repurpose existing slots.
- Domain reasoners (financial, legal, hiring) plug in as sub-strategies gated by intent + org preference.