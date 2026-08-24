ALTER TABLE public.revenue_clients
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archive_reason text;

CREATE INDEX IF NOT EXISTS revenue_clients_active_idx
  ON public.revenue_clients (organization_id)
  WHERE archived_at IS NULL;