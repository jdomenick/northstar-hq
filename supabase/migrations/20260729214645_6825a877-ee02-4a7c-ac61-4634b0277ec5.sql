ALTER TABLE public.client_workspace_events
  ADD COLUMN IF NOT EXISTS source_key text;

CREATE UNIQUE INDEX IF NOT EXISTS client_workspace_events_source_key_unique
  ON public.client_workspace_events (client_id, source_key)
  WHERE source_key IS NOT NULL;