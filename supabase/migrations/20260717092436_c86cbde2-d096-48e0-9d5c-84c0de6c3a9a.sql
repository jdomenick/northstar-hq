
-- =========================================================================
-- Phase 3D.2c-i  -  Northstar Automation Engine core schema
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. automation_definitions
-- -------------------------------------------------------------------------
CREATE TABLE public.automation_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  integration_connection_id UUID REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  automation_key TEXT NOT NULL,
  automation_family TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  schedule_expression TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  priority TEXT NOT NULL DEFAULT 'normal',
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT automation_definitions_status_chk
    CHECK (status IN ('active','paused','disabled','archived')),
  CONSTRAINT automation_definitions_trigger_chk
    CHECK (trigger_type IN ('manual','scheduled','event','dependency','system','retry','recovery')),
  CONSTRAINT automation_definitions_priority_chk
    CHECK (priority IN ('critical','high','normal','low','background')),
  CONSTRAINT automation_definitions_family_chk
    CHECK (automation_family IN (
      'integration','intelligence','knowledge','memory','sam','social',
      'analytics','financial','document','maintenance','notification','system')),
  CONSTRAINT automation_definitions_failures_chk CHECK (consecutive_failures >= 0),
  CONSTRAINT automation_definitions_org_key_unique
    UNIQUE (organization_id, automation_key)
);
CREATE INDEX idx_autodef_org ON public.automation_definitions(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_autodef_venture ON public.automation_definitions(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_autodef_family ON public.automation_definitions(automation_family) WHERE deleted_at IS NULL;
CREATE INDEX idx_autodef_due ON public.automation_definitions(next_run_at)
  WHERE enabled = true AND status = 'active' AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.automation_definitions TO authenticated;
GRANT ALL ON public.automation_definitions TO service_role;
ALTER TABLE public.automation_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autodef read org members"
  ON public.automation_definitions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) AND deleted_at IS NULL);
CREATE POLICY "autodef insert org admins"
  ON public.automation_definitions FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));
CREATE POLICY "autodef update org admins"
  ON public.automation_definitions FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));
-- No DELETE policy - use soft delete via deleted_at.

CREATE TRIGGER trg_autodef_updated_at BEFORE UPDATE ON public.automation_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 2. automation_jobs
-- -------------------------------------------------------------------------
CREATE TABLE public.automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  automation_definition_id UUID REFERENCES public.automation_definitions(id) ON DELETE SET NULL,
  integration_connection_id UUID REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  integration_source_id UUID REFERENCES public.integration_sources(id) ON DELETE SET NULL,
  parent_job_id UUID REFERENCES public.automation_jobs(id) ON DELETE SET NULL,
  root_job_id UUID REFERENCES public.automation_jobs(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL,
  job_family TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  priority TEXT NOT NULL DEFAULT 'normal',
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempt_number INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  timeout_seconds INTEGER NOT NULL DEFAULT 300,
  idempotency_key TEXT NOT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  retry_after TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  handler_version TEXT NOT NULL DEFAULT 'v0',
  policy_version TEXT NOT NULL DEFAULT 'v0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT autojob_status_chk CHECK (status IN (
    'queued','scheduled','blocked','running','retrying',
    'succeeded','failed','cancelled','skipped','expired')),
  CONSTRAINT autojob_priority_chk
    CHECK (priority IN ('critical','high','normal','low','background')),
  CONSTRAINT autojob_trigger_chk
    CHECK (trigger_type IN ('manual','scheduled','event','dependency','system','retry','recovery')),
  CONSTRAINT autojob_actor_chk
    CHECK (actor_type IN ('user','system','scheduler','worker','sam','integration')),
  CONSTRAINT autojob_family_chk CHECK (job_family IN (
    'integration','intelligence','knowledge','memory','sam','social',
    'analytics','financial','document','maintenance','notification','system')),
  CONSTRAINT autojob_attempt_chk CHECK (attempt_number >= 0),
  CONSTRAINT autojob_max_attempts_chk CHECK (max_attempts >= 1),
  CONSTRAINT autojob_timeout_chk CHECK (timeout_seconds > 0 AND timeout_seconds <= 86400),
  CONSTRAINT autojob_no_self_parent CHECK (parent_job_id IS NULL OR parent_job_id <> id),
  CONSTRAINT autojob_no_self_root CHECK (root_job_id IS NULL OR root_job_id <> id)
);

CREATE INDEX idx_autojob_org ON public.automation_jobs(organization_id);
CREATE INDEX idx_autojob_venture ON public.automation_jobs(venture_id);
CREATE INDEX idx_autojob_status ON public.automation_jobs(status);
CREATE INDEX idx_autojob_ready ON public.automation_jobs(available_at, priority)
  WHERE status IN ('queued','retrying');
CREATE INDEX idx_autojob_running ON public.automation_jobs(started_at)
  WHERE status = 'running';
CREATE INDEX idx_autojob_definition ON public.automation_jobs(automation_definition_id);
CREATE INDEX idx_autojob_parent ON public.automation_jobs(parent_job_id);
CREATE INDEX idx_autojob_root ON public.automation_jobs(root_job_id);
CREATE INDEX idx_autojob_type ON public.automation_jobs(job_type);

-- Partial unique index: only one ACTIVE job per (org, job_type, idempotency_key).
CREATE UNIQUE INDEX autojob_active_idempotency_key
  ON public.automation_jobs(organization_id, job_type, idempotency_key)
  WHERE status IN ('queued','scheduled','blocked','running','retrying');

GRANT SELECT ON public.automation_jobs TO authenticated;
GRANT ALL ON public.automation_jobs TO service_role;
ALTER TABLE public.automation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autojob read org members"
  ON public.automation_jobs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
-- No INSERT/UPDATE/DELETE policies for authenticated - server-only via service_role.

CREATE TRIGGER trg_autojob_updated_at BEFORE UPDATE ON public.automation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------------------------
-- 3. automation_job_attempts
-- -------------------------------------------------------------------------
CREATE TABLE public.automation_job_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  worker_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_code TEXT,
  provider TEXT,
  external_reference TEXT,
  input_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT autoattempt_status_chk CHECK (status IN (
    'running','succeeded','failed','interrupted','timed_out','cancelled')),
  CONSTRAINT autoattempt_attempt_chk CHECK (attempt_number >= 1),
  CONSTRAINT autoattempt_duration_chk CHECK (duration_ms IS NULL OR duration_ms >= 0),
  CONSTRAINT autoattempt_unique_per_job UNIQUE (job_id, attempt_number)
);
CREATE INDEX idx_autoattempt_org ON public.automation_job_attempts(organization_id);
CREATE INDEX idx_autoattempt_job ON public.automation_job_attempts(job_id);
CREATE INDEX idx_autoattempt_status ON public.automation_job_attempts(status);

GRANT SELECT ON public.automation_job_attempts TO authenticated;
GRANT ALL ON public.automation_job_attempts TO service_role;
ALTER TABLE public.automation_job_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autoattempt read org members"
  ON public.automation_job_attempts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- -------------------------------------------------------------------------
-- 4. automation_job_events
-- -------------------------------------------------------------------------
CREATE TABLE public.automation_job_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_key TEXT,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT autoevent_type_chk CHECK (event_type IN (
    'job_created','job_scheduled','job_queued','job_blocked','job_started',
    'attempt_started','attempt_succeeded','attempt_failed','retry_scheduled',
    'job_succeeded','job_failed','job_cancelled','job_expired',
    'dependency_added','dependency_satisfied','dependency_failed',
    'signal_emitted','audit_written')),
  CONSTRAINT autoevent_actor_chk CHECK (actor_type IN (
    'user','system','scheduler','worker','sam','integration')),
  CONSTRAINT autoevent_unique_key UNIQUE (job_id, event_type, event_key)
);
CREATE INDEX idx_autoevent_org ON public.automation_job_events(organization_id);
CREATE INDEX idx_autoevent_job ON public.automation_job_events(job_id);
CREATE INDEX idx_autoevent_type ON public.automation_job_events(event_type);
CREATE INDEX idx_autoevent_created ON public.automation_job_events(created_at DESC);

GRANT SELECT ON public.automation_job_events TO authenticated;
GRANT ALL ON public.automation_job_events TO service_role;
ALTER TABLE public.automation_job_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autoevent read org members"
  ON public.automation_job_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- Immutable-ish: block UPDATE / DELETE from authenticated by omission of policies.

-- -------------------------------------------------------------------------
-- 5. automation_job_dependencies
-- -------------------------------------------------------------------------
CREATE TABLE public.automation_job_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
  depends_on_job_id UUID NOT NULL REFERENCES public.automation_jobs(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'requires_success',
  required_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT autodep_type_chk CHECK (dependency_type IN (
    'requires_success','requires_completion','runs_after','optional')),
  CONSTRAINT autodep_no_self CHECK (job_id <> depends_on_job_id),
  CONSTRAINT autodep_unique_pair UNIQUE (job_id, depends_on_job_id)
);
CREATE INDEX idx_autodep_org ON public.automation_job_dependencies(organization_id);
CREATE INDEX idx_autodep_job ON public.automation_job_dependencies(job_id);
CREATE INDEX idx_autodep_depends_on ON public.automation_job_dependencies(depends_on_job_id);

GRANT SELECT ON public.automation_job_dependencies TO authenticated;
GRANT ALL ON public.automation_job_dependencies TO service_role;
ALTER TABLE public.automation_job_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autodep read org members"
  ON public.automation_job_dependencies FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- -------------------------------------------------------------------------
-- 6. automation_health_snapshots
-- -------------------------------------------------------------------------
CREATE TABLE public.automation_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  automation_definition_id UUID REFERENCES public.automation_definitions(id) ON DELETE CASCADE,
  health_score INTEGER NOT NULL,
  health_band TEXT NOT NULL,
  signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  version TEXT NOT NULL DEFAULT 'v0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT autohealth_score_chk CHECK (health_score BETWEEN 0 AND 100),
  CONSTRAINT autohealth_band_chk CHECK (health_band IN (
    'healthy','watch','degraded','critical','unknown'))
);
CREATE INDEX idx_autohealth_org ON public.automation_health_snapshots(organization_id);
CREATE INDEX idx_autohealth_definition ON public.automation_health_snapshots(automation_definition_id);
CREATE INDEX idx_autohealth_calculated ON public.automation_health_snapshots(calculated_at DESC);

GRANT SELECT ON public.automation_health_snapshots TO authenticated;
GRANT ALL ON public.automation_health_snapshots TO service_role;
ALTER TABLE public.automation_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autohealth read org members"
  ON public.automation_health_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- -------------------------------------------------------------------------
-- 7. Cross-organization integrity triggers
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_automation_job_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  IF NEW.venture_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation job venture must belong to the same organization';
    END IF;
  END IF;
  IF NEW.asset_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.assets WHERE id = NEW.asset_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation job asset must belong to the same organization';
    END IF;
  END IF;
  IF NEW.automation_definition_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.automation_definitions WHERE id = NEW.automation_definition_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation job definition must belong to the same organization';
    END IF;
  END IF;
  IF NEW.integration_connection_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.integration_connections WHERE id = NEW.integration_connection_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation job connection must belong to the same organization';
    END IF;
  END IF;
  IF NEW.integration_source_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.integration_sources WHERE id = NEW.integration_source_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation job source must belong to the same organization';
    END IF;
  END IF;
  IF NEW.parent_job_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.automation_jobs WHERE id = NEW.parent_job_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation parent job must belong to the same organization';
    END IF;
  END IF;
  IF NEW.root_job_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.automation_jobs WHERE id = NEW.root_job_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation root job must belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_autojob_scope
  BEFORE INSERT OR UPDATE ON public.automation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_job_scope();

CREATE OR REPLACE FUNCTION public.validate_automation_child_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE parent_org UUID; dep_org UUID;
BEGIN
  IF TG_TABLE_NAME = 'automation_job_attempts' OR TG_TABLE_NAME = 'automation_job_events' THEN
    SELECT organization_id INTO parent_org FROM public.automation_jobs WHERE id = NEW.job_id;
    IF parent_org IS NULL OR parent_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation child record must match parent job organization';
    END IF;
  ELSIF TG_TABLE_NAME = 'automation_job_dependencies' THEN
    SELECT organization_id INTO parent_org FROM public.automation_jobs WHERE id = NEW.job_id;
    SELECT organization_id INTO dep_org FROM public.automation_jobs WHERE id = NEW.depends_on_job_id;
    IF parent_org IS NULL OR dep_org IS NULL
       OR parent_org <> NEW.organization_id OR dep_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation dependency must be within a single organization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_autoattempt_scope
  BEFORE INSERT OR UPDATE ON public.automation_job_attempts
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_child_scope();
CREATE TRIGGER trg_autoevent_scope
  BEFORE INSERT OR UPDATE ON public.automation_job_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_child_scope();
CREATE TRIGGER trg_autodep_scope
  BEFORE INSERT OR UPDATE ON public.automation_job_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_child_scope();

CREATE OR REPLACE FUNCTION public.validate_automation_definition_scope()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  IF NEW.venture_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation definition venture must belong to the same organization';
    END IF;
  END IF;
  IF NEW.asset_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.assets WHERE id = NEW.asset_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation definition asset must belong to the same organization';
    END IF;
  END IF;
  IF NEW.integration_connection_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.integration_connections WHERE id = NEW.integration_connection_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'automation definition connection must belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_autodef_scope
  BEFORE INSERT OR UPDATE ON public.automation_definitions
  FOR EACH ROW EXECUTE FUNCTION public.validate_automation_definition_scope();
