-- 1. New audit event types (usable in later transactions).
ALTER TYPE public.billing_event_type ADD VALUE IF NOT EXISTS 'delivery_project_created';
ALTER TYPE public.billing_event_type ADD VALUE IF NOT EXISTS 'client_activated';
ALTER TYPE public.billing_event_type ADD VALUE IF NOT EXISTS 'delivery_ready_to_start';

-- 2. Delivery linkage on the existing projects table.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.revenue_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_id uuid REFERENCES public.nsl_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS proposal_version integer,
  ADD COLUMN IF NOT EXISTS pipeline_id uuid REFERENCES public.revenue_pipeline(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_source text NOT NULL DEFAULT 'manual';

-- Idempotency: at most one delivery project per org + client + accepted proposal version.
CREATE UNIQUE INDEX IF NOT EXISTS projects_delivery_unique
  ON public.projects (organization_id, client_id, proposal_id, proposal_version)
  WHERE proposal_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS projects_client_idx ON public.projects (organization_id, client_id);

-- 3. Activation tracking on clients (historical onboarding data preserved).
ALTER TABLE public.revenue_clients
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_proposal_id uuid REFERENCES public.nsl_proposals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activation_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 4. Cross-organization protection for delivery links.
CREATE OR REPLACE FUNCTION public.validate_project_delivery_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE ref_org uuid;
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.revenue_clients WHERE id = NEW.client_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'project client must belong to the same organization';
    END IF;
  END IF;
  IF NEW.proposal_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.nsl_proposals WHERE id = NEW.proposal_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'project proposal must belong to the same organization';
    END IF;
  END IF;
  IF NEW.pipeline_id IS NOT NULL THEN
    SELECT organization_id INTO ref_org FROM public.revenue_pipeline WHERE id = NEW.pipeline_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'project pipeline record must belong to the same organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_project_delivery_scope_trg ON public.projects;
CREATE TRIGGER validate_project_delivery_scope_trg
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_delivery_scope();
