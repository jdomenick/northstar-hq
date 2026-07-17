-- Content Ops schedule audit log.
CREATE TABLE public.content_ops_schedule_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  content_item_id UUID REFERENCES public.social_content_items(id) ON DELETE SET NULL,
  automation_job_id UUID REFERENCES public.automation_jobs(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_user_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'user',
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  policy_version TEXT NOT NULL DEFAULT 'northstar.contentops.scheduler.v1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.content_ops_schedule_audit TO authenticated;
GRANT ALL ON public.content_ops_schedule_audit TO service_role;

ALTER TABLE public.content_ops_schedule_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cosa_select_members"
  ON public.content_ops_schedule_audit
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "cosa_insert_executive"
  ON public.content_ops_schedule_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE INDEX idx_cosa_org_created_at
  ON public.content_ops_schedule_audit (organization_id, created_at DESC);

CREATE INDEX idx_cosa_content_item
  ON public.content_ops_schedule_audit (content_item_id, created_at DESC)
  WHERE content_item_id IS NOT NULL;

CREATE INDEX idx_cosa_venture
  ON public.content_ops_schedule_audit (organization_id, venture_id, created_at DESC);

-- Scope validation trigger: ensure the content item, if referenced, belongs
-- to the organization + venture in the row.
CREATE OR REPLACE FUNCTION public.validate_cosa_scope()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE ref_org UUID; ref_venture UUID; ref_job_org UUID;
BEGIN
  IF NEW.content_item_id IS NOT NULL THEN
    SELECT organization_id, venture_id INTO ref_org, ref_venture
      FROM public.social_content_items WHERE id = NEW.content_item_id;
    IF ref_org IS NULL OR ref_org <> NEW.organization_id OR ref_venture <> NEW.venture_id THEN
      RAISE EXCEPTION 'schedule audit content item must match org and venture';
    END IF;
  END IF;
  IF NEW.automation_job_id IS NOT NULL THEN
    SELECT organization_id INTO ref_job_org FROM public.automation_jobs WHERE id = NEW.automation_job_id;
    IF ref_job_org IS NULL OR ref_job_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'schedule audit job must match org';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_cosa_scope
  BEFORE INSERT OR UPDATE ON public.content_ops_schedule_audit
  FOR EACH ROW EXECUTE FUNCTION public.validate_cosa_scope();