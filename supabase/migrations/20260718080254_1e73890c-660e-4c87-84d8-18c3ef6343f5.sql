
-- 1. Allow projects to be organization-scoped (no parent venture).
ALTER TABLE public.projects ALTER COLUMN venture_id DROP NOT NULL;

-- 2. Idempotency safeguards: unique per organization on normalized name/title
--    ignoring soft-deleted rows. Uses lower() to be case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS ventures_org_lower_name_unique
  ON public.ventures (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_org_lower_name_unique
  ON public.projects (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS goals_org_lower_title_unique
  ON public.goals (organization_id, lower(title))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS decisions_org_lower_title_unique
  ON public.decisions (organization_id, lower(title))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commitments_org_lower_title_unique
  ON public.commitments (organization_id, lower(title))
  WHERE deleted_at IS NULL;
