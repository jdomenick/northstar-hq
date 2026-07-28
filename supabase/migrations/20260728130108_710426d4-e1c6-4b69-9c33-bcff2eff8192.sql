
CREATE TABLE IF NOT EXISTS public.sam_reasoning_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invocation_id UUID NOT NULL REFERENCES public.sam_invocations(id) ON DELETE CASCADE,
  conversation_id UUID,
  message_id UUID,
  strategy TEXT NOT NULL,
  intent TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  constitution_version TEXT,
  pipeline_version TEXT,
  provider_id TEXT,
  model_id TEXT,
  trace JSONB NOT NULL,
  summary JSONB,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  redaction_applied BOOLEAN NOT NULL DEFAULT true,
  retention_days INTEGER NOT NULL DEFAULT 180,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sam_reasoning_traces_org_created_idx
  ON public.sam_reasoning_traces (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sam_reasoning_traces_invocation_idx
  ON public.sam_reasoning_traces (invocation_id);
CREATE INDEX IF NOT EXISTS sam_reasoning_traces_expires_idx
  ON public.sam_reasoning_traces (expires_at);

GRANT SELECT ON public.sam_reasoning_traces TO authenticated;
GRANT ALL ON public.sam_reasoning_traces TO service_role;

ALTER TABLE public.sam_reasoning_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sam_reasoning_traces_admin_read" ON public.sam_reasoning_traces;
CREATE POLICY "sam_reasoning_traces_admin_read"
  ON public.sam_reasoning_traces
  FOR SELECT
  TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.sam_reasoning_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL,
  strategy TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  evaluator_version TEXT NOT NULL,
  provider_id TEXT,
  model_id TEXT,
  context_hash TEXT NOT NULL,
  output_hash TEXT NOT NULL,
  scores JSONB NOT NULL,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sam_reasoning_replays_fixture_idx
  ON public.sam_reasoning_replays (fixture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sam_reasoning_replays_prompt_model_idx
  ON public.sam_reasoning_replays (prompt_version, model_id);

GRANT SELECT ON public.sam_reasoning_replays TO authenticated;
GRANT ALL ON public.sam_reasoning_replays TO service_role;

ALTER TABLE public.sam_reasoning_replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sam_reasoning_replays_admin_read" ON public.sam_reasoning_replays;
CREATE POLICY "sam_reasoning_replays_admin_read"
  ON public.sam_reasoning_replays
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR public.has_org_role(organization_id, auth.uid(), 'admin')
  );
