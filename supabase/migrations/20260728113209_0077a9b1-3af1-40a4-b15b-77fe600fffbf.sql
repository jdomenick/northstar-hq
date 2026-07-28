
-- ============================================================
-- integration_webhooks: outbound webhooks NorthStar sends
-- ============================================================
CREATE TABLE public.integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  target_url text NOT NULL,
  secret_ciphertext text,
  event_types text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_delivery_at timestamptz,
  last_status_code integer,
  last_error text,
  last_error_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_webhooks TO authenticated;
GRANT ALL ON public.integration_webhooks TO service_role;

ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks_select_members" ON public.integration_webhooks
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "webhooks_insert_members" ON public.integration_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "webhooks_update_members" ON public.integration_webhooks
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "webhooks_delete_admins" ON public.integration_webhooks
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_integration_webhooks_updated
  BEFORE UPDATE ON public.integration_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_integration_webhooks_org ON public.integration_webhooks(organization_id);
CREATE INDEX idx_integration_webhooks_enabled ON public.integration_webhooks(organization_id, enabled);

-- ============================================================
-- integration_webhook_deliveries: audit log
-- ============================================================
CREATE TABLE public.integration_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES public.integration_webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  request_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status_code integer,
  response_summary jsonb,
  error text,
  attempt integer NOT NULL DEFAULT 1,
  delivered_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.integration_webhook_deliveries TO authenticated;
GRANT ALL ON public.integration_webhook_deliveries TO service_role;

ALTER TABLE public.integration_webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_select_members" ON public.integration_webhook_deliveries
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "webhook_deliveries_insert_members" ON public.integration_webhook_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE INDEX idx_webhook_deliveries_webhook ON public.integration_webhook_deliveries(webhook_id, delivered_at DESC);
CREATE INDEX idx_webhook_deliveries_org ON public.integration_webhook_deliveries(organization_id, delivered_at DESC);

-- ============================================================
-- integration_rest_endpoints: reusable Custom REST endpoints
-- ============================================================
CREATE TABLE public.integration_rest_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  base_url text NOT NULL,
  method text NOT NULL DEFAULT 'GET' CHECK (method IN ('GET','POST','PUT','PATCH','DELETE','HEAD')),
  auth_type text NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none','api_key_header','bearer','basic','query_param')),
  auth_config_ciphertext text,
  default_headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  default_query_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  timeout_ms integer NOT NULL DEFAULT 15000 CHECK (timeout_ms BETWEEN 1000 AND 60000),
  enabled boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  last_status_code integer,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_rest_endpoints TO authenticated;
GRANT ALL ON public.integration_rest_endpoints TO service_role;

ALTER TABLE public.integration_rest_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rest_endpoints_select_members" ON public.integration_rest_endpoints
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "rest_endpoints_insert_members" ON public.integration_rest_endpoints
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "rest_endpoints_update_members" ON public.integration_rest_endpoints
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "rest_endpoints_delete_admins" ON public.integration_rest_endpoints
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_integration_rest_endpoints_updated
  BEFORE UPDATE ON public.integration_rest_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_rest_endpoints_org ON public.integration_rest_endpoints(organization_id);
CREATE INDEX idx_rest_endpoints_enabled ON public.integration_rest_endpoints(organization_id, enabled);
