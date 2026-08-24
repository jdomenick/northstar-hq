CREATE TABLE public.client_module_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  module text NOT NULL CHECK (module IN ('cam','ccm','crm','sam')),
  external_id text NOT NULL CHECK (length(btrim(external_id)) > 0 AND length(external_id) <= 200),
  external_name text CHECK (external_name IS NULL OR length(external_name) <= 200),
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, module)
);

CREATE INDEX client_module_connections_org_idx ON public.client_module_connections (organization_id, module);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_module_connections TO authenticated;
GRANT ALL ON public.client_module_connections TO service_role;

ALTER TABLE public.client_module_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view module connections"
  ON public.client_module_connections FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins can create module connections"
  ON public.client_module_connections FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));

CREATE POLICY "Admins can update module connections"
  ON public.client_module_connections FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));

CREATE POLICY "Admins can delete module connections"
  ON public.client_module_connections FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));

CREATE TRIGGER client_module_connections_set_updated_at
  BEFORE UPDATE ON public.client_module_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_client_module_connection_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.revenue_clients c
    WHERE c.id = NEW.client_id AND c.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'client does not belong to organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER client_module_connections_scope
  BEFORE INSERT OR UPDATE ON public.client_module_connections
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_module_connection_scope();