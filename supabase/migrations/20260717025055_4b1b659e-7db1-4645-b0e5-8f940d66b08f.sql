
-- Helper: are two users members of any shared organization?
CREATE OR REPLACE FUNCTION public.shares_org_with(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members ma
    JOIN public.organization_members mb
      ON ma.organization_id = mb.organization_id
    WHERE ma.user_id = _a
      AND mb.user_id = _b
      AND ma.status = 'active'
      AND mb.status = 'active'
  );
$$;

-- Allow members to read profile info of users they share an org with
DROP POLICY IF EXISTS "Members read fellow profiles" ON public.profiles;
CREATE POLICY "Members read fellow profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.shares_org_with(auth.uid(), id));

-- Enforce unique organization slug (case-insensitive) and safe format
UPDATE public.organizations SET slug = lower(regexp_replace(slug, '[^a-z0-9-]+', '-', 'g')) WHERE slug IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_key ON public.organizations (lower(slug)) WHERE slug IS NOT NULL;

-- Slug format validation triggers
CREATE OR REPLACE FUNCTION public.validate_slug_format()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Invalid slug: use lowercase letters, digits, and hyphens only';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_orgs_slug_format ON public.organizations;
CREATE TRIGGER trg_orgs_slug_format
  BEFORE INSERT OR UPDATE OF slug ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.validate_slug_format();

DROP TRIGGER IF EXISTS trg_ventures_slug_format ON public.ventures;
CREATE TRIGGER trg_ventures_slug_format
  BEFORE INSERT OR UPDATE OF slug ON public.ventures
  FOR EACH ROW EXECUTE FUNCTION public.validate_slug_format();
