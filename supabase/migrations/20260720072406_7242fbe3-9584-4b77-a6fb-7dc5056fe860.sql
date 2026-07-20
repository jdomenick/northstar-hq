
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'prospect';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'researched';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'contacted';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'engaged';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'discovery_scheduled';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'discovery_held';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'project_kickoff';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'in_delivery';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'launched';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'case_study';
ALTER TYPE public.pipeline_stage ADD VALUE IF NOT EXISTS 'referral';

ALTER TABLE public.revenue_pipeline
  ADD COLUMN IF NOT EXISTS owner_operator public.operator_kind NOT NULL DEFAULT 'hunter',
  ADD COLUMN IF NOT EXISTS close_reason text,
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.revenue_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.operator_tasks
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.revenue_pipeline(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS deal_stage public.pipeline_stage,
  ADD COLUMN IF NOT EXISTS playbook_step_id uuid,
  ADD COLUMN IF NOT EXISTS blocks_stage_advance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'not_required';

CREATE INDEX IF NOT EXISTS operator_tasks_deal_idx ON public.operator_tasks(deal_id) WHERE deal_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.revenue_stage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.revenue_pipeline(id) ON DELETE CASCADE,
  from_stage public.pipeline_stage,
  to_stage public.pipeline_stage NOT NULL,
  operator_kind public.operator_kind,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rse_deal_idx ON public.revenue_stage_events(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rse_org_idx ON public.revenue_stage_events(organization_id, created_at DESC);
GRANT SELECT, INSERT ON public.revenue_stage_events TO authenticated;
GRANT ALL ON public.revenue_stage_events TO service_role;
ALTER TABLE public.revenue_stage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rse_read" ON public.revenue_stage_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "rse_insert" ON public.revenue_stage_events FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.revenue_playbook_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  stage public.pipeline_stage NOT NULL,
  operator_kind public.operator_kind NOT NULL,
  title text NOT NULL,
  description text,
  default_due_offset_hours integer NOT NULL DEFAULT 48,
  requires_approval boolean NOT NULL DEFAULT false,
  blocks_stage_advance boolean NOT NULL DEFAULT false,
  automation_key text NOT NULL DEFAULT 'manual',
  order_index integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rps_stage_idx ON public.revenue_playbook_steps(stage, operator_kind, order_index);
GRANT SELECT ON public.revenue_playbook_steps TO authenticated;
GRANT ALL ON public.revenue_playbook_steps TO service_role;
ALTER TABLE public.revenue_playbook_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rps_read" ON public.revenue_playbook_steps FOR SELECT TO authenticated
  USING (organization_id IS NULL OR public.is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_rps_updated BEFORE UPDATE ON public.revenue_playbook_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.revenue_discovery_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.revenue_pipeline(id) ON DELETE CASCADE,
  pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_range text,
  decision_makers jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  research_summary text,
  prepared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rdb_deal_idx ON public.revenue_discovery_briefs(deal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_discovery_briefs TO authenticated;
GRANT ALL ON public.revenue_discovery_briefs TO service_role;
ALTER TABLE public.revenue_discovery_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rdb_read" ON public.revenue_discovery_briefs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "rdb_write" ON public.revenue_discovery_briefs FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE TRIGGER trg_rdb_updated BEFORE UPDATE ON public.revenue_discovery_briefs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.revenue_launch_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.revenue_pipeline(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  summary text,
  deliverables jsonb NOT NULL DEFAULT '[]'::jsonb,
  handover_url text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rld_deal_idx ON public.revenue_launch_docs(deal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_launch_docs TO authenticated;
GRANT ALL ON public.revenue_launch_docs TO service_role;
ALTER TABLE public.revenue_launch_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rld_read" ON public.revenue_launch_docs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "rld_write" ON public.revenue_launch_docs FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE TRIGGER trg_rld_updated BEFORE UPDATE ON public.revenue_launch_docs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.revenue_case_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deal_id uuid NOT NULL REFERENCES public.revenue_pipeline(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.revenue_clients(id) ON DELETE SET NULL,
  headline text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  quote text,
  status text NOT NULL DEFAULT 'requested',
  published_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rcs_deal_idx ON public.revenue_case_studies(deal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_case_studies TO authenticated;
GRANT ALL ON public.revenue_case_studies TO service_role;
ALTER TABLE public.revenue_case_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rcs_read" ON public.revenue_case_studies FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "rcs_write" ON public.revenue_case_studies FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE TRIGGER trg_rcs_updated BEFORE UPDATE ON public.revenue_case_studies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
