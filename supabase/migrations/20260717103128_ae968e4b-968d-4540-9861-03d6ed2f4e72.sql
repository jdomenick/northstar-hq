
-- ============================================================
-- 3D.2c-iii Social Automation Domain
-- Additive migration. No live connectors, no publishing, no
-- provider authority. All defaults are safe-off.
-- ============================================================

-- Helper: safe-copy of client bearer flag for scope checks reuse
-- (reuses existing set_updated_at() and has_org_role()).

-- ============================================================
-- 1. organization_social_settings (one row per organization)
-- ============================================================
CREATE TABLE public.organization_social_settings (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  publishing_master_switch BOOLEAN NOT NULL DEFAULT FALSE,
  publishing_enabled_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  publishing_enabled_at TIMESTAMPTZ NULL,
  publishing_confirmation_version TEXT NULL,
  emergency_stop BOOLEAN NOT NULL DEFAULT FALSE,
  emergency_stop_reason TEXT NULL,
  emergency_stopped_at TIMESTAMPTZ NULL,
  emergency_stopped_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  default_automation_mode TEXT NOT NULL DEFAULT 'draft_only'
    CHECK (default_automation_mode IN ('draft_only','approval_required','auto_publish_approved_templates','full_automation')),
  default_approval_policy TEXT NOT NULL DEFAULT 'human_required'
    CHECK (default_approval_policy IN ('human_required','campaign_preapproved','template_preapproved','policy_based','no_approval_required')),
  default_timezone TEXT NOT NULL DEFAULT 'UTC',
  maximum_posts_per_day INT NOT NULL DEFAULT 20 CHECK (maximum_posts_per_day BETWEEN 0 AND 500),
  maximum_posts_per_platform_per_day INT NOT NULL DEFAULT 10 CHECK (maximum_posts_per_platform_per_day BETWEEN 0 AND 200),
  allow_weekend_publishing BOOLEAN NOT NULL DEFAULT TRUE,
  allow_holiday_publishing BOOLEAN NOT NULL DEFAULT TRUE,
  prohibited_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  restricted_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  global_required_disclaimers JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_version TEXT NOT NULL DEFAULT 'northstar.social.policy.v1',
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organization_social_settings TO authenticated;
GRANT ALL ON public.organization_social_settings TO service_role;
ALTER TABLE public.organization_social_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY oss_select ON public.organization_social_settings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY oss_insert ON public.organization_social_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY oss_update ON public.organization_social_settings FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER oss_set_updated_at BEFORE UPDATE ON public.organization_social_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. venture_social_settings
-- ============================================================
CREATE TABLE public.venture_social_settings (
  venture_id UUID PRIMARY KEY REFERENCES public.ventures(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  publishing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  pause_reason TEXT NULL,
  paused_at TIMESTAMPTZ NULL,
  paused_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  automation_mode TEXT NOT NULL DEFAULT 'draft_only'
    CHECK (automation_mode IN ('draft_only','approval_required','auto_publish_approved_templates','full_automation')),
  approval_policy TEXT NOT NULL DEFAULT 'human_required'
    CHECK (approval_policy IN ('human_required','campaign_preapproved','template_preapproved','policy_based','no_approval_required')),
  default_timezone TEXT NOT NULL DEFAULT 'UTC',
  maximum_posts_per_day INT NOT NULL DEFAULT 10 CHECK (maximum_posts_per_day BETWEEN 0 AND 500),
  allowed_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_review_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  prohibited_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  restricted_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_disclaimers JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_version TEXT NOT NULL DEFAULT 'northstar.social.policy.v1',
  updated_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.venture_social_settings TO authenticated;
GRANT ALL ON public.venture_social_settings TO service_role;
ALTER TABLE public.venture_social_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY vss_select ON public.venture_social_settings FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY vss_write ON public.venture_social_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY vss_update ON public.venture_social_settings FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE TRIGGER vss_set_updated_at BEFORE UPDATE ON public.venture_social_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scope validator: venture must belong to organization
CREATE OR REPLACE FUNCTION public.validate_vss_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'venture must belong to the given organization';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_vss_scope() FROM PUBLIC;
CREATE TRIGGER vss_validate_scope BEFORE INSERT OR UPDATE ON public.venture_social_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_vss_scope();

-- ============================================================
-- 3. social_accounts
-- ============================================================
CREATE TABLE public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  asset_id UUID NULL REFERENCES public.assets(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN
    ('facebook','instagram','linkedin','x','threads','tiktok','youtube','pinterest','reddit','bluesky','other')),
  display_name TEXT NOT NULL,
  username TEXT NULL,
  external_account_id TEXT NULL,
  account_type TEXT NULL,
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('disconnected','pending','connected','degraded','expired','revoked','error','archived')),
  credential_reference TEXT NULL,
  granted_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  publishing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  automation_mode TEXT NOT NULL DEFAULT 'draft_only'
    CHECK (automation_mode IN ('draft_only','approval_required','auto_publish_approved_templates','full_automation')),
  approval_policy TEXT NOT NULL DEFAULT 'human_required'
    CHECK (approval_policy IN ('human_required','campaign_preapproved','template_preapproved','policy_based','no_approval_required')),
  default_timezone TEXT NOT NULL DEFAULT 'UTC',
  default_schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_verified_at TIMESTAMPTZ NULL,
  last_successful_publication_at TIMESTAMPTZ NULL,
  last_failed_publication_at TIMESTAMPTZ NULL,
  last_metrics_sync_at TIMESTAMPTZ NULL,
  health_score INT NULL CHECK (health_score IS NULL OR (health_score BETWEEN 0 AND 100)),
  health_band TEXT NOT NULL DEFAULT 'unknown'
    CHECK (health_band IN ('healthy','watch','degraded','critical','unknown')),
  consecutive_failures INT NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT social_accounts_credential_no_token CHECK (
    credential_reference IS NULL OR (
      credential_reference !~* '(^ey[a-z0-9._-]+\.)' AND
      credential_reference !~* 'access_token' AND
      credential_reference !~* 'refresh_token' AND
      length(credential_reference) <= 200
    )
  )
);
CREATE UNIQUE INDEX social_accounts_active_external_uniq ON public.social_accounts
  (organization_id, platform, external_account_id) WHERE external_account_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX social_accounts_org_venture_idx ON public.social_accounts (organization_id, venture_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY sa_select ON public.social_accounts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY sa_insert ON public.social_accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));
CREATE POLICY sa_update ON public.social_accounts FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'admin')
    -- Clients may not self-verify connection or set successful timestamps.
    AND connection_status <> 'connected'
    AND external_account_id IS NULL
    AND last_verified_at IS NULL
    AND last_successful_publication_at IS NULL
  );
CREATE TRIGGER sa_set_updated_at BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_social_account_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'social account venture must belong to organization';
  END IF;
  IF NEW.asset_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.assets WHERE id = NEW.asset_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'social account asset must belong to organization';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_social_account_scope() FROM PUBLIC;
CREATE TRIGGER sa_validate_scope BEFORE INSERT OR UPDATE ON public.social_accounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_social_account_scope();

-- ============================================================
-- 4. venture_brand_profiles (versioned)
-- ============================================================
CREATE TABLE public.venture_brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  version INT NOT NULL CHECK (version >= 1),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','active','superseded','archived')),
  brand_name TEXT NOT NULL,
  short_description TEXT NULL,
  long_description TEXT NULL,
  mission TEXT NULL,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  voice_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  tone_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
  core_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_calls_to_action JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_disclaimers JSONB NOT NULL DEFAULT '[]'::jsonb,
  prohibited_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  prohibited_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  restricted_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  profanity_policy TEXT NOT NULL DEFAULT 'strict'
    CHECK (profanity_policy IN ('strict','moderate','permissive')),
  emoji_policy TEXT NOT NULL DEFAULT 'allowed'
    CHECK (emoji_policy IN ('none','sparingly','allowed','encouraged')),
  hashtag_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  platform_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  visual_guidance JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  rejected_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
  crisis_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  review_requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  effective_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (venture_id, version)
);
-- Only one active profile per venture
CREATE UNIQUE INDEX vbp_one_active_per_venture ON public.venture_brand_profiles (venture_id)
  WHERE status = 'active';
CREATE INDEX vbp_org_venture_idx ON public.venture_brand_profiles (organization_id, venture_id);
GRANT SELECT, INSERT, UPDATE ON public.venture_brand_profiles TO authenticated;
GRANT ALL ON public.venture_brand_profiles TO service_role;
ALTER TABLE public.venture_brand_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY vbp_select ON public.venture_brand_profiles FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY vbp_insert ON public.venture_brand_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY vbp_update ON public.venture_brand_profiles FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'member')
    -- Client-side updates may not self-approve/activate; server functions running as service_role handle transitions.
    AND status IN ('draft','pending_review','archived')
  );
CREATE TRIGGER vbp_set_updated_at BEFORE UPDATE ON public.venture_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_vbp_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'brand profile venture must belong to organization';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_vbp_scope() FROM PUBLIC;
CREATE TRIGGER vbp_validate_scope BEFORE INSERT OR UPDATE ON public.venture_brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_vbp_scope();

-- ============================================================
-- 5. social_campaigns
-- ============================================================
CREATE TABLE public.social_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT NULL,
  description TEXT NULL,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_at TIMESTAMPTZ NULL,
  end_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','active','paused','completed','cancelled','archived')),
  automation_mode TEXT NOT NULL DEFAULT 'draft_only'
    CHECK (automation_mode IN ('draft_only','approval_required','auto_publish_approved_templates','full_automation')),
  approval_policy TEXT NOT NULL DEFAULT 'human_required'
    CHECK (approval_policy IN ('human_required','campaign_preapproved','template_preapproved','policy_based','no_approval_required')),
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
  calls_to_action JSONB NOT NULL DEFAULT '[]'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_disclaimers JSONB NOT NULL DEFAULT '[]'::jsonb,
  prohibited_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  posting_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  content_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_metadata JSONB NULL,
  paused BOOLEAN NOT NULL DEFAULT FALSE,
  pause_reason TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX sc_org_venture_status_idx ON public.social_campaigns (organization_id, venture_id, status) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.social_campaigns TO authenticated;
GRANT ALL ON public.social_campaigns TO service_role;
ALTER TABLE public.social_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY scm_select ON public.social_campaigns FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY scm_insert ON public.social_campaigns FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY scm_update ON public.social_campaigns FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'member')
    AND status IN ('draft','pending_approval','paused','cancelled','archived')
  );
CREATE TRIGGER sc_set_updated_at BEFORE UPDATE ON public.social_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_sc_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'campaign venture must belong to organization';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_sc_scope() FROM PUBLIC;
CREATE TRIGGER sc_validate_scope BEFORE INSERT OR UPDATE ON public.social_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_sc_scope();

-- ============================================================
-- 6. social_content_plans
-- ============================================================
CREATE TABLE public.social_content_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  campaign_id UUID NULL REFERENCES public.social_campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  objective TEXT NULL,
  audience JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE NULL,
  end_date DATE NULL,
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_mix JSONB NOT NULL DEFAULT '{}'::jsonb,
  calls_to_action JSONB NOT NULL DEFAULT '[]'::jsonb,
  automation_mode TEXT NOT NULL DEFAULT 'draft_only'
    CHECK (automation_mode IN ('draft_only','approval_required','auto_publish_approved_templates','full_automation')),
  approval_policy TEXT NOT NULL DEFAULT 'human_required'
    CHECK (approval_policy IN ('human_required','campaign_preapproved','template_preapproved','policy_based','no_approval_required')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_review','approved','active','completed','cancelled','archived')),
  source_lineage JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX scp_org_venture_idx ON public.social_content_plans (organization_id, venture_id, status) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.social_content_plans TO authenticated;
GRANT ALL ON public.social_content_plans TO service_role;
ALTER TABLE public.social_content_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY scp_select ON public.social_content_plans FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY scp_insert ON public.social_content_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY scp_update ON public.social_content_plans FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'member')
    AND status IN ('draft','pending_review','cancelled','archived')
  );
CREATE TRIGGER scp_set_updated_at BEFORE UPDATE ON public.social_content_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_scp_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'plan venture must belong to organization';
  END IF;
  IF NEW.campaign_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.social_campaigns WHERE id = NEW.campaign_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'plan campaign must belong to organization';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_scp_scope() FROM PUBLIC;
CREATE TRIGGER scp_validate_scope BEFORE INSERT OR UPDATE ON public.social_content_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_scp_scope();

-- ============================================================
-- 7. social_content_items
-- ============================================================
CREATE TABLE public.social_content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  social_account_id UUID NULL REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  campaign_id UUID NULL REFERENCES public.social_campaigns(id) ON DELETE SET NULL,
  content_plan_id UUID NULL REFERENCES public.social_content_plans(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN
    ('facebook','instagram','linkedin','x','threads','tiktok','youtube','pinterest','reddit','bluesky','other')),
  content_type TEXT NOT NULL DEFAULT 'text'
    CHECK (content_type IN ('text','image','carousel','short_video','long_video','story','reel','article','link','poll','thread','community_post','other')),
  title TEXT NULL,
  body TEXT NOT NULL,
  first_comment TEXT NULL,
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  link_url TEXT NULL,
  media_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (media_status IN ('not_required','required','pending','ready','failed','unavailable')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('idea','draft','generated','needs_review','changes_requested','approved','scheduled','publishing','published','failed','paused','cancelled','archived')),
  risk_band TEXT NOT NULL DEFAULT 'unknown'
    CHECK (risk_band IN ('low','moderate','high','critical','unknown')),
  risk_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score NUMERIC NULL CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  automation_generated BOOLEAN NOT NULL DEFAULT FALSE,
  human_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (approval_status IN ('not_required','pending','approved','rejected','changes_requested','expired','revoked')),
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  approved_content_version INT NULL,
  content_version INT NOT NULL DEFAULT 1 CHECK (content_version >= 1),
  scheduled_for TIMESTAMPTZ NULL,
  publishing_window_start TIMESTAMPTZ NULL,
  publishing_window_end TIMESTAMPTZ NULL,
  published_at TIMESTAMPTZ NULL,
  external_post_id TEXT NULL,
  external_post_url TEXT NULL,
  source_lineage JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_profile_version INT NULL,
  policy_version TEXT NOT NULL DEFAULT 'northstar.social.policy.v1',
  duplicate_fingerprint TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE INDEX sci_org_venture_status_idx ON public.social_content_items (organization_id, venture_id, status) WHERE deleted_at IS NULL;
CREATE INDEX sci_fingerprint_idx ON public.social_content_items (organization_id, duplicate_fingerprint) WHERE deleted_at IS NULL;
CREATE INDEX sci_scheduled_idx ON public.social_content_items (organization_id, scheduled_for) WHERE scheduled_for IS NOT NULL AND deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.social_content_items TO authenticated;
GRANT ALL ON public.social_content_items TO service_role;
ALTER TABLE public.social_content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sci_select ON public.social_content_items FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY sci_insert ON public.social_content_items FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'member')
    AND status IN ('idea','draft')
    AND published_at IS NULL
    AND external_post_id IS NULL
    AND external_post_url IS NULL
    AND automation_generated = FALSE
  );
CREATE POLICY sci_update ON public.social_content_items FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), 'member')
    -- Clients may never mark content published or set connector-derived fields.
    AND status NOT IN ('publishing','published')
    AND published_at IS NULL
    AND external_post_id IS NULL
    AND external_post_url IS NULL
  );
CREATE TRIGGER sci_set_updated_at BEFORE UPDATE ON public.social_content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_sci_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID; ref_venture UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'content venture must belong to organization';
  END IF;
  IF NEW.social_account_id IS NOT NULL THEN
    SELECT organization_id, venture_id INTO ref_org, ref_venture FROM public.social_accounts WHERE id = NEW.social_account_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id OR ref_venture <> NEW.venture_id THEN
      RAISE EXCEPTION 'content account must belong to same organization and venture';
    END IF;
  END IF;
  IF NEW.campaign_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.social_campaigns WHERE id = NEW.campaign_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'content campaign must belong to organization';
    END IF;
  END IF;
  IF NEW.content_plan_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.social_content_plans WHERE id = NEW.content_plan_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'content plan must belong to organization';
    END IF;
  END IF;
  -- Published content must have external_post_id
  IF NEW.status = 'published' AND (NEW.external_post_id IS NULL OR NEW.published_at IS NULL) THEN
    RAISE EXCEPTION 'published content requires external_post_id and published_at';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_sci_scope() FROM PUBLIC;
CREATE TRIGGER sci_validate_scope BEFORE INSERT OR UPDATE ON public.social_content_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_sci_scope();

-- ============================================================
-- 8. social_content_versions (immutable)
-- ============================================================
CREATE TABLE public.social_content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  version INT NOT NULL CHECK (version >= 1),
  title TEXT NULL,
  body TEXT NOT NULL,
  first_comment TEXT NULL,
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  link_url TEXT NULL,
  media_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  change_reason TEXT NULL,
  generated_by TEXT NOT NULL DEFAULT 'user'
    CHECK (generated_by IN ('user','system','sam','automation')),
  generated_by_actor_id UUID NULL,
  brand_profile_version INT NULL,
  policy_version TEXT NOT NULL DEFAULT 'northstar.social.policy.v1',
  source_lineage JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (content_item_id, version)
);
CREATE INDEX scv_org_item_idx ON public.social_content_versions (organization_id, content_item_id, version);
GRANT SELECT, INSERT ON public.social_content_versions TO authenticated;
GRANT ALL ON public.social_content_versions TO service_role;
ALTER TABLE public.social_content_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY scv_select ON public.social_content_versions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY scv_insert ON public.social_content_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
-- No update / delete policies: immutable versions.

CREATE OR REPLACE FUNCTION public.validate_scv_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.social_content_items WHERE id = NEW.content_item_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'content version must match item organization';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_scv_scope() FROM PUBLIC;
CREATE TRIGGER scv_validate_scope BEFORE INSERT OR UPDATE ON public.social_content_versions
  FOR EACH ROW EXECUTE FUNCTION public.validate_scv_scope();

-- ============================================================
-- 9. social_publication_attempts
-- ============================================================
CREATE TABLE public.social_publication_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  automation_job_id UUID NULL REFERENCES public.automation_jobs(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  content_version INT NOT NULL CHECK (content_version >= 1),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','validating','publishing','succeeded','failed','rate_limited','rejected','cancelled','unknown')),
  attempt_number INT NOT NULL CHECK (attempt_number >= 1),
  idempotency_key TEXT NOT NULL,
  connector_version TEXT NOT NULL DEFAULT 'v0',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  duration_ms INT NULL,
  external_post_id TEXT NULL,
  external_post_url TEXT NULL,
  external_reference TEXT NULL,
  error_code TEXT NULL,
  response_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT spa_success_requires_external_id CHECK (
    status <> 'succeeded' OR external_post_id IS NOT NULL
  ),
  UNIQUE (content_item_id, social_account_id, attempt_number)
);
CREATE UNIQUE INDEX spa_active_idempotency_uniq ON public.social_publication_attempts
  (organization_id, idempotency_key) WHERE status IN ('pending','validating','publishing');
CREATE INDEX spa_org_item_idx ON public.social_publication_attempts (organization_id, content_item_id);
GRANT SELECT ON public.social_publication_attempts TO authenticated;
GRANT ALL ON public.social_publication_attempts TO service_role;
ALTER TABLE public.social_publication_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY spa_select ON public.social_publication_attempts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
-- No client insert/update/delete: only service_role (secure connector path).

CREATE OR REPLACE FUNCTION public.validate_spa_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c_org UUID; c_venture UUID; a_org UUID; a_venture UUID;
BEGIN
  SELECT organization_id, venture_id INTO c_org, c_venture FROM public.social_content_items WHERE id = NEW.content_item_id;
  SELECT organization_id, venture_id INTO a_org, a_venture FROM public.social_accounts WHERE id = NEW.social_account_id;
  IF c_org IS NULL OR a_org IS NULL OR c_org <> NEW.organization_id OR a_org <> NEW.organization_id
     OR c_venture <> NEW.venture_id OR a_venture <> NEW.venture_id THEN
    RAISE EXCEPTION 'publication attempt content and account must share org and venture';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_spa_scope() FROM PUBLIC;
CREATE TRIGGER spa_validate_scope BEFORE INSERT OR UPDATE ON public.social_publication_attempts
  FOR EACH ROW EXECUTE FUNCTION public.validate_spa_scope();

-- ============================================================
-- 10. social_content_metrics
-- ============================================================
CREATE TABLE public.social_content_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_post_id TEXT NOT NULL,
  measurement_window TEXT NOT NULL DEFAULT 'lifetime',
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  impressions INT NULL,
  reach INT NULL,
  views INT NULL,
  likes INT NULL,
  comments INT NULL,
  shares INT NULL,
  saves INT NULL,
  clicks INT NULL,
  link_clicks INT NULL,
  watch_time_seconds INT NULL,
  completion_rate NUMERIC NULL,
  follows INT NULL,
  leads INT NULL,
  conversions INT NULL,
  engagement_rate NUMERIC NULL,
  raw_metrics_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  connector_version TEXT NOT NULL DEFAULT 'v0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, content_item_id, measurement_window, measured_at)
);
CREATE INDEX scmet_org_content_idx ON public.social_content_metrics (organization_id, content_item_id, measured_at DESC);
GRANT SELECT ON public.social_content_metrics TO authenticated;
GRANT ALL ON public.social_content_metrics TO service_role;
ALTER TABLE public.social_content_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY scmet_select ON public.social_content_metrics FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
-- writes: service_role only.

CREATE OR REPLACE FUNCTION public.validate_scmet_scope() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c_org UUID; c_venture UUID; a_org UUID; a_venture UUID;
BEGIN
  SELECT organization_id, venture_id INTO c_org, c_venture FROM public.social_content_items WHERE id = NEW.content_item_id;
  SELECT organization_id, venture_id INTO a_org, a_venture FROM public.social_accounts WHERE id = NEW.social_account_id;
  IF c_org IS NULL OR a_org IS NULL OR c_org <> NEW.organization_id OR a_org <> NEW.organization_id
     OR c_venture <> NEW.venture_id OR a_venture <> NEW.venture_id THEN
    RAISE EXCEPTION 'metrics content and account must share org and venture';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.validate_scmet_scope() FROM PUBLIC;
CREATE TRIGGER scmet_validate_scope BEFORE INSERT OR UPDATE ON public.social_content_metrics
  FOR EACH ROW EXECUTE FUNCTION public.validate_scmet_scope();
