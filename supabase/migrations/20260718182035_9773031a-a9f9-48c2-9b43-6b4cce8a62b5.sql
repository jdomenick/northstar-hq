
CREATE TABLE public.sam_mcp_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected','testing','connected','failed','blocked')),
  server_url TEXT NOT NULL,
  protocol_version TEXT,
  last_tested_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_code TEXT,
  last_error_message TEXT,
  last_operation_id TEXT,
  discovered_tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

GRANT SELECT ON public.sam_mcp_connections TO authenticated;
GRANT ALL ON public.sam_mcp_connections TO service_role;

ALTER TABLE public.sam_mcp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read SAM MCP connection"
  ON public.sam_mcp_connections FOR SELECT
  TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));

CREATE OR REPLACE FUNCTION public.sam_mcp_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sam_mcp_connections_updated
  BEFORE UPDATE ON public.sam_mcp_connections
  FOR EACH ROW EXECUTE FUNCTION public.sam_mcp_touch_updated_at();
