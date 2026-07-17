# Automation Engine Runtime (Phase 3D.2c-ii)

## Scheduler / worker deployment

Both the worker tick and scheduler tick are protected server routes:

- `POST /api/public/automation/tick` — invokes stale recovery then the
  worker loop. Header `x-automation-secret: $AUTOMATION_SCHEDULER_SECRET`.
- `POST /api/public/automation/scheduler` — runs one scheduler pass.
  Header `x-automation-secret: $AUTOMATION_SCHEDULER_SECRET`.

`AUTOMATION_SCHEDULER_SECRET` is already generated in the project's runtime
secrets. Neither anon key nor a signed-in session is authorization; only the
header secret is.

### Enabling scheduled execution

Scheduled execution is NOT live yet. Two manual steps remain:

1. Enable `pg_cron` + `pg_net` extensions in the database (Cloud → Advanced).
2. Insert cron jobs referencing the deployed URL:

```sql
select cron.schedule(
  'automation-worker-tick',
  '* * * * *',
  $$select net.http_post(
    url:='https://project--0d729d9b-ddb9-49fb-9d95-0093c085d057.lovable.app/api/public/automation/tick',
    headers:=jsonb_build_object('x-automation-secret','<secret from AUTOMATION_SCHEDULER_SECRET>'),
    body:='{}'::jsonb
  );$$
);

select cron.schedule(
  'automation-scheduler-tick',
  '*/5 * * * *',
  $$select net.http_post(
    url:='https://project--0d729d9b-ddb9-49fb-9d95-0093c085d057.lovable.app/api/public/automation/scheduler',
    headers:=jsonb_build_object('x-automation-secret','<secret from AUTOMATION_SCHEDULER_SECRET>'),
    body:='{}'::jsonb
  );$$
);
```

Until those cron rows exist, only the manual Run Now flow (`enqueueWebsiteSyncJob`)
enqueues jobs, and the runtime tick can be invoked manually with the header.
