
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Private schema for scheduler internals
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA internal TO service_role;

-- Log table: never contains the secret or Authorization header
CREATE TABLE IF NOT EXISTS internal.cron_run_log (
  id BIGSERIAL PRIMARY KEY,
  job_name TEXT NOT NULL,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  net_request_id BIGINT,
  http_status INTEGER,
  ok BOOLEAN,
  error_summary TEXT
);
REVOKE ALL ON internal.cron_run_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON internal.cron_run_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE internal.cron_run_log_id_seq TO service_role;

-- Function invoked by cron. SECURITY DEFINER so it can read the vault
-- secret and enqueue via net.http_post; never returns or logs the secret.
CREATE OR REPLACE FUNCTION internal.run_automation_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = internal, extensions, public
AS $$
DECLARE
  v_secret TEXT;
  v_url TEXT := 'https://project--0d729d9b-ddb9-49fb-9d95-0093c085d057.lovable.app/api/public/automation/tick';
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
   WHERE name = 'automation_scheduler_secret'
   LIMIT 1;

  IF v_secret IS NULL THEN
    INSERT INTO internal.cron_run_log(job_name, ok, error_summary)
    VALUES ('automation-tick-every-minute', false, 'vault_secret_missing');
    RETURN;
  END IF;

  BEGIN
    SELECT net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-automation-secret', v_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    ) INTO v_request_id;

    INSERT INTO internal.cron_run_log(job_name, net_request_id, ok)
    VALUES ('automation-tick-every-minute', v_request_id, true);
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO internal.cron_run_log(job_name, ok, error_summary)
    VALUES ('automation-tick-every-minute', false, left(SQLERRM, 200));
  END;
END;
$$;

REVOKE ALL ON FUNCTION internal.run_automation_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.run_automation_tick() TO service_role;

-- Idempotent schedule: unschedule any prior copy, then schedule fresh.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT jobid FROM cron.job WHERE jobname = 'automation-tick-every-minute' LOOP
    PERFORM cron.unschedule(r.jobid);
  END LOOP;
  PERFORM cron.schedule(
    'automation-tick-every-minute',
    '* * * * *',
    $cron$SELECT internal.run_automation_tick();$cron$
  );
END $$;
