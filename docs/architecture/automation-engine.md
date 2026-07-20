# NorthStar Labs Automation Engine (Job Engine)

_Phase 3D.2c-i - core schema and framework only_

## Why a Job Engine and not per-connector schedulers

NorthStar Labs is an Executive Operating System. Website sync, social publishing,
SAM briefings, memory maintenance, financial refreshes, and dozens of future
automations share the same durability, retry, dependency, and audit needs. A
single provider-neutral Job Engine gives us:

- one authoritative queue and audit trail
- one retry/idempotency model
- one place to enforce organization policy
- one health scoring surface
- one place to add pipelines that stitch jobs together

Per-connector schedulers cannot compose, cannot enforce org-wide concurrency
caps, and cannot honor cross-family dependencies.

## Trust boundaries

- Client callers never supply an authoritative `organization_id`; scope is
  derived server-side from `organization_members`.
- Only registered job types are accepted. Arbitrary client-supplied handler
  keys are rejected by `getJobDefinition`.
- `automation_jobs`, `automation_job_attempts`, `automation_job_events`,
  `automation_job_dependencies`, `automation_health_snapshots` are read-only
  to `authenticated`. Writes are performed by future server-only code using
  `service_role`.
- `automation_definitions` allows insert/update by org admins and owners.
- Cross-organization references (venture, asset, integration, parent/root
  job, dependency partner) are rejected by database triggers.

## Job states

`queued`, `scheduled`, `blocked`, `running`, `retrying`, `succeeded`,
`failed`, `cancelled`, `skipped`, `expired`.

Valid transitions live in `VALID_JOB_TRANSITIONS` and are enforced by
`isValidJobTransition`. Terminal states are `succeeded`, `failed`,
`cancelled`, `skipped`, `expired`.

## Job priorities

`critical`, `high`, `normal`, `low`, `background`. Priority weights in
`JOB_PRIORITY_WEIGHT` will drive queue ordering when the runner ships.
Provider output is never allowed to set priority.

## Idempotency

A partial unique index on `(organization_id, job_type, idempotency_key)`
covers active states only, so historical succeeded/failed jobs may share
keys. Every job handler must document its idempotency strategy in the
registry.

## Attempts

Every execution creates a row in `automation_job_attempts` with a unique
`(job_id, attempt_number)`. Attempt states are `running`, `succeeded`,
`failed`, `interrupted`, `timed_out`, `cancelled`.

## Dependencies

Types: `requires_success`, `requires_completion`, `runs_after`, `optional`.
`AUTOMATION_LIMITS.maxDependencyDepth` and `maxDependenciesPerJob` bound the
DAG. Cycle detection is provided by `assertNoCycleOrDepth`.

## Retry model

`retry.server.ts` classifies errors as permanent, transient, or unknown;
computes fixed/exponential delays; and returns a `RetryDecision`.
`AUTOMATION_LIMITS.maxAttempts` is the hard ceiling regardless of the
per-job policy.

## Future scheduler

3D.2c-ii adds `pg_cron` + a `/api/public/hooks/*` endpoint (authenticated
with the anon key per project convention) that walks due
`automation_definitions`, creates jobs idempotently, and advances
`next_run_at`. The scheduler must not require the browser to be open.

## Future worker model

3D.2c-ii adds a `SECURITY DEFINER` RPC that atomically claims one eligible
job via `FOR UPDATE SKIP LOCKED`, transitioning it into `running` and
stamping a worker lease. Stale claims are recovered by the same worker on
the next tick.

## Future website_sync migration

The existing inline website sync becomes the first `implemented` handler.
Manual "Run Now" enqueues a job instead of holding the HTTP request open.

## Future social automation integration

3D.2c-iii introduces the social domain (accounts, plans, items, versions,
publication attempts, brand profile) and safety switches. Live connectors
land in a later dedicated milestone. In this milestone all social job types
return `job_not_implemented`.

## What is intentionally NOT implemented in 3D.2c-i

- scheduler execution / `pg_cron`
- queue worker / atomic claim RPC
- job runner / attempt execution
- retry execution
- stale-job recovery
- website sync migration onto the engine
- manual Run Now migration
- Operations UI, Automation UI
- social tables / accounts / publishing / generation
- live Signal emission from jobs
- health calculation runtime
- provider execution
- pipeline execution

Every listed capability has a contract in code and a place in the schema;
the runtime lands in subsequent milestones.