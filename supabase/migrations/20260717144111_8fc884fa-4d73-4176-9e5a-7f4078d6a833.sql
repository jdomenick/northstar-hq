-- ============================================================
-- Stage 2: Content Operations Engine - additive schema
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend venture_brand_profiles
-- ------------------------------------------------------------
ALTER TABLE public.venture_brand_profiles
  ADD COLUMN IF NOT EXISTS content_pillars jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audience_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promotion_ratio_limit numeric(4,3),
  ADD COLUMN IF NOT EXISTS posting_cadence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_posting_windows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faith_language_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS crisis_language_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sensitive_topic_guidance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS competitor_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS visual_identity jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.venture_brand_profiles
  DROP CONSTRAINT IF EXISTS vbp_promotion_ratio_check;
ALTER TABLE public.venture_brand_profiles
  ADD CONSTRAINT vbp_promotion_ratio_check
    CHECK (promotion_ratio_limit IS NULL OR (promotion_ratio_limit >= 0 AND promotion_ratio_limit <= 1));

-- ------------------------------------------------------------
-- 2. Extend social_campaigns (strategy period record)
-- ------------------------------------------------------------
ALTER TABLE public.social_campaigns
  ADD COLUMN IF NOT EXISTS strategy_period_start date,
  ADD COLUMN IF NOT EXISTS strategy_period_end date,
  ADD COLUMN IF NOT EXISTS platform_mix jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS promotion_ratio_limit numeric(4,3),
  ADD COLUMN IF NOT EXISTS strategic_rationale text,
  ADD COLUMN IF NOT EXISTS sam_recommendation jsonb,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.social_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.social_campaigns
  DROP CONSTRAINT IF EXISTS sc_strategy_period_check;
ALTER TABLE public.social_campaigns
  ADD CONSTRAINT sc_strategy_period_check
    CHECK (strategy_period_start IS NULL OR strategy_period_end IS NULL OR strategy_period_end >= strategy_period_start);

ALTER TABLE public.social_campaigns
  DROP CONSTRAINT IF EXISTS sc_promotion_ratio_check;
ALTER TABLE public.social_campaigns
  ADD CONSTRAINT sc_promotion_ratio_check
    CHECK (promotion_ratio_limit IS NULL OR (promotion_ratio_limit >= 0 AND promotion_ratio_limit <= 1));

-- ------------------------------------------------------------
-- 3. Extend social_content_items (variants, creative fields, learning refs)
-- ------------------------------------------------------------
ALTER TABLE public.social_content_items
  ADD COLUMN IF NOT EXISTS parent_content_item_id uuid REFERENCES public.social_content_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hook text,
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS image_prompt text,
  ADD COLUMN IF NOT EXISTS newsletter_subject text,
  ADD COLUMN IF NOT EXISTS newsletter_preview text,
  ADD COLUMN IF NOT EXISTS learning_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS sci_parent_idx
  ON public.social_content_items (parent_content_item_id)
  WHERE parent_content_item_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Extend social_publication_attempts (verification state)
-- ------------------------------------------------------------
ALTER TABLE public.social_publication_attempts
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS content_fingerprint text;

ALTER TABLE public.social_publication_attempts
  DROP CONSTRAINT IF EXISTS spa_verification_status_check;
ALTER TABLE public.social_publication_attempts
  ADD CONSTRAINT spa_verification_status_check
    CHECK (verification_status IN ('pending','verified','partial','failed','unknown'));

-- ============================================================
-- 5. New tables
-- ============================================================

-- ------------------------------------------------------------
-- 5.1 content_ops_autonomy (one row per venture)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_ops_autonomy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'approval_required'
    CHECK (mode IN ('draft_only','approval_required','batch_approval','guarded_autopilot','full_autopilot')),
  platform_pauses jsonb NOT NULL DEFAULT '{}'::jsonb,
  campaign_pauses jsonb NOT NULL DEFAULT '{}'::jsonb,
  emergency_pause boolean NOT NULL DEFAULT false,
  emergency_pause_reason text,
  policy_version text NOT NULL DEFAULT 'v1',
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venture_id)
);

GRANT SELECT, INSERT, UPDATE ON public.content_ops_autonomy TO authenticated;
GRANT ALL ON public.content_ops_autonomy TO service_role;

ALTER TABLE public.content_ops_autonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY coa_select ON public.content_ops_autonomy
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY coa_insert ON public.content_ops_autonomy
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'::org_role));

CREATE POLICY coa_update ON public.content_ops_autonomy
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'::org_role))
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'executive'::org_role)
    AND (emergency_pause = false OR public.has_org_role(organization_id, auth.uid(), 'owner'::org_role))
  );

-- Scope validation
CREATE OR REPLACE FUNCTION public.validate_coa_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ref_org uuid;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'content_ops_autonomy: venture must belong to organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coa_scope
  BEFORE INSERT OR UPDATE ON public.content_ops_autonomy
  FOR EACH ROW EXECUTE FUNCTION public.validate_coa_scope();

CREATE TRIGGER trg_coa_updated_at
  BEFORE UPDATE ON public.content_ops_autonomy
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- 5.2 content_ops_autonomy_history (append only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_ops_autonomy_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  autonomy_id uuid NOT NULL REFERENCES public.content_ops_autonomy(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  snapshot jsonb NOT NULL,
  change_type text NOT NULL CHECK (change_type IN ('created','updated','emergency_pause','emergency_resume')),
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_ops_autonomy_history TO authenticated;
GRANT ALL ON public.content_ops_autonomy_history TO service_role;

ALTER TABLE public.content_ops_autonomy_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY coah_select ON public.content_ops_autonomy_history
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE INDEX IF NOT EXISTS coah_autonomy_rev_idx
  ON public.content_ops_autonomy_history (autonomy_id, revision DESC);

-- Snapshot trigger
CREATE OR REPLACE FUNCTION public.snapshot_content_ops_autonomy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_rev integer;
  ct text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    next_rev := 1;
    ct := 'created';
  ELSE
    SELECT COALESCE(MAX(revision),0)+1 INTO next_rev
      FROM public.content_ops_autonomy_history WHERE autonomy_id = NEW.id;
    IF OLD.emergency_pause = false AND NEW.emergency_pause = true THEN
      ct := 'emergency_pause';
    ELSIF OLD.emergency_pause = true AND NEW.emergency_pause = false THEN
      ct := 'emergency_resume';
    ELSE
      ct := 'updated';
    END IF;
  END IF;

  INSERT INTO public.content_ops_autonomy_history
    (organization_id, venture_id, autonomy_id, revision, snapshot, change_type, changed_by)
  VALUES
    (NEW.organization_id, NEW.venture_id, NEW.id, next_rev, to_jsonb(NEW), ct,
     COALESCE(NEW.changed_by, auth.uid()));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coa_snapshot
  AFTER INSERT OR UPDATE ON public.content_ops_autonomy
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_content_ops_autonomy();

-- ------------------------------------------------------------
-- 5.3 content_ops_kill_switches
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_ops_kill_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('organization','platform','venture')),
  scope_ref text,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  reason text,
  set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  set_at timestamptz NOT NULL DEFAULT now(),
  cleared_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.content_ops_kill_switches TO authenticated;
GRANT ALL ON public.content_ops_kill_switches TO service_role;

ALTER TABLE public.content_ops_kill_switches ENABLE ROW LEVEL SECURITY;

CREATE POLICY coks_select ON public.content_ops_kill_switches
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY coks_insert ON public.content_ops_kill_switches
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'owner'::org_role));

CREATE POLICY coks_update ON public.content_ops_kill_switches
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'owner'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'owner'::org_role));

CREATE OR REPLACE FUNCTION public.validate_coks_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ref_org uuid;
BEGIN
  IF NEW.venture_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'kill switch venture must belong to organization';
    END IF;
  END IF;
  IF NEW.scope = 'venture' AND NEW.venture_id IS NULL THEN
    RAISE EXCEPTION 'venture-scope kill switch requires venture_id';
  END IF;
  IF NEW.scope = 'platform' AND (NEW.scope_ref IS NULL OR length(NEW.scope_ref) = 0) THEN
    RAISE EXCEPTION 'platform-scope kill switch requires scope_ref (platform key)';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coks_scope
  BEFORE INSERT OR UPDATE ON public.content_ops_kill_switches
  FOR EACH ROW EXECUTE FUNCTION public.validate_coks_scope();

CREATE TRIGGER trg_coks_updated_at
  BEFORE UPDATE ON public.content_ops_kill_switches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS coks_org_active_idx
  ON public.content_ops_kill_switches (organization_id, scope, active) WHERE active = true;

-- ------------------------------------------------------------
-- 5.4 content_learnings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_learnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  platform text,
  content_pillar text,
  hook_pattern text,
  topic text,
  format text,
  cta text,
  publishing_time_bucket text,
  audience_segment text,
  observed_metric text NOT NULL,
  observed_delta numeric,
  baseline_metric numeric,
  sample_size integer NOT NULL DEFAULT 0,
  confidence numeric(4,3),
  evidence_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendation text,
  valid_from date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  superseded_by uuid REFERENCES public.content_learnings(id) ON DELETE SET NULL,
  engine_version text NOT NULL DEFAULT 'v1',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cl_confidence_check CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT cl_sample_size_check CHECK (sample_size >= 0),
  CONSTRAINT cl_valid_range_check CHECK (valid_until IS NULL OR valid_until >= valid_from)
);

GRANT SELECT, INSERT, UPDATE ON public.content_learnings TO authenticated;
GRANT ALL ON public.content_learnings TO service_role;

ALTER TABLE public.content_learnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY cl_select ON public.content_learnings
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY cl_insert ON public.content_learnings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'::org_role));

CREATE POLICY cl_update ON public.content_learnings
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'::org_role));

CREATE OR REPLACE FUNCTION public.validate_cl_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ref_org uuid;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'content_learnings: venture must belong to organization';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cl_scope
  BEFORE INSERT OR UPDATE ON public.content_learnings
  FOR EACH ROW EXECUTE FUNCTION public.validate_cl_scope();

CREATE TRIGGER trg_cl_updated_at
  BEFORE UPDATE ON public.content_learnings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS cl_org_venture_idx
  ON public.content_learnings (organization_id, venture_id, valid_from DESC)
  WHERE superseded_by IS NULL;

-- ------------------------------------------------------------
-- 5.5 content_ops_approvals (append-only log)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_ops_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  content_version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('approved','rejected','requested_revision','batch_approved','revoked')),
  batch_id uuid,
  policy_version text NOT NULL DEFAULT 'v1',
  brand_profile_version integer,
  notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.content_ops_approvals TO authenticated;
GRANT ALL ON public.content_ops_approvals TO service_role;

ALTER TABLE public.content_ops_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY coap_select ON public.content_ops_approvals
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY coap_insert ON public.content_ops_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'executive'::org_role)
    AND approved_by = auth.uid()
  );

CREATE OR REPLACE FUNCTION public.validate_coap_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ref_org uuid; ref_venture uuid;
BEGIN
  SELECT organization_id, venture_id INTO ref_org, ref_venture
    FROM public.social_content_items WHERE id = NEW.content_item_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id OR ref_venture <> NEW.venture_id THEN
    RAISE EXCEPTION 'approval content item must match organization and venture';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coap_scope
  BEFORE INSERT ON public.content_ops_approvals
  FOR EACH ROW EXECUTE FUNCTION public.validate_coap_scope();

CREATE INDEX IF NOT EXISTS coap_item_ver_idx
  ON public.content_ops_approvals (content_item_id, content_version, approved_at DESC);

CREATE INDEX IF NOT EXISTS coap_batch_idx
  ON public.content_ops_approvals (batch_id) WHERE batch_id IS NOT NULL;