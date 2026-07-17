
-- ─────────────────────────────────────────────────────────────
-- Phase 3D.2c-ii: Automation Engine runtime
-- Additive: lease columns + atomic RPCs for claim / recover /
-- cancel / scheduler advance. SECURITY DEFINER, EXECUTE revoked
-- from anon + authenticated. Only service_role may call.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.automation_jobs
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_autojob_claim_order
  ON public.automation_jobs (
    priority, available_at, scheduled_for, created_at, id
  )
  WHERE status IN ('queued','retrying');

CREATE INDEX IF NOT EXISTS idx_autojob_lease_expiry
  ON public.automation_jobs (lease_expires_at)
  WHERE status = 'running';

-- Atomic job claim. Returns a single claimed job row or NULL if none
-- eligible. SECURITY DEFINER: internal worker RPC, no user context.
CREATE OR REPLACE FUNCTION public.automation_claim_next_job(
  _worker_id TEXT,
  _lease_seconds INTEGER DEFAULT 600
)
RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id UUID;
BEGIN
  IF _worker_id IS NULL OR length(_worker_id) < 4 OR length(_worker_id) > 128 THEN
    RAISE EXCEPTION 'invalid worker id';
  END IF;
  IF _lease_seconds IS NULL OR _lease_seconds < 5 OR _lease_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid lease seconds';
  END IF;

  SELECT j.id INTO target_id
  FROM public.automation_jobs j
  WHERE j.status IN ('queued', 'retrying')
    AND j.available_at <= now()
    AND j.scheduled_for <= now()
    AND j.attempt_number < j.max_attempts
    AND NOT EXISTS (
      SELECT 1
      FROM public.automation_job_dependencies d
      JOIN public.automation_jobs pj ON pj.id = d.depends_on_job_id
      WHERE d.job_id = j.id
        AND d.dependency_type IN ('requires_success','requires_completion','runs_after')
        AND CASE d.dependency_type
              WHEN 'requires_success' THEN pj.status <> 'succeeded'
              ELSE pj.status NOT IN ('succeeded','failed','cancelled','skipped','expired')
            END
    )
    AND (
      j.automation_definition_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.automation_definitions ad
        WHERE ad.id = j.automation_definition_id
          AND ad.enabled = TRUE
          AND ad.status = 'active'
          AND ad.deleted_at IS NULL
      )
    )
  ORDER BY
    CASE j.priority
      WHEN 'critical' THEN 0
      WHEN 'high' THEN 10
      WHEN 'normal' THEN 20
      WHEN 'low' THEN 30
      WHEN 'background' THEN 40
      ELSE 50
    END,
    j.available_at,
    j.scheduled_for,
    j.created_at,
    j.id
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF target_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.automation_jobs
     SET status = 'running',
         started_at = COALESCE(started_at, now()),
         attempt_number = attempt_number + 1,
         claimed_by = _worker_id,
         claimed_at = now(),
         lease_expires_at = now() + make_interval(secs => GREATEST(_lease_seconds, timeout_seconds)),
         heartbeat_at = now(),
         error_code = NULL,
         retry_after = NULL,
         updated_at = now()
   WHERE id = target_id
   RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_claim_next_job(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_claim_next_job(TEXT, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.automation_claim_next_job(TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_claim_next_job(TEXT, INTEGER) TO service_role;

-- Stale recovery. Moves expired-lease running jobs back to retrying
-- (or failed if attempts exhausted). Returns rows recovered.
CREATE OR REPLACE FUNCTION public.automation_recover_stale_jobs(
  _limit INTEGER DEFAULT 100
)
RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _limit IS NULL OR _limit < 1 OR _limit > 1000 THEN
    RAISE EXCEPTION 'invalid limit';
  END IF;

  RETURN QUERY
  UPDATE public.automation_jobs j
     SET status = CASE
                    WHEN j.attempt_number >= j.max_attempts THEN 'failed'
                    ELSE 'retrying'
                  END,
         available_at = CASE
                          WHEN j.attempt_number >= j.max_attempts THEN j.available_at
                          ELSE now() + interval '30 seconds'
                        END,
         completed_at = CASE
                          WHEN j.attempt_number >= j.max_attempts THEN now()
                          ELSE j.completed_at
                        END,
         error_code = COALESCE(j.error_code, 'worker_interrupted'),
         claimed_by = NULL,
         claimed_at = NULL,
         lease_expires_at = NULL,
         heartbeat_at = NULL,
         updated_at = now()
   WHERE j.id IN (
     SELECT id FROM public.automation_jobs
     WHERE status = 'running'
       AND lease_expires_at IS NOT NULL
       AND lease_expires_at < now()
     ORDER BY lease_expires_at
     LIMIT _limit
     FOR UPDATE SKIP LOCKED
   )
   RETURNING j.*;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_recover_stale_jobs(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_recover_stale_jobs(INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.automation_recover_stale_jobs(INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_recover_stale_jobs(INTEGER) TO service_role;

-- Atomic cancel for safe states only. Returns the updated row or NULL.
CREATE OR REPLACE FUNCTION public.automation_cancel_job(
  _job_id UUID,
  _organization_id UUID,
  _reason TEXT DEFAULT NULL
)
RETURNS SETOF public.automation_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.automation_jobs
     SET status = 'cancelled',
         completed_at = now(),
         error_code = COALESCE(_reason, error_code),
         updated_at = now()
   WHERE id = _job_id
     AND organization_id = _organization_id
     AND status IN ('queued','scheduled','blocked','retrying')
   RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_cancel_job(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_cancel_job(UUID, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.automation_cancel_job(UUID, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_cancel_job(UUID, UUID, TEXT) TO service_role;

-- Advance scheduler timestamps for a definition. Guarded so an older
-- worker cannot overwrite a newer next_run_at.
CREATE OR REPLACE FUNCTION public.automation_advance_definition(
  _definition_id UUID,
  _last_run_at TIMESTAMPTZ,
  _next_run_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.automation_definitions
     SET last_run_at = GREATEST(COALESCE(last_run_at, _last_run_at), _last_run_at),
         next_run_at = _next_run_at,
         updated_at = now()
   WHERE id = _definition_id
     AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.automation_advance_definition(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.automation_advance_definition(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE ALL ON FUNCTION public.automation_advance_definition(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.automation_advance_definition(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
