
-- Phase 3C: SAM Executive Intelligence
-- Extends executive_insights and adds recommendations, health snapshots,
-- executive digests, and their audit trails.

-- ── 1. Extend executive_insights with pattern/priority/evidence fields.

DO $$ BEGIN
  CREATE TYPE public.insight_priority AS ENUM ('low','normal','high','critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.executive_insights
  ADD COLUMN IF NOT EXISTS priority public.insight_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS confidence numeric(4,3) NOT NULL DEFAULT 0.5
    CHECK (confidence >= 0 AND confidence <= 1),
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS pattern_key text,
  ADD COLUMN IF NOT EXISTS pattern_version text,
  ADD COLUMN IF NOT EXISTS entity_ref text,
  ADD COLUMN IF NOT EXISTS dismissed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dismissed_reason text,
  ADD COLUMN IF NOT EXISTS acted_on_at timestamptz,
  ADD COLUMN IF NOT EXISTS acted_on_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acted_on_action text;

-- Uniqueness for idempotent upserts per detector target. Partial index so
-- a pattern can re-surface after being dismissed if evidence changes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_exec_insights_pattern_active
  ON public.executive_insights (organization_id, pattern_key, entity_ref)
  WHERE pattern_key IS NOT NULL AND dismissed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_exec_insights_priority
  ON public.executive_insights (organization_id, priority, generated_at DESC)
  WHERE dismissed_at IS NULL;

-- ── 2. sam_recommendations

CREATE TABLE IF NOT EXISTS public.sam_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  insight_id uuid REFERENCES public.executive_insights(id) ON DELETE SET NULL,
  kind text NOT NULL,
  title text NOT NULL,
  rationale text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected_impact text,
  confidence numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  priority public.insight_priority NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','dismissed','snoozed','converted')),
  snooze_until timestamptz,
  converted_to_ref jsonb,
  method_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_sam_rec_org_status
  ON public.sam_recommendations (organization_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sam_rec_insight
  ON public.sam_recommendations (insight_id) WHERE insight_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sam_recommendations TO authenticated;
GRANT ALL ON public.sam_recommendations TO service_role;
ALTER TABLE public.sam_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read recommendations" ON public.sam_recommendations
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members create recommendations" ON public.sam_recommendations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY "Members update recommendations" ON public.sam_recommendations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY "Admins delete recommendations" ON public.sam_recommendations
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));
CREATE TRIGGER trg_sam_rec_updated BEFORE UPDATE ON public.sam_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. sam_recommendation_events (append-only audit)

CREATE TABLE IF NOT EXISTS public.sam_recommendation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.sam_recommendations(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL
    CHECK (action IN ('created','accepted','dismissed','snoozed','assigned','converted_task','converted_goal','opened','reason_added')),
  reason text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sam_rec_events_rec
  ON public.sam_recommendation_events (recommendation_id, created_at DESC);

GRANT SELECT, INSERT ON public.sam_recommendation_events TO authenticated;
GRANT ALL ON public.sam_recommendation_events TO service_role;
ALTER TABLE public.sam_recommendation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read rec events" ON public.sam_recommendation_events
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members write rec events" ON public.sam_recommendation_events
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));

-- ── 4. sam_health_snapshots

CREATE TABLE IF NOT EXISTS public.sam_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  overall numeric(4,3) NOT NULL CHECK (overall >= 0 AND overall <= 1),
  categories jsonb NOT NULL,
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  method_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sam_health_org_time
  ON public.sam_health_snapshots (organization_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sam_health_org_venture_time
  ON public.sam_health_snapshots (organization_id, venture_id, computed_at DESC);

GRANT SELECT, INSERT ON public.sam_health_snapshots TO authenticated;
GRANT ALL ON public.sam_health_snapshots TO service_role;
ALTER TABLE public.sam_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read health" ON public.sam_health_snapshots
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members write health" ON public.sam_health_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));

-- ── 5. sam_executive_digests

CREATE TABLE IF NOT EXISTS public.sam_executive_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  sections jsonb NOT NULL,
  insight_ids uuid[] NOT NULL DEFAULT '{}',
  recommendation_ids uuid[] NOT NULL DEFAULT '{}',
  health_snapshot_id uuid REFERENCES public.sam_health_snapshots(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  method_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, digest_date)
);
CREATE INDEX IF NOT EXISTS idx_sam_digest_org_date
  ON public.sam_executive_digests (organization_id, digest_date DESC);

GRANT SELECT, INSERT, UPDATE ON public.sam_executive_digests TO authenticated;
GRANT ALL ON public.sam_executive_digests TO service_role;
ALTER TABLE public.sam_executive_digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read digests" ON public.sam_executive_digests
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members write digests" ON public.sam_executive_digests
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY "Members update digests" ON public.sam_executive_digests
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE TRIGGER trg_sam_digest_updated BEFORE UPDATE ON public.sam_executive_digests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
