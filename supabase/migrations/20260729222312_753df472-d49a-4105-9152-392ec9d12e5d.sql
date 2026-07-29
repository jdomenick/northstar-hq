-- ===================== 1. Client-facing fields on existing projects =====================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_stage text NOT NULL DEFAULT 'preparation',
  ADD COLUMN IF NOT EXISTS client_stage_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_next_action text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_delivery_completed_at timestamptz;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_client_stage_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_client_stage_check CHECK (
    client_stage IN ('preparation','setup','configuration','review','launch','optimization','complete')
  );

-- Client-scoped read. Visibility is explicit; a known UUID alone grants nothing.
DROP POLICY IF EXISTS projects_client_select ON public.projects;
CREATE POLICY projects_client_select ON public.projects
  FOR SELECT TO authenticated
  USING (
    client_visible
    AND deleted_at IS NULL
    AND client_id IS NOT NULL
    AND client_id = public.client_account_client_id(auth.uid())
    AND organization_id = public.client_account_org_id(auth.uid())
    AND status IN ('planned','active','at_risk','blocked','completed')
  );

-- Guard: client accounts may never write delivery state directly.
CREATE OR REPLACE FUNCTION public.projects_client_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_client_account(auth.uid()) THEN
    RAISE EXCEPTION 'client accounts cannot change delivery records';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS projects_client_guard_trg ON public.projects;
CREATE TRIGGER projects_client_guard_trg
  BEFORE INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.projects_client_guard();

-- ===================== 2. Client delivery milestones =====================
CREATE TABLE IF NOT EXISTS public.client_delivery_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'upcoming',
  target_date date,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  client_visible boolean NOT NULL DEFAULT true,
  requires_client_action boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cdm_status_check CHECK (
    status IN ('upcoming','in_progress','waiting_on_client','under_review','complete','skipped')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_delivery_milestones TO authenticated;
GRANT ALL ON public.client_delivery_milestones TO service_role;

ALTER TABLE public.client_delivery_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY cdm_operator_all ON public.client_delivery_milestones
  FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY cdm_client_select ON public.client_delivery_milestones
  FOR SELECT TO authenticated
  USING (
    client_visible
    AND client_id = public.client_account_client_id(auth.uid())
    AND organization_id = public.client_account_org_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND p.client_visible
        AND p.deleted_at IS NULL
        AND p.organization_id = client_delivery_milestones.organization_id
        AND p.client_id = client_delivery_milestones.client_id
    )
  );

CREATE INDEX IF NOT EXISTS cdm_project_order_idx
  ON public.client_delivery_milestones (project_id, sort_order);

CREATE TRIGGER cdm_set_updated_at
  BEFORE UPDATE ON public.client_delivery_milestones
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scope guard: milestone org/client must match its project, and clients cannot write.
CREATE OR REPLACE FUNCTION public.validate_cdm_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  p_org uuid;
  p_client uuid;
BEGIN
  IF public.is_client_account(auth.uid()) THEN
    RAISE EXCEPTION 'client accounts cannot change delivery milestones';
  END IF;
  SELECT organization_id, client_id INTO p_org, p_client
  FROM public.projects WHERE id = NEW.project_id;
  IF p_org IS NULL OR p_org <> NEW.organization_id OR p_client IS DISTINCT FROM NEW.client_id THEN
    RAISE EXCEPTION 'milestone must match its delivery project organization and client';
  END IF;
  IF NEW.status = 'complete' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  IF NEW.status <> 'complete' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cdm_scope_guard
  BEFORE INSERT OR UPDATE ON public.client_delivery_milestones
  FOR EACH ROW EXECUTE FUNCTION public.validate_cdm_scope();

-- ===================== 3. Deliverables on existing documents =====================
ALTER TABLE public.client_documents
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS milestone_id uuid REFERENCES public.client_delivery_milestones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deliverable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS version_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS deliverable_status text NOT NULL DEFAULT 'preparing',
  ADD COLUMN IF NOT EXISTS requires_client_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_reason text NOT NULL DEFAULT '';

ALTER TABLE public.client_documents
  DROP CONSTRAINT IF EXISTS client_documents_deliverable_status_check;
ALTER TABLE public.client_documents
  ADD CONSTRAINT client_documents_deliverable_status_check CHECK (
    deliverable_status IN ('preparing','ready_for_review','revision_requested','approved','final')
  );

CREATE INDEX IF NOT EXISTS cd_deliverable_idx
  ON public.client_documents (project_id, is_deliverable);

-- Extend the existing document guard so clients cannot touch deliverable fields.
CREATE OR REPLACE FUNCTION public.client_documents_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_client_account(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.visibility := 'client_uploaded';
    NEW.status := 'uploaded';
    NEW.uploaded_by := auth.uid();
    NEW.uploaded_at := now();
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.revision_note := '';
    NEW.is_deliverable := false;
    NEW.project_id := NULL;
    NEW.milestone_id := NULL;
    NEW.deliverable_status := 'preparing';
    NEW.requires_client_review := false;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    NEW.revision_reason := '';
    NEW.shared_at := NULL;
    NEW.version_label := '';
    RETURN NEW;
  END IF;
  IF OLD.organization_id <> NEW.organization_id
     OR OLD.client_id <> NEW.client_id
     OR OLD.visibility <> NEW.visibility
     OR OLD.title <> NEW.title
     OR OLD.instructions <> NEW.instructions
     OR OLD.is_required <> NEW.is_required
     OR OLD.revision_note <> NEW.revision_note
     OR OLD.reviewed_at IS DISTINCT FROM NEW.reviewed_at
     OR OLD.reviewed_by IS DISTINCT FROM NEW.reviewed_by
     OR OLD.is_deliverable <> NEW.is_deliverable
     OR OLD.project_id IS DISTINCT FROM NEW.project_id
     OR OLD.milestone_id IS DISTINCT FROM NEW.milestone_id
     OR OLD.deliverable_status <> NEW.deliverable_status
     OR OLD.requires_client_review <> NEW.requires_client_review
     OR OLD.version_label <> NEW.version_label
     OR OLD.shared_at IS DISTINCT FROM NEW.shared_at
     OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
     OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
     OR OLD.revision_reason <> NEW.revision_reason THEN
    RAISE EXCEPTION 'only NorthStar Labs can change this document record';
  END IF;
  IF OLD.status = 'approved' OR OLD.status = 'archived' THEN
    RAISE EXCEPTION 'this document can no longer be changed';
  END IF;
  IF NEW.status <> 'uploaded' THEN
    RAISE EXCEPTION 'invalid document status change';
  END IF;
  NEW.uploaded_by := auth.uid();
  NEW.uploaded_at := now();
  RETURN NEW;
END $$;