-- Phase 3D.2a: website discovery + automation mode
ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS automation_mode text NOT NULL DEFAULT 'suggest',
  ADD COLUMN IF NOT EXISTS homepage_url text,
  ADD COLUMN IF NOT EXISTS discovery_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS discovery_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS discovery_error_code text,
  ADD COLUMN IF NOT EXISTS discovery_last_run_id uuid REFERENCES public.integration_sync_runs(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_integration_connections_automation_mode') THEN
    ALTER TABLE public.integration_connections
      ADD CONSTRAINT chk_integration_connections_automation_mode
      CHECK (automation_mode IN ('suggest','auto_accept','off'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_integration_connections_discovery_status') THEN
    ALTER TABLE public.integration_connections
      ADD CONSTRAINT chk_integration_connections_discovery_status
      CHECK (discovery_status IN ('pending','running','completed','failed','cancelled'));
  END IF;
END $$;

ALTER TABLE public.integration_sources
  ADD COLUMN IF NOT EXISTS relevance_score numeric(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS page_type text,
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS discovery_run_id uuid REFERENCES public.integration_sync_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS http_status integer;

CREATE INDEX IF NOT EXISTS idx_integration_sources_connection_score
  ON public.integration_sources(connection_id, relevance_score DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_integration_sources_connection_url
  ON public.integration_sources(connection_id, source_url)
  WHERE connection_id IS NOT NULL AND source_url IS NOT NULL AND deleted_at IS NULL;