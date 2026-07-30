CREATE TABLE public.client_executive_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  version integer NOT NULL,
  summary text NOT NULL DEFAULT '',
  business_notes text NOT NULL DEFAULT '',
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, version)
);
CREATE INDEX client_executive_reports_client_idx ON public.client_executive_reports (client_id, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_executive_reports TO authenticated;
GRANT ALL ON public.client_executive_reports TO service_role;

ALTER TABLE public.client_executive_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY cer_operator_all ON public.client_executive_reports
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY cer_client_select ON public.client_executive_reports
  FOR SELECT TO authenticated
  USING (
    client_id = public.client_account_client_id(auth.uid())
    AND organization_id = public.client_account_org_id(auth.uid())
  );

CREATE TABLE public.client_outcome_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  label text NOT NULL,
  value_numeric numeric NOT NULL,
  value_unit text NOT NULL DEFAULT 'count',
  period_start date,
  period_end date,
  source_label text NOT NULL DEFAULT '',
  client_visible boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_outcome_metrics_unit_check CHECK (value_unit IN ('count','currency','percent','minutes')),
  UNIQUE (client_id, metric_key)
);
CREATE INDEX client_outcome_metrics_client_idx ON public.client_outcome_metrics (client_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_outcome_metrics TO authenticated;
GRANT ALL ON public.client_outcome_metrics TO service_role;

ALTER TABLE public.client_outcome_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY com_operator_all ON public.client_outcome_metrics
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY com_client_select ON public.client_outcome_metrics
  FOR SELECT TO authenticated
  USING (
    client_visible
    AND client_id = public.client_account_client_id(auth.uid())
    AND organization_id = public.client_account_org_id(auth.uid())
  );

CREATE TRIGGER client_outcome_metrics_updated_at
  BEFORE UPDATE ON public.client_outcome_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_client_report_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.revenue_clients rc
    WHERE rc.id = NEW.client_id AND rc.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'client does not belong to organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER client_executive_reports_scope
  BEFORE INSERT OR UPDATE ON public.client_executive_reports
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_report_scope();

CREATE TRIGGER client_outcome_metrics_scope
  BEFORE INSERT OR UPDATE ON public.client_outcome_metrics
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_report_scope();