
-- ============================================================================
-- S1d: Shared Content Media Pipeline
-- All publishing destinations consume the same media system.
-- ============================================================================

-- ─────────────────────────────────────────────
-- content_media_assets: canonical creative asset per venture
-- ─────────────────────────────────────────────
CREATE TABLE public.content_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.social_campaigns(id) ON DELETE SET NULL,

  -- classification
  media_type text NOT NULL,
  source text NOT NULL DEFAULT 'upload',
  status text NOT NULL DEFAULT 'pending',
  review_state text NOT NULL DEFAULT 'draft',
  archived boolean NOT NULL DEFAULT false,

  -- storage
  storage_bucket text NOT NULL DEFAULT 'organization-documents',
  storage_path text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint,
  checksum_sha256 text,

  -- image / video geometry
  width_px integer,
  height_px integer,
  aspect_ratio text,
  duration_seconds numeric(10,3),

  -- editorial metadata
  display_name text,
  alt_text text,
  suggested_alt_text text,
  caption text,
  credit text,
  creative_notes text,
  creative_brief text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],

  -- generation provenance (for future AI generation; nullable now)
  generation_model text,
  generation_prompt text,
  generation_negative_prompt text,
  generation_seed text,
  generation_parameters jsonb,
  generation_version integer,
  generated_at timestamptz,

  -- upload lifecycle
  upload_started_at timestamptz,
  uploaded_at timestamptz,
  upload_error text,

  -- audit ownership
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  last_used_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT chk_cma_media_type CHECK (media_type IN ('image','video','carousel_image','thumbnail','document','audio','other')),
  CONSTRAINT chk_cma_source     CHECK (source IN ('upload','reference','generated','placeholder')),
  CONSTRAINT chk_cma_status     CHECK (status IN ('pending','uploaded','failed')),
  CONSTRAINT chk_cma_review     CHECK (review_state IN ('draft','approved','rejected')),
  CONSTRAINT chk_cma_size       CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  CONSTRAINT chk_cma_width      CHECK (width_px IS NULL OR width_px > 0),
  CONSTRAINT chk_cma_height     CHECK (height_px IS NULL OR height_px > 0),
  CONSTRAINT chk_cma_duration   CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE INDEX idx_cma_org      ON public.content_media_assets(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cma_venture  ON public.content_media_assets(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_cma_campaign ON public.content_media_assets(campaign_id) WHERE deleted_at IS NULL AND campaign_id IS NOT NULL;
CREATE INDEX idx_cma_type     ON public.content_media_assets(venture_id, media_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_cma_status   ON public.content_media_assets(venture_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_cma_archived ON public.content_media_assets(venture_id, archived) WHERE deleted_at IS NULL;
CREATE INDEX idx_cma_updated  ON public.content_media_assets(venture_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_cma_tags     ON public.content_media_assets USING gin(tags);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_media_assets TO authenticated;
GRANT ALL ON public.content_media_assets TO service_role;

ALTER TABLE public.content_media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read content media"
  ON public.content_media_assets FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members insert content media"
  ON public.content_media_assets FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update content media"
  ON public.content_media_assets FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete content media"
  ON public.content_media_assets FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_cma_updated_at
  BEFORE UPDATE ON public.content_media_assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Venture scope validator
CREATE OR REPLACE FUNCTION public.validate_cma_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org uuid;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'content_media_assets: venture must belong to organization';
  END IF;
  IF NEW.campaign_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.social_campaigns WHERE id = NEW.campaign_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'content_media_assets: campaign must belong to organization';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cma_scope
  BEFORE INSERT OR UPDATE ON public.content_media_assets
  FOR EACH ROW EXECUTE FUNCTION public.validate_cma_scope();

-- ─────────────────────────────────────────────
-- content_media_attachments: variant <-> asset link
-- ─────────────────────────────────────────────
CREATE TABLE public.content_media_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  content_version_id uuid NOT NULL REFERENCES public.social_content_versions(id) ON DELETE CASCADE,
  media_asset_id uuid NOT NULL REFERENCES public.content_media_assets(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT chk_cmatt_role CHECK (role IN ('primary','carousel_item','thumbnail','reference')),
  CONSTRAINT chk_cmatt_order CHECK (display_order >= 0),
  UNIQUE(content_version_id, media_asset_id, role)
);

CREATE INDEX idx_cmatt_variant ON public.content_media_attachments(content_version_id, display_order);
CREATE INDEX idx_cmatt_asset   ON public.content_media_attachments(media_asset_id);
CREATE INDEX idx_cmatt_item    ON public.content_media_attachments(content_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_media_attachments TO authenticated;
GRANT ALL ON public.content_media_attachments TO service_role;

ALTER TABLE public.content_media_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read media attachments"
  ON public.content_media_attachments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members insert media attachments"
  ON public.content_media_attachments FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update media attachments"
  ON public.content_media_attachments FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members delete media attachments"
  ON public.content_media_attachments FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE OR REPLACE FUNCTION public.validate_cmatt_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid; v_venture uuid;
  i_org uuid; i_venture uuid;
  m_org uuid; m_venture uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.social_content_versions WHERE id = NEW.content_version_id;
  SELECT organization_id, venture_id INTO i_org, i_venture FROM public.social_content_items WHERE id = NEW.content_item_id;
  SELECT organization_id, venture_id INTO m_org, m_venture FROM public.content_media_assets WHERE id = NEW.media_asset_id;
  IF v_org IS NULL OR i_org IS NULL OR m_org IS NULL THEN
    RAISE EXCEPTION 'content_media_attachments: referenced rows must exist';
  END IF;
  IF v_org <> NEW.organization_id OR i_org <> NEW.organization_id OR m_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'content_media_attachments: all references must share organization';
  END IF;
  IF i_venture <> NEW.venture_id OR m_venture <> NEW.venture_id THEN
    RAISE EXCEPTION 'content_media_attachments: content and asset must share venture';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_cmatt_scope
  BEFORE INSERT OR UPDATE ON public.content_media_attachments
  FOR EACH ROW EXECUTE FUNCTION public.validate_cmatt_scope();

-- ─────────────────────────────────────────────
-- content_media_audit: append-only log of media actions
-- ─────────────────────────────────────────────
CREATE TABLE public.content_media_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  media_asset_id uuid REFERENCES public.content_media_assets(id) ON DELETE SET NULL,
  content_version_id uuid REFERENCES public.social_content_versions(id) ON DELETE SET NULL,
  content_item_id uuid REFERENCES public.social_content_items(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_state jsonb,
  new_state jsonb,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cmaudit_action CHECK (action IN (
    'upload_started','upload_completed','upload_failed',
    'replace','delete','archive','restore',
    'attach','detach','reorder',
    'approve','reject','revision',
    'publication_recorded','metadata_updated'
  ))
);

CREATE INDEX idx_cmaudit_org     ON public.content_media_audit(organization_id, created_at DESC);
CREATE INDEX idx_cmaudit_asset   ON public.content_media_audit(media_asset_id, created_at DESC);
CREATE INDEX idx_cmaudit_variant ON public.content_media_audit(content_version_id, created_at DESC);

GRANT SELECT ON public.content_media_audit TO authenticated;
GRANT ALL ON public.content_media_audit TO service_role;

ALTER TABLE public.content_media_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read media audit"
  ON public.content_media_audit FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
-- Insert/update/delete: server-side only via service role (no policy grants member writes).
