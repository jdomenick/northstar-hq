
-- ============================================================
-- ASSET FOLDERS (nested, org- or venture-scoped)
-- ============================================================
CREATE TABLE public.asset_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE CASCADE,
  parent_folder_id UUID REFERENCES public.asset_folders(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'venture',
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  notes TEXT,
  color TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_asset_folders_scope CHECK (scope IN ('organization','venture')),
  CONSTRAINT chk_asset_folders_name_length CHECK (char_length(name) BETWEEN 1 AND 160),
  CONSTRAINT chk_asset_folders_venture_scope CHECK (
    (scope = 'organization' AND venture_id IS NULL) OR
    (scope = 'venture' AND venture_id IS NOT NULL)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_folders TO authenticated;
GRANT ALL ON public.asset_folders TO service_role;

ALTER TABLE public.asset_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read asset folders"
  ON public.asset_folders FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members insert asset folders"
  ON public.asset_folders FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY "Members update asset folders"
  ON public.asset_folders FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY "Executives delete asset folders"
  ON public.asset_folders FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'::org_role));

CREATE INDEX idx_asset_folders_org ON public.asset_folders(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_folders_venture ON public.asset_folders(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_folders_parent ON public.asset_folders(parent_folder_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_asset_folders_sibling_name ON public.asset_folders(
  organization_id, COALESCE(venture_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(parent_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
  lower(name)
) WHERE deleted_at IS NULL AND archived = false;

CREATE TRIGGER trg_asset_folders_updated
  BEFORE UPDATE ON public.asset_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scope validation: venture must belong to org, parent must share scope+org
CREATE OR REPLACE FUNCTION public.validate_asset_folder_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org UUID; parent_org UUID; parent_venture UUID;
BEGIN
  IF NEW.venture_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'asset_folders: venture must belong to organization';
    END IF;
  END IF;
  IF NEW.parent_folder_id IS NOT NULL THEN
    SELECT organization_id, venture_id INTO parent_org, parent_venture
      FROM public.asset_folders WHERE id = NEW.parent_folder_id;
    IF parent_org IS NULL OR parent_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'asset_folders: parent must belong to same organization';
    END IF;
    IF COALESCE(parent_venture::text,'') <> COALESCE(NEW.venture_id::text,'') THEN
      RAISE EXCEPTION 'asset_folders: parent must share venture scope';
    END IF;
    IF NEW.parent_folder_id = NEW.id THEN
      RAISE EXCEPTION 'asset_folders: cannot be its own parent';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_asset_folders_scope
  BEFORE INSERT OR UPDATE ON public.asset_folders
  FOR EACH ROW EXECUTE FUNCTION public.validate_asset_folder_scope();

-- ============================================================
-- ASSET FAVORITES (per user)
-- ============================================================
CREATE TABLE public.asset_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.content_media_assets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, media_asset_id)
);

GRANT SELECT, INSERT, DELETE ON public.asset_favorites TO authenticated;
GRANT ALL ON public.asset_favorites TO service_role;

ALTER TABLE public.asset_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites"
  ON public.asset_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id, auth.uid()));

CREATE INDEX idx_asset_favorites_user ON public.asset_favorites(user_id, created_at DESC);
CREATE INDEX idx_asset_favorites_asset ON public.asset_favorites(media_asset_id);

-- ============================================================
-- ASSET COLLECTIONS (curated groupings)
-- ============================================================
CREATE TABLE public.asset_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID REFERENCES public.ventures(id) ON DELETE CASCADE,
  scope TEXT NOT NULL DEFAULT 'venture',
  name TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  color TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_asset_collections_scope CHECK (scope IN ('organization','venture')),
  CONSTRAINT chk_asset_collections_name_length CHECK (char_length(name) BETWEEN 1 AND 160)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_collections TO authenticated;
GRANT ALL ON public.asset_collections TO service_role;

ALTER TABLE public.asset_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read asset collections"
  ON public.asset_collections FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members insert asset collections"
  ON public.asset_collections FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY "Members update asset collections"
  ON public.asset_collections FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY "Executives delete asset collections"
  ON public.asset_collections FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'::org_role));

CREATE INDEX idx_asset_collections_org ON public.asset_collections(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_asset_collections_venture ON public.asset_collections(venture_id) WHERE deleted_at IS NULL;

CREATE TRIGGER trg_asset_collections_updated
  BEFORE UPDATE ON public.asset_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ASSET COLLECTION ITEMS
-- ============================================================
CREATE TABLE public.asset_collection_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.asset_collections(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES public.content_media_assets(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, media_asset_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_collection_items TO authenticated;
GRANT ALL ON public.asset_collection_items TO service_role;

ALTER TABLE public.asset_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read collection items"
  ON public.asset_collection_items FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members manage collection items"
  ON public.asset_collection_items FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));

CREATE INDEX idx_asset_collection_items_col ON public.asset_collection_items(collection_id, display_order);
CREATE INDEX idx_asset_collection_items_asset ON public.asset_collection_items(media_asset_id);

-- ============================================================
-- EXTEND content_media_assets with folder_id
-- ============================================================
ALTER TABLE public.content_media_assets
  ADD COLUMN folder_id UUID REFERENCES public.asset_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_cma_folder ON public.content_media_assets(folder_id) WHERE deleted_at IS NULL AND folder_id IS NOT NULL;

-- ============================================================
-- EXTEND audit action list
-- ============================================================
ALTER TABLE public.content_media_audit DROP CONSTRAINT IF EXISTS chk_cmaudit_action;
ALTER TABLE public.content_media_audit ADD CONSTRAINT chk_cmaudit_action CHECK (
  action IN (
    'upload_started','upload_completed','upload_failed','replace','delete','archive','restore',
    'attach','detach','reorder','approve','reject','revision','publication_recorded','metadata_updated',
    'rename','move','copy','duplicate','favorite','unfavorite','tag_added','tag_removed',
    'folder_created','folder_renamed','folder_moved','folder_archived','folder_restored','folder_deleted',
    'collection_created','collection_updated','collection_deleted','added_to_collection','removed_from_collection',
    'bulk_move','bulk_archive','bulk_delete','bulk_tag'
  )
);
