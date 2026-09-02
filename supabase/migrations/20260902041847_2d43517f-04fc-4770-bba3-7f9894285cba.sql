CREATE TYPE public.module_provisioning_status AS ENUM (
  'not_configured','pending','active','degraded','failed','disabled'
);

ALTER TABLE public.client_module_connections
  ADD COLUMN provisioning_status public.module_provisioning_status NOT NULL DEFAULT 'pending',
  ADD COLUMN endpoint_url text CHECK (endpoint_url IS NULL OR (length(endpoint_url) <= 500 AND endpoint_url ~ '^https?://')),
  ADD COLUMN last_health_check_at timestamptz,
  ADD COLUMN last_success_at timestamptz,
  ADD COLUMN last_error text CHECK (last_error IS NULL OR length(last_error) <= 2000),
  ADD COLUMN notes text CHECK (notes IS NULL OR length(notes) <= 2000);

UPDATE public.client_module_connections
  SET provisioning_status = CASE WHEN active THEN 'active'::public.module_provisioning_status
                                 ELSE 'disabled'::public.module_provisioning_status END;

CREATE INDEX client_module_connections_status_idx
  ON public.client_module_connections (organization_id, provisioning_status);