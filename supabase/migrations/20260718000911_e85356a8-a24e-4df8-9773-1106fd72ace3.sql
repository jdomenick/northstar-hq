
-- S1f-2b.1: Editorial workspace field expansion

-- 1) New columns on social_content_items (all nullable / defaulted; backwards compatible)
ALTER TABLE public.social_content_items
  ADD COLUMN IF NOT EXISTS working_title text,
  ADD COLUMN IF NOT EXISTS final_title text,
  ADD COLUMN IF NOT EXISTS editorial jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evergreen_topic text,
  ADD COLUMN IF NOT EXISTS evergreen_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS sci_evergreen_tags_gin
  ON public.social_content_items USING gin (evergreen_tags)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sci_evergreen_topic_idx
  ON public.social_content_items (organization_id, venture_id, evergreen_topic)
  WHERE deleted_at IS NULL AND evergreen_topic IS NOT NULL;

-- 2) Extend social_content_versions to snapshot the editorial blob and topic tags
ALTER TABLE public.social_content_versions
  ADD COLUMN IF NOT EXISTS editorial jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS working_title text,
  ADD COLUMN IF NOT EXISTS final_title text,
  ADD COLUMN IF NOT EXISTS evergreen_topic text,
  ADD COLUMN IF NOT EXISTS evergreen_tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS target_audience text,
  ADD COLUMN IF NOT EXISTS hook text,
  ADD COLUMN IF NOT EXISTS cta text,
  ADD COLUMN IF NOT EXISTS alt_text text,
  ADD COLUMN IF NOT EXISTS newsletter_subject text,
  ADD COLUMN IF NOT EXISTS newsletter_preview text,
  ADD COLUMN IF NOT EXISTS restored_from_version integer;

-- 3) Evergreen topic vocabulary table (org+venture scoped, extensible)
CREATE TABLE IF NOT EXISTS public.content_evergreen_topics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE CASCADE,
  slug text NOT NULL,
  label text NOT NULL,
  description text,
  category text,
  sort_order integer NOT NULL DEFAULT 100,
  archived_at timestamp with time zone,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, venture_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_evergreen_topics TO authenticated;
GRANT ALL ON public.content_evergreen_topics TO service_role;

ALTER TABLE public.content_evergreen_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cet_org_members_read" ON public.content_evergreen_topics
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "cet_org_members_write" ON public.content_evergreen_topics
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "cet_org_members_update" ON public.content_evergreen_topics
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "cet_org_execs_delete" ON public.content_evergreen_topics
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE TRIGGER cet_set_updated_at
  BEFORE UPDATE ON public.content_evergreen_topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS cet_org_venture_idx
  ON public.content_evergreen_topics (organization_id, venture_id, sort_order)
  WHERE archived_at IS NULL;

-- 4) Scope-validation trigger (venture must belong to org, if set)
CREATE OR REPLACE FUNCTION public.validate_cet_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE ref_org uuid;
BEGIN
  IF NEW.venture_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'content_evergreen_topics: venture must belong to organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER cet_validate_scope
  BEFORE INSERT OR UPDATE ON public.content_evergreen_topics
  FOR EACH ROW EXECUTE FUNCTION public.validate_cet_scope();
