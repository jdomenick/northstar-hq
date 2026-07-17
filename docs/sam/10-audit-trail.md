# 10  -  Audit Trail

Every SAM invocation is fully reconstructible from its audit rows. Audit
is not optional and not sampled. Without a complete audit row, the
response is not shown to the user.

## Tables

```
sam_invocations
sam_invocation_context_refs
sam_invocation_provider_calls
sam_invocation_recommendations   -- link to sam_recommendations
sam_invocation_feedback
```

All rows are `organization_id`-scoped with RLS.

## Row shapes

```
sam_invocations {
  id: uuid
  organization_id: uuid
  actor_user_id: uuid | null
  intent: text
  workflow_key: text | null
  surface: text
  scope: jsonb                      // { ventureId?, entityRefs[] }
  prompt_version: text
  strategy: text
  confidence_method: text
  weights_version: text
  started_at: timestamptz
  finished_at: timestamptz
  status: 'ok' | 'deferred' | 'error'
  response_id: uuid | null
  rollup_confidence: numeric
  error_code: text | null
}

sam_invocation_context_refs {
  invocation_id: uuid
  source: 'graph' | 'knowledge' | 'document' | 'memory' | 'rule'
  entity_type: text
  entity_id: uuid
  role: 'input' | 'evidence_for' | 'evidence_against' | 'assumption' | 'inference_rule'
}

sam_invocation_provider_calls {
  id: uuid
  invocation_id: uuid
  provider_id: text
  model_id: text
  prompt_version: text
  input_tokens: int
  output_tokens: int
  latency_ms: int
  cost_estimate: numeric | null
  status: 'ok' | 'error' | 'fallback'
  error_code: text | null
  raw_ref: text | null              // debug blob pointer; off by default
}

sam_invocation_feedback {
  invocation_id: uuid
  recommendation_id: uuid | null
  user_id: uuid
  kind: 'accepted' | 'edited' | 'rejected' | 'ignored' | 'completed' | 'failed'
  reason: text | null
  created_at: timestamptz
}
```

## Guarantees

1. **Reproducibility.** Given an `invocation_id`, engineering can reconstruct exact intent, context ids, prompt version, provider, model, recommendations, and the confidence score with its inputs.
2. **No PII leakage in the raw store.** `raw_ref` is off by default; admin opt-in per invocation. Raw blobs remain inside the RLS boundary.
3. **Feedback is append-only.**
4. **Retention.** Invocations kept indefinitely. Provider raw blobs default to 30-day retention. Configurable per org.
5. **Cost + latency roll up.** Aggregated views expose per-workflow and per-provider spend without exposing prompts.

## Extensibility

- New signals (safety-classifier verdicts, tool-call traces) are additive columns; older rows remain valid.
- External audit export (SOC2, enterprise) reads a read-only replica view  -  never the write path.