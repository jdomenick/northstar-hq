-- ============================================================================
-- sam_directives  --  standing orders the founder gives SAM
-- ============================================================================
CREATE TABLE public.sam_directives (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id      UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  text            TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 2000),
  scope           TEXT NOT NULL CHECK (scope IN ('permanent','temporary')),
  priority        INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_directives TO authenticated;
GRANT ALL ON public.sam_directives TO service_role;
ALTER TABLE public.sam_directives ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sam_directives_org_active ON public.sam_directives(organization_id, status, priority DESC);
CREATE POLICY "sam_directives_select" ON public.sam_directives FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "sam_directives_insert" ON public.sam_directives FOR INSERT TO authenticated
  WITH CHECK (has_org_role(organization_id, auth.uid(), 'executive'::org_role));
CREATE POLICY "sam_directives_update" ON public.sam_directives FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), 'executive'::org_role))
  WITH CHECK (has_org_role(organization_id, auth.uid(), 'executive'::org_role));
CREATE POLICY "sam_directives_delete" ON public.sam_directives FOR DELETE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), 'admin'::org_role));
CREATE TRIGGER trg_sam_directives_updated
  BEFORE UPDATE ON public.sam_directives
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- sam_missions  --  durable objectives SAM works on
-- ============================================================================
CREATE TABLE public.sam_missions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id      UUID REFERENCES public.ventures(id) ON DELETE SET NULL,
  title           TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description     TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','blocked','completed','cancelled')),
  priority        INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('chat','directive','manual','proof')),
  source_ref      TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_missions TO authenticated;
GRANT ALL ON public.sam_missions TO service_role;
ALTER TABLE public.sam_missions ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sam_missions_org_status ON public.sam_missions(organization_id, status, updated_at DESC);
CREATE POLICY "sam_missions_select" ON public.sam_missions FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "sam_missions_insert" ON public.sam_missions FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE POLICY "sam_missions_update" ON public.sam_missions FOR UPDATE TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE POLICY "sam_missions_delete" ON public.sam_missions FOR DELETE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), 'admin'::org_role));
CREATE TRIGGER trg_sam_missions_updated
  BEFORE UPDATE ON public.sam_missions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- sam_mission_work_items  --  units of work SAM executes toward a mission
-- ============================================================================
CREATE TABLE public.sam_mission_work_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id          UUID NOT NULL REFERENCES public.sam_missions(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description         TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','running','blocked','completed','failed','cancelled')),
  automation_job_id   UUID REFERENCES public.automation_jobs(id) ON DELETE SET NULL,
  artifact            JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code          TEXT,
  error_message       TEXT,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_mission_work_items TO authenticated;
GRANT ALL ON public.sam_mission_work_items TO service_role;
ALTER TABLE public.sam_mission_work_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sam_work_items_mission ON public.sam_mission_work_items(mission_id, created_at);
CREATE INDEX idx_sam_work_items_org_status ON public.sam_mission_work_items(organization_id, status);
CREATE POLICY "sam_work_items_select" ON public.sam_mission_work_items FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "sam_work_items_insert" ON public.sam_mission_work_items FOR INSERT TO authenticated
  WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE POLICY "sam_work_items_update" ON public.sam_mission_work_items FOR UPDATE TO authenticated
  USING (is_org_member(organization_id, auth.uid()))
  WITH CHECK (is_org_member(organization_id, auth.uid()));
CREATE TRIGGER trg_sam_work_items_updated
  BEFORE UPDATE ON public.sam_mission_work_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- sam_org_autonomy  --  org-wide SAM operating state
-- ============================================================================
CREATE TABLE public.sam_org_autonomy (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  state           TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','emergency_stopped')),
  reason          TEXT,
  changed_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_org_autonomy TO authenticated;
GRANT ALL ON public.sam_org_autonomy TO service_role;
ALTER TABLE public.sam_org_autonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sam_org_autonomy_select" ON public.sam_org_autonomy FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE POLICY "sam_org_autonomy_insert" ON public.sam_org_autonomy FOR INSERT TO authenticated
  WITH CHECK (has_org_role(organization_id, auth.uid(), 'executive'::org_role));
CREATE POLICY "sam_org_autonomy_update" ON public.sam_org_autonomy FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), 'executive'::org_role))
  WITH CHECK (
    has_org_role(organization_id, auth.uid(), 'executive'::org_role)
    AND (state <> 'emergency_stopped' OR has_org_role(organization_id, auth.uid(), 'owner'::org_role))
  );
CREATE TRIGGER trg_sam_org_autonomy_updated
  BEFORE UPDATE ON public.sam_org_autonomy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
