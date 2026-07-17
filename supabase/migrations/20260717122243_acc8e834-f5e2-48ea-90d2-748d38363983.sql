
-- =========================================================================
-- Phase 3D.3a - AI COO Core: Operating Context + Memory Kind
-- =========================================================================

-- ---------- Memory kind classification -----------------------------------
DO $$ BEGIN
  CREATE TYPE public.sam_memory_kind AS ENUM (
    'working',
    'episodic',
    'semantic',
    'operational',
    'strategic'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.sam_memory_items
  ADD COLUMN IF NOT EXISTS memory_kind public.sam_memory_kind;

CREATE INDEX IF NOT EXISTS idx_sam_memory_kind
  ON public.sam_memory_items (organization_id, memory_kind)
  WHERE deleted_at IS NULL AND memory_kind IS NOT NULL;

-- ---------- Organization operating context -------------------------------
CREATE TABLE IF NOT EXISTS public.organization_operating_context (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL UNIQUE
                           REFERENCES public.organizations(id) ON DELETE CASCADE,

  company_summary          TEXT,
  mission                  TEXT,
  current_stage            TEXT,
  business_model           TEXT,
  primary_customers        TEXT,

  strategic_priorities     JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_constraints      JSONB NOT NULL DEFAULT '[]'::jsonb,
  operating_principles     JSONB NOT NULL DEFAULT '[]'::jsonb,
  founder_preferences      JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision_preferences     JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_tolerance           TEXT,
  time_horizon             TEXT,
  current_focus            TEXT,
  major_goals              JSONB NOT NULL DEFAULT '[]'::jsonb,
  major_risks              JSONB NOT NULL DEFAULT '[]'::jsonb,
  important_metrics        JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_ventures          JSONB NOT NULL DEFAULT '[]'::jsonb,

  source_lineage           JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_version           TEXT NOT NULL DEFAULT 'coo.op-context.v1',
  revision                 INTEGER NOT NULL DEFAULT 1,

  last_reviewed_at         TIMESTAMPTZ,
  last_reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_operating_context TO authenticated;
GRANT ALL ON public.organization_operating_context TO service_role;

ALTER TABLE public.organization_operating_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_ctx_org_read"
  ON public.organization_operating_context FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "op_ctx_org_write"
  ON public.organization_operating_context FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE POLICY "op_ctx_org_update"
  ON public.organization_operating_context FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE POLICY "op_ctx_org_delete"
  ON public.organization_operating_context FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_op_ctx_org_updated
  BEFORE UPDATE ON public.organization_operating_context
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- History table
CREATE TABLE IF NOT EXISTS public.organization_operating_context_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  context_id        UUID NOT NULL REFERENCES public.organization_operating_context(id) ON DELETE CASCADE,
  revision          INTEGER NOT NULL,
  snapshot          JSONB NOT NULL,
  change_type       TEXT NOT NULL CHECK (change_type IN ('created','updated','reviewed')),
  change_reason     TEXT,
  changed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (context_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_op_ctx_org_history ON public.organization_operating_context_history (organization_id, changed_at DESC);

GRANT SELECT, INSERT ON public.organization_operating_context_history TO authenticated;
GRANT ALL ON public.organization_operating_context_history TO service_role;

ALTER TABLE public.organization_operating_context_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_ctx_org_hist_read"
  ON public.organization_operating_context_history FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "op_ctx_org_hist_write"
  ON public.organization_operating_context_history FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

-- Version snapshot trigger for org operating context
CREATE OR REPLACE FUNCTION public.snapshot_org_operating_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  next_rev INTEGER;
  changed BOOLEAN := false;
  ct TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    next_rev := 1;
    ct := 'created';
    changed := true;
  ELSE
    -- Only snapshot on meaningful field changes
    changed := (
      OLD.company_summary IS DISTINCT FROM NEW.company_summary OR
      OLD.mission IS DISTINCT FROM NEW.mission OR
      OLD.current_stage IS DISTINCT FROM NEW.current_stage OR
      OLD.business_model IS DISTINCT FROM NEW.business_model OR
      OLD.primary_customers IS DISTINCT FROM NEW.primary_customers OR
      OLD.strategic_priorities IS DISTINCT FROM NEW.strategic_priorities OR
      OLD.current_constraints IS DISTINCT FROM NEW.current_constraints OR
      OLD.operating_principles IS DISTINCT FROM NEW.operating_principles OR
      OLD.founder_preferences IS DISTINCT FROM NEW.founder_preferences OR
      OLD.decision_preferences IS DISTINCT FROM NEW.decision_preferences OR
      OLD.risk_tolerance IS DISTINCT FROM NEW.risk_tolerance OR
      OLD.time_horizon IS DISTINCT FROM NEW.time_horizon OR
      OLD.current_focus IS DISTINCT FROM NEW.current_focus OR
      OLD.major_goals IS DISTINCT FROM NEW.major_goals OR
      OLD.major_risks IS DISTINCT FROM NEW.major_risks OR
      OLD.important_metrics IS DISTINCT FROM NEW.important_metrics OR
      OLD.active_ventures IS DISTINCT FROM NEW.active_ventures OR
      OLD.policy_version IS DISTINCT FROM NEW.policy_version
    );
    IF NOT changed THEN
      -- treat pure review touches as 'reviewed' when last_reviewed_at advanced
      IF OLD.last_reviewed_at IS DISTINCT FROM NEW.last_reviewed_at AND NEW.last_reviewed_at IS NOT NULL THEN
        SELECT COALESCE(MAX(revision),0)+1 INTO next_rev
          FROM public.organization_operating_context_history WHERE context_id = NEW.id;
        INSERT INTO public.organization_operating_context_history
          (organization_id, context_id, revision, snapshot, change_type, changed_by)
        VALUES (NEW.organization_id, NEW.id, next_rev, to_jsonb(NEW), 'reviewed',
                COALESCE(NEW.last_reviewed_by, NEW.updated_by, auth.uid()));
      END IF;
      RETURN NEW;
    END IF;
    SELECT COALESCE(MAX(revision),0)+1 INTO next_rev
      FROM public.organization_operating_context_history WHERE context_id = NEW.id;
    ct := 'updated';
    NEW.revision := next_rev;
  END IF;

  INSERT INTO public.organization_operating_context_history
    (organization_id, context_id, revision, snapshot, change_type, changed_by)
  VALUES
    (NEW.organization_id, NEW.id, next_rev, to_jsonb(NEW), ct,
     COALESCE(NEW.updated_by, NEW.created_by, auth.uid()));
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_op_ctx_org_snapshot
  AFTER INSERT OR UPDATE ON public.organization_operating_context
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_org_operating_context();

-- ---------- Venture operating context ------------------------------------
CREATE TABLE IF NOT EXISTS public.venture_operating_context (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id               UUID NOT NULL UNIQUE
                           REFERENCES public.ventures(id) ON DELETE CASCADE,

  venture_summary          TEXT,
  mission                  TEXT,
  target_customer          TEXT,
  business_model           TEXT,
  current_stage            TEXT,

  current_objectives       JSONB NOT NULL DEFAULT '[]'::jsonb,
  roadmap_summary          TEXT,
  active_projects          JSONB NOT NULL DEFAULT '[]'::jsonb,
  major_dependencies       JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_bottlenecks      JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_risks            JSONB NOT NULL DEFAULT '[]'::jsonb,
  success_metrics          JSONB NOT NULL DEFAULT '[]'::jsonb,
  strategic_assumptions    JSONB NOT NULL DEFAULT '[]'::jsonb,
  market_position          TEXT,
  offers                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  products                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  services                 JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_priorities       JSONB NOT NULL DEFAULT '[]'::jsonb,
  paused_priorities        JSONB NOT NULL DEFAULT '[]'::jsonb,
  operating_notes          TEXT,

  source_lineage           JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_version           TEXT NOT NULL DEFAULT 'coo.venture-ctx.v1',
  revision                 INTEGER NOT NULL DEFAULT 1,

  last_reviewed_at         TIMESTAMPTZ,
  last_reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_venture_op_ctx_org ON public.venture_operating_context (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venture_operating_context TO authenticated;
GRANT ALL ON public.venture_operating_context TO service_role;

ALTER TABLE public.venture_operating_context ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_ctx_venture_read"
  ON public.venture_operating_context FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "op_ctx_venture_write"
  ON public.venture_operating_context FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE POLICY "op_ctx_venture_update"
  ON public.venture_operating_context FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'executive'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE POLICY "op_ctx_venture_delete"
  ON public.venture_operating_context FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_op_ctx_venture_updated
  BEFORE UPDATE ON public.venture_operating_context
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Venture scope validation
CREATE OR REPLACE FUNCTION public.validate_venture_op_ctx_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE ref_org UUID;
BEGIN
  SELECT organization_id INTO ref_org FROM public.ventures WHERE id = NEW.venture_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'venture operating context: venture must belong to organization';
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_op_ctx_venture_scope
  BEFORE INSERT OR UPDATE ON public.venture_operating_context
  FOR EACH ROW EXECUTE FUNCTION public.validate_venture_op_ctx_scope();

-- History
CREATE TABLE IF NOT EXISTS public.venture_operating_context_history (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id        UUID NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  context_id        UUID NOT NULL REFERENCES public.venture_operating_context(id) ON DELETE CASCADE,
  revision          INTEGER NOT NULL,
  snapshot          JSONB NOT NULL,
  change_type       TEXT NOT NULL CHECK (change_type IN ('created','updated','reviewed')),
  change_reason     TEXT,
  changed_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (context_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_op_ctx_venture_history
  ON public.venture_operating_context_history (organization_id, venture_id, changed_at DESC);

GRANT SELECT, INSERT ON public.venture_operating_context_history TO authenticated;
GRANT ALL ON public.venture_operating_context_history TO service_role;

ALTER TABLE public.venture_operating_context_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_ctx_venture_hist_read"
  ON public.venture_operating_context_history FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "op_ctx_venture_hist_write"
  ON public.venture_operating_context_history FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'executive'));

CREATE OR REPLACE FUNCTION public.snapshot_venture_operating_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  next_rev INTEGER;
  changed BOOLEAN := false;
  ct TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    next_rev := 1;
    ct := 'created';
    changed := true;
  ELSE
    changed := (
      OLD.venture_summary IS DISTINCT FROM NEW.venture_summary OR
      OLD.mission IS DISTINCT FROM NEW.mission OR
      OLD.target_customer IS DISTINCT FROM NEW.target_customer OR
      OLD.business_model IS DISTINCT FROM NEW.business_model OR
      OLD.current_stage IS DISTINCT FROM NEW.current_stage OR
      OLD.current_objectives IS DISTINCT FROM NEW.current_objectives OR
      OLD.roadmap_summary IS DISTINCT FROM NEW.roadmap_summary OR
      OLD.active_projects IS DISTINCT FROM NEW.active_projects OR
      OLD.major_dependencies IS DISTINCT FROM NEW.major_dependencies OR
      OLD.current_bottlenecks IS DISTINCT FROM NEW.current_bottlenecks OR
      OLD.current_risks IS DISTINCT FROM NEW.current_risks OR
      OLD.success_metrics IS DISTINCT FROM NEW.success_metrics OR
      OLD.strategic_assumptions IS DISTINCT FROM NEW.strategic_assumptions OR
      OLD.market_position IS DISTINCT FROM NEW.market_position OR
      OLD.offers IS DISTINCT FROM NEW.offers OR
      OLD.products IS DISTINCT FROM NEW.products OR
      OLD.services IS DISTINCT FROM NEW.services OR
      OLD.current_priorities IS DISTINCT FROM NEW.current_priorities OR
      OLD.paused_priorities IS DISTINCT FROM NEW.paused_priorities OR
      OLD.operating_notes IS DISTINCT FROM NEW.operating_notes OR
      OLD.policy_version IS DISTINCT FROM NEW.policy_version
    );
    IF NOT changed THEN
      IF OLD.last_reviewed_at IS DISTINCT FROM NEW.last_reviewed_at AND NEW.last_reviewed_at IS NOT NULL THEN
        SELECT COALESCE(MAX(revision),0)+1 INTO next_rev
          FROM public.venture_operating_context_history WHERE context_id = NEW.id;
        INSERT INTO public.venture_operating_context_history
          (organization_id, venture_id, context_id, revision, snapshot, change_type, changed_by)
        VALUES (NEW.organization_id, NEW.venture_id, NEW.id, next_rev, to_jsonb(NEW), 'reviewed',
                COALESCE(NEW.last_reviewed_by, NEW.updated_by, auth.uid()));
      END IF;
      RETURN NEW;
    END IF;
    SELECT COALESCE(MAX(revision),0)+1 INTO next_rev
      FROM public.venture_operating_context_history WHERE context_id = NEW.id;
    ct := 'updated';
    NEW.revision := next_rev;
  END IF;

  INSERT INTO public.venture_operating_context_history
    (organization_id, venture_id, context_id, revision, snapshot, change_type, changed_by)
  VALUES
    (NEW.organization_id, NEW.venture_id, NEW.id, next_rev, to_jsonb(NEW), ct,
     COALESCE(NEW.updated_by, NEW.created_by, auth.uid()));
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_op_ctx_venture_snapshot
  AFTER INSERT OR UPDATE ON public.venture_operating_context
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_venture_operating_context();
