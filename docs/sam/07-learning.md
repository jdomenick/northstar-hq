# 07  -  Learning Framework

SAM improves over time without training a foundation model. Learning is
observation, versioned metrics, and per-org calibration  -  never gradient
updates on shared weights.

## What we track

| Signal | Source | Meaning |
| --- | --- | --- |
| `accepted` | user adopts suggestion | Action taken as-is. |
| `edited` | user modifies then executes | Direction right, specifics wrong. |
| `rejected` | explicit dismiss + reason | Explicit no. |
| `ignored` | no action within TTL | Passive negative. |
| `completed` | referenced entity reached terminal success | Action worked. |
| `failed` | referenced entity reached terminal failure | Action didn't. |
| `superseded` | later recommendation on same entity | Model changed its mind. |

## Tables

```
sam_recommendations
sam_recommendation_events        -- append-only
sam_learning_metrics             -- rolled-up per (orgId, intent, entityType, promptVersion)
sam_founder_learning
sam_organization_learning
```

All rows are RLS-scoped by `organization_id`; historical rows are append-only.

## Scopes

- **Founder learning.** Personal patterns; feeds Founder + Preference memory.
- **Organization learning.** Org-wide patterns; feeds Organization memory.
- **Never cross-org.** No aggregation across tenants.

## Feedback loop

1. **Historical reliability** (doc 05) is recomputed nightly from lifecycle events per `(orgId, intent, entityType, promptVersion)`.
2. **Preference inference** proposes updates to Founder/Organization memory as *pending* rows  -  never auto-written.
3. **Rejected-reason clustering** produces "avoid" patterns the Recommendation Engine consults.
4. **Prompt regression detection.** New `promptVersion` metrics are compared against the previous version for the same intent; regressions raise an audit alert.

## Versioning

`promptVersion`, `strategyVersion`, `confidenceMethod`, and `weightsVersion` are stamped on every recommendation. Metrics roll up per version tuple; older versions' metrics stay intact when new versions ship. Historical rows are never overwritten  -  corrections are new rows.

## Guardrails

- Users may soft-delete an event with reason "wrong signal" (excluded from metrics, kept for audit).
- Users can opt out of contributing to org-level learning; personal learning still applies.
- No learning row is used until a minimum sample threshold (default n=10 per bucket) to prevent early over-fitting.