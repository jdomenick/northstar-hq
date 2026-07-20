
-- Enums
CREATE TYPE public.operator_kind AS ENUM ('hunter','builder');
CREATE TYPE public.operator_task_status AS ENUM ('queued','in_progress','needs_approval','blocked','done','cancelled');
CREATE TYPE public.operator_task_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.pipeline_stage AS ENUM ('lead','qualified','proposal','negotiation','won','lost');
CREATE TYPE public.proposal_status AS ENUM ('draft','sent','accepted','declined','expired');
CREATE TYPE public.client_status AS ENUM ('active','paused','churned','onboarding');
CREATE TYPE public.cashflow_direction AS ENUM ('inflow','outflow');
CREATE TYPE public.referral_status AS ENUM ('new','introduced','in_progress','won','lost');

-- ===== Revenue clients
CREATE TABLE public.revenue_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status public.client_status NOT NULL DEFAULT 'active',
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  started_at DATE,
  churned_at DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX revenue_clients_org_idx ON public.revenue_clients(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_clients TO authenticated;
GRANT ALL ON public.revenue_clients TO service_role;
ALTER TABLE public.revenue_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revclients_read" ON public.revenue_clients FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "revclients_write" ON public.revenue_clients FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));
CREATE TRIGGER trg_revclients_updated BEFORE UPDATE ON public.revenue_clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Pipeline
CREATE TABLE public.revenue_pipeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contact TEXT,
  stage public.pipeline_stage NOT NULL DEFAULT 'lead',
  value_cents INTEGER NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 25 CHECK (probability BETWEEN 0 AND 100),
  expected_close DATE,
  next_action TEXT,
  next_action_at DATE,
  source TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX revenue_pipeline_org_idx ON public.revenue_pipeline(organization_id, stage);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_pipeline TO authenticated;
GRANT ALL ON public.revenue_pipeline TO service_role;
ALTER TABLE public.revenue_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revpipe_read" ON public.revenue_pipeline FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "revpipe_write" ON public.revenue_pipeline FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));
CREATE TRIGGER trg_revpipe_updated BEFORE UPDATE ON public.revenue_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Proposals
CREATE TABLE public.revenue_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pipeline_id UUID REFERENCES public.revenue_pipeline(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  status public.proposal_status NOT NULL DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX revenue_proposals_org_idx ON public.revenue_proposals(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_proposals TO authenticated;
GRANT ALL ON public.revenue_proposals TO service_role;
ALTER TABLE public.revenue_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revprop_read" ON public.revenue_proposals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "revprop_write" ON public.revenue_proposals FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));
CREATE TRIGGER trg_revprop_updated BEFORE UPDATE ON public.revenue_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Cashflow entries
CREATE TABLE public.revenue_cashflow_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  direction public.cashflow_direction NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX revenue_cashflow_org_date_idx ON public.revenue_cashflow_entries(organization_id, occurred_on DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_cashflow_entries TO authenticated;
GRANT ALL ON public.revenue_cashflow_entries TO service_role;
ALTER TABLE public.revenue_cashflow_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revcash_read" ON public.revenue_cashflow_entries FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "revcash_write" ON public.revenue_cashflow_entries FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));
CREATE TRIGGER trg_revcash_updated BEFORE UPDATE ON public.revenue_cashflow_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== MRR snapshots
CREATE TABLE public.revenue_mrr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  mrr_cents INTEGER NOT NULL DEFAULT 0,
  active_clients INTEGER NOT NULL DEFAULT 0,
  new_mrr_cents INTEGER NOT NULL DEFAULT 0,
  churned_mrr_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, snapshot_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_mrr_snapshots TO authenticated;
GRANT ALL ON public.revenue_mrr_snapshots TO service_role;
ALTER TABLE public.revenue_mrr_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revmrr_read" ON public.revenue_mrr_snapshots FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "revmrr_write" ON public.revenue_mrr_snapshots FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

-- ===== Referrals
CREATE TABLE public.revenue_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referrer_name TEXT NOT NULL,
  referred_name TEXT NOT NULL,
  status public.referral_status NOT NULL DEFAULT 'new',
  value_cents INTEGER,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX revenue_referrals_org_idx ON public.revenue_referrals(organization_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_referrals TO authenticated;
GRANT ALL ON public.revenue_referrals TO service_role;
ALTER TABLE public.revenue_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revref_read" ON public.revenue_referrals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "revref_write" ON public.revenue_referrals FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));
CREATE TRIGGER trg_revref_updated BEFORE UPDATE ON public.revenue_referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Operator state (one row per org+kind)
CREATE TABLE public.operator_state (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.operator_kind NOT NULL,
  paused BOOLEAN NOT NULL DEFAULT true,
  auto_enabled BOOLEAN NOT NULL DEFAULT false,
  paused_reason TEXT,
  paused_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, kind)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_state TO authenticated;
GRANT ALL ON public.operator_state TO service_role;
ALTER TABLE public.operator_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opstate_read" ON public.operator_state FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "opstate_write" ON public.operator_state FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER trg_opstate_updated BEFORE UPDATE ON public.operator_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Operator tasks
CREATE TABLE public.operator_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.operator_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority public.operator_task_priority NOT NULL DEFAULT 'normal',
  status public.operator_task_status NOT NULL DEFAULT 'queued',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX operator_tasks_org_kind_status_idx ON public.operator_tasks(organization_id, kind, status, priority, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_tasks TO authenticated;
GRANT ALL ON public.operator_tasks TO service_role;
ALTER TABLE public.operator_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "optasks_read" ON public.operator_tasks FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "optasks_write" ON public.operator_tasks FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE TRIGGER trg_optasks_updated BEFORE UPDATE ON public.operator_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Operator audit (append-only)
CREATE TABLE public.operator_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind public.operator_kind NOT NULL,
  task_id UUID REFERENCES public.operator_tasks(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX operator_audit_org_kind_idx ON public.operator_audit(organization_id, kind, created_at DESC);
GRANT SELECT, INSERT ON public.operator_audit TO authenticated;
GRANT ALL ON public.operator_audit TO service_role;
ALTER TABLE public.operator_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opaudit_read" ON public.operator_audit FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "opaudit_insert" ON public.operator_audit FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));
