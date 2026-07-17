
-- Message lifecycle
ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete';

-- =========================================================
-- sam_invocations
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sam_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.conversation_messages(id) ON DELETE SET NULL,
  intent TEXT NOT NULL,
  workflow_key TEXT,
  surface TEXT NOT NULL DEFAULT 'sam_chat',
  scope JSONB NOT NULL DEFAULT '{}'::jsonb,
  prompt_version TEXT NOT NULL,
  constitution_version TEXT NOT NULL,
  pipeline_version TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT 'single_pass',
  confidence_method TEXT NOT NULL,
  weights_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ok',
  rollup_confidence NUMERIC,
  rollup_confidence_band TEXT,
  citation_count INT NOT NULL DEFAULT 0,
  context_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  truncations JSONB NOT NULL DEFAULT '[]'::jsonb,
  latency_ms INT,
  input_tokens INT,
  output_tokens INT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sam_invocations_org_created ON public.sam_invocations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sam_invocations_conversation ON public.sam_invocations(conversation_id);

GRANT SELECT ON public.sam_invocations TO authenticated;
GRANT ALL ON public.sam_invocations TO service_role;

ALTER TABLE public.sam_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sam_invocations_select_members" ON public.sam_invocations
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- sam_invocation_context_refs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sam_invocation_context_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_id UUID NOT NULL REFERENCES public.sam_invocations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  role TEXT NOT NULL DEFAULT 'input',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sam_ctx_refs_invocation ON public.sam_invocation_context_refs(invocation_id);

GRANT SELECT ON public.sam_invocation_context_refs TO authenticated;
GRANT ALL ON public.sam_invocation_context_refs TO service_role;

ALTER TABLE public.sam_invocation_context_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sam_ctx_refs_select_members" ON public.sam_invocation_context_refs
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- sam_invocation_provider_calls
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sam_invocation_provider_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invocation_id UUID NOT NULL REFERENCES public.sam_invocations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  latency_ms INT,
  status TEXT NOT NULL DEFAULT 'ok',
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sam_provider_calls_invocation ON public.sam_invocation_provider_calls(invocation_id);

GRANT SELECT ON public.sam_invocation_provider_calls TO authenticated;
GRANT ALL ON public.sam_invocation_provider_calls TO service_role;

ALTER TABLE public.sam_invocation_provider_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sam_provider_calls_select_members" ON public.sam_invocation_provider_calls
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- =========================================================
-- sam_settings
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sam_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  response_style TEXT NOT NULL DEFAULT 'balanced',
  challenge_level TEXT NOT NULL DEFAULT 'balanced',
  include_citations BOOLEAN NOT NULL DEFAULT true,
  show_confidence BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT sam_settings_response_style_chk CHECK (response_style IN ('concise','balanced','detailed')),
  CONSTRAINT sam_settings_challenge_level_chk CHECK (challenge_level IN ('supportive','balanced','direct'))
);

GRANT SELECT, INSERT, UPDATE ON public.sam_settings TO authenticated;
GRANT ALL ON public.sam_settings TO service_role;

ALTER TABLE public.sam_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sam_settings_select_members" ON public.sam_settings
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "sam_settings_upsert_admin" ON public.sam_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "sam_settings_update_admin" ON public.sam_settings
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER sam_settings_set_updated_at
  BEFORE UPDATE ON public.sam_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- sam_rate_counters
-- =========================================================
CREATE TABLE IF NOT EXISTS public.sam_rate_counters (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, day)
);

GRANT SELECT ON public.sam_rate_counters TO authenticated;
GRANT ALL ON public.sam_rate_counters TO service_role;

ALTER TABLE public.sam_rate_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sam_rate_counters_select_own" ON public.sam_rate_counters
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));
