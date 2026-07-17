# 08 — Executive Workflows

Workflows are named, scheduled, structured SAM programs. Each is a
specific pipeline invocation with fixed intent, retrieval policy,
reasoning strategy, and output surface. This section defines the
contracts; implementation ships in Phase 3+.

## Common workflow record

```
Workflow {
  key: WorkflowKey
  intent: IntentType
  trigger: {
    kind: 'cron' | 'event' | 'manual'
    schedule?: string
    event?: string
  }
  inputs: WorkflowInput[]
  outputs: WorkflowOutput[]
  requiredData: EntityRequirement[]
  strategy: ReasoningStrategy
  confidenceFloor?: number
  surface: 'briefing_card' | 'decision_panel' | 'review_page' | 'email' | 'notification'
}
```

A workflow that cannot satisfy `requiredData` short-circuits with a
`Deferred` result and posts an honest empty state.

## Catalog

### Daily Briefing
- **Trigger.** Cron at user's preferred hour (Preference memory), default 07:00 local.
- **Inputs.** Founder id, org id, previous briefing cursor from Operational memory.
- **Outputs.** ExplainableSummary with today's priorities, decisions waiting, overdue/due-soon commitments, project risk changes since last briefing.
- **Required data.** ≥1 active venture OR ≥1 open commitment/decision.
- **Dependencies.** Rules Engine, Preference + Operational memory, Learning (founder patterns).
- **Strategy.** `plan_then_critique`.

### Weekly Review
- **Trigger.** Cron weekly, user-selected day (default Friday PM).
- **Inputs.** Org id, week window.
- **Outputs.** What moved, what stalled, decisions closed/opened, goals delta, risks raised, focuses for next week.
- **Required data.** ≥7 days of activity events.
- **Dependencies.** Graph snapshot at start-of-week + now, Historical memory.
- **Strategy.** `multi_actor`.

### Decision Review
- **Trigger.** Manual from Decision detail; auto on `review_date` today.
- **Inputs.** Decision id.
- **Outputs.** Objectives restatement, evidence summary, gaps, contradictions, recommended status change with rationale.
- **Required data.** Decision with ≥1 option or evidence entry.
- **Strategy.** `plan_then_critique`.

### Risk Review
- **Trigger.** Cron weekly; manual from any Project/Venture.
- **Inputs.** Scope (venture or org), time window.
- **Outputs.** Ranked Risk list with likelihood/impact, mitigation candidates.
- **Required data.** ≥1 Decision with risks OR ≥1 blocked/at_risk Project.
- **Strategy.** `multi_actor`.

### Priority Planning
- **Trigger.** Manual from Command; nightly to warm Operational memory.
- **Inputs.** Founder id, planning horizon.
- **Outputs.** Ranked priorities combining `scorePriority` signals + memory + learning.
- **Required data.** ≥1 commitment/decision/project.
- **Strategy.** `deterministic_only` when Rules + Learning suffice; else `plan_then_critique`.

### Goal Alignment
- **Trigger.** Manual; auto on goal creation/edit.
- **Inputs.** Goal id.
- **Outputs.** How projects/commitments/decisions align (or not); corrective actions.
- **Required data.** Goal with target + at least one candidate related entity.
- **Strategy.** `plan_then_critique`.

### Commitment Review
- **Trigger.** Cron daily; manual from Accountability.
- **Inputs.** Founder / member id.
- **Outputs.** Overdue and repeatedly-postponed commitments with recommended action (complete, reschedule with realistic date, cancel with reason).
- **Required data.** ≥1 commitment past due or postponed ≥2 times.
- **Strategy.** `single_pass`.

### Venture Health
- **Trigger.** Cron weekly per venture; manual from Venture detail.
- **Inputs.** Venture id, prior health snapshot.
- **Outputs.** Health rating with signal breakdown (velocity, decision throughput, risk load, knowledge freshness), narrative.
- **Required data.** Venture with ≥30 days of history OR explicit newVenture path.
- **Strategy.** `multi_actor`.

### Organization Health
- **Trigger.** Cron monthly; manual from Command.
- **Inputs.** Org id, prior monthly snapshot.
- **Outputs.** Rollup across ventures, member load balance, decision hygiene, knowledge coverage gaps.
- **Required data.** ≥1 venture, ≥30 days of history.
- **Strategy.** `multi_actor`.

## Extensibility

- Workflows are registered in a `WorkflowRegistry`; a new workflow needs only key, contract, and strategy — scheduler and audit handle the rest.
- Per-org enable/disable + schedule overrides live in Preference memory (org scope).
- Custom workflows (e.g. Fundraise Prep) plug in the same way in later phases.