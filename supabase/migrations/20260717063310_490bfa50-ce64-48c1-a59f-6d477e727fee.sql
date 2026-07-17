-- ============================================================
-- Phase 3C: SAM Executive Workflow schema
-- ============================================================

-- Enums --------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.sam_workflow_type AS ENUM (
    'daily_briefing',
    'weekly_review',
    'decision_review',
    'commitment_review',
    'priority_planning',
    'risk_review',
    'goal_alignment',
    'venture_health',
    'organization_health'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sam_workflow_status AS ENUM (
    'pending', 'running', 'completed', 'failed', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sam_workflow_trigger AS ENUM (
    'manual', 'scheduled_future', 'system_future'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sam_workflow_finding_type AS ENUM (
    'observation', 'priority', 'risk', 'opportunity', 'blocker',
    'decision_needed', 'commitment_issue', 'goal_issue', 'contradiction',
    'recommendation', 'missing_information'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sam_workflow_severity AS ENUM (
    'informational', 'low', 'medium', 'high', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sam_workflow_feedback_type AS ENUM (
    'useful', 'partially_useful', 'not_useful', 'incorrect', 'missing_context'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1) sam_workflow_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sam_workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_type public.sam_workflow_type NOT NULL,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  initiated_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type public.sam_workflow_trigger NOT NULL DEFAULT 'manual',
  status public.sam_workflow_status NOT NULL DEFAULT 'pending',
  period_start timestamptz,
  period_end timestamptz,
  input_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_snapshot jsonb,
  executive_summary text,
  confidence_score numeric(4,3),
  confidence_band text,
  context_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  citation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommendation_count integer NOT NULL DEFAULT 0,
  risk_count integer NOT NULL DEFAULT 0,
  finding_count integer NOT NULL DEFAULT 0,
  provider text,
  model text,
  prompt_version text NOT NULL,
  constitution_version text NOT NULL,
  pipeline_version text NOT NULL,
  workflow_version text NOT NULL,
  confidence_version text NOT NULL,
  memory_version text NOT NULL,
  graph_version text NOT NULL,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  synthesis_status text NOT NULL DEFAULT 'deterministic_only',
  failure_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failed_at timestamptz,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sam_workflow_runs_org_type
  ON public.sam_workflow_runs (organization_id, workflow_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sam_workflow_runs_venture
  ON public.sam_workflow_runs (venture_id) WHERE venture_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sam_workflow_runs_status
  ON public.sam_workflow_runs (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_sam_workflow_runs_initiator
  ON public.sam_workflow_runs (initiated_by, organization_id, status);

GRANT SELECT, INSERT, UPDATE ON public.sam_workflow_runs TO authenticated;
GRANT ALL ON public.sam_workflow_runs TO service_role;
ALTER TABLE public.sam_workflow_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_runs_select_org_members"
  ON public.sam_workflow_runs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "workflow_runs_insert_members"
  ON public.sam_workflow_runs FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'member')
    AND initiated_by = auth.uid()
  );

CREATE POLICY "workflow_runs_update_owner_or_admin"
  ON public.sam_workflow_runs FOR UPDATE TO authenticated
  USING (
    public.is_org_member(organization_id, auth.uid())
    AND (initiated_by = auth.uid() OR public.has_org_role(organization_id, auth.uid(), 'admin'))
  )
  WITH CHECK (
    public.is_org_member(organization_id, auth.uid())
    AND (initiated_by = auth.uid() OR public.has_org_role(organization_id, auth.uid(), 'admin'))
  );

-- ============================================================
-- 2) sam_workflow_findings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sam_workflow_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_run_id uuid NOT NULL REFERENCES public.sam_workflow_runs(id) ON DELETE CASCADE,
  finding_type public.sam_workflow_finding_type NOT NULL,
  title text NOT NULL,
  summary text,
  severity public.sam_workflow_severity NOT NULL DEFAULT 'informational',
  priority integer NOT NULL DEFAULT 0,
  confidence_score numeric(4,3),
  confidence_band text,
  status text NOT NULL DEFAULT 'open',
  structured_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sam_workflow_findings_run
  ON public.sam_workflow_findings (workflow_run_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_sam_workflow_findings_org_type
  ON public.sam_workflow_findings (organization_id, finding_type);

GRANT SELECT, INSERT, UPDATE ON public.sam_workflow_findings TO authenticated;
GRANT ALL ON public.sam_workflow_findings TO service_role;
ALTER TABLE public.sam_workflow_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_findings_select_org_members"
  ON public.sam_workflow_findings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "workflow_findings_insert_members"
  ON public.sam_workflow_findings FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "workflow_findings_update_admin"
  ON public.sam_workflow_findings FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- ============================================================
-- 3) sam_workflow_citations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sam_workflow_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_run_id uuid NOT NULL REFERENCES public.sam_workflow_runs(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES public.sam_workflow_findings(id) ON DELETE CASCADE,
  citation_type text NOT NULL DEFAULT 'direct',
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  title text NOT NULL,
  href text,
  relevance text,
  lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sam_workflow_citations_run
  ON public.sam_workflow_citations (workflow_run_id);
CREATE INDEX IF NOT EXISTS idx_sam_workflow_citations_finding
  ON public.sam_workflow_citations (finding_id) WHERE finding_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sam_workflow_citations_entity
  ON public.sam_workflow_citations (organization_id, entity_type, entity_id);

GRANT SELECT, INSERT ON public.sam_workflow_citations TO authenticated;
GRANT ALL ON public.sam_workflow_citations TO service_role;
ALTER TABLE public.sam_workflow_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_citations_select_org_members"
  ON public.sam_workflow_citations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "workflow_citations_insert_members"
  ON public.sam_workflow_citations FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

-- ============================================================
-- 4) sam_workflow_feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sam_workflow_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_run_id uuid NOT NULL REFERENCES public.sam_workflow_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback_type public.sam_workflow_feedback_type NOT NULL,
  feedback_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workflow_run_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_sam_workflow_feedback_run
  ON public.sam_workflow_feedback (workflow_run_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_workflow_feedback TO authenticated;
GRANT ALL ON public.sam_workflow_feedback TO service_role;
ALTER TABLE public.sam_workflow_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_feedback_select_org_members"
  ON public.sam_workflow_feedback FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "workflow_feedback_insert_own"
  ON public.sam_workflow_feedback FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id, auth.uid())
  );

CREATE POLICY "workflow_feedback_update_own"
  ON public.sam_workflow_feedback FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "workflow_feedback_delete_own"
  ON public.sam_workflow_feedback FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS set_sam_workflow_runs_updated_at ON public.sam_workflow_runs;
CREATE TRIGGER set_sam_workflow_runs_updated_at
  BEFORE UPDATE ON public.sam_workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_sam_workflow_feedback_updated_at ON public.sam_workflow_feedback;
CREATE TRIGGER set_sam_workflow_feedback_updated_at
  BEFORE UPDATE ON public.sam_workflow_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Workflow-related learning event types (append to existing enum, if defined)
-- Learning events already exist as free-text event_type; nothing schema-level to change.
-- ============================================================