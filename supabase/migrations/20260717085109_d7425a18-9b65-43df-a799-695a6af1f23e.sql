-- Phase 3D.2b + Executive Architecture: Assets, Signals, Intelligence primitives.
-- Additive only. Does not alter or drop any existing columns, policies, or types.

-- ─────────────────────────────────────────────
-- asset_types lookup (extensible; not hardcoded in code)
-- ─────────────────────────────────────────────
CREATE TABLE public.asset_types (
  key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  category text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.asset_types TO authenticated, anon;
GRANT ALL ON public.asset_types TO service_role;

ALTER TABLE public.asset_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads asset types"
  ON public.asset_types FOR SELECT TO authenticated, anon USING (true);

INSERT INTO public.asset_types(key, label, category, is_system) VALUES
  ('website',           'Website',           'presence',       true),
  ('application',       'Application',       'product',        true),
  ('database',          'Database',          'infrastructure', true),
  ('api',               'API',               'infrastructure', true),
  ('repository',        'Repository',        'engineering',    true),
  ('documentation',     'Documentation',     'knowledge',      true),
  ('analytics',         'Analytics',         'measurement',    true),
  ('email',             'Email',             'communication',  true),
  ('crm',               'CRM',               'commercial',     true),
  ('marketing',         'Marketing',         'growth',         true),
  ('social',            'Social',            'growth',         true),
  ('financial',         'Financial',         'operations',     true),
  ('customer_support',  'Customer Support',  'operations',     true),
  ('knowledge_base',    'Knowledge Base',    'knowledge',      true),
  ('storage',           'Storage',           'infrastructure', true),
  ('calendar',          'Calendar',          'operations',     true),
  ('messaging',         'Messaging',         'communication',  true),
  ('other',             'Other',             'other',          true);

-- ─────────────────────────────────────────────
-- assets: primary object of the Executive OS
-- ─────────────────────────────────────────────
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  asset_type text NOT NULL REFERENCES public.asset_types(key),
  display_name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criticality text NOT NULL DEFAULT 'medium',
  trust_level text NOT NULL DEFAULT 'unverified',
  health text NOT NULL DEFAULT 'unknown',
  freshness text NOT NULL DEFAULT 'unknown',
  automation_mode text NOT NULL DEFAULT 'suggest',
  last_activity_at timestamptz,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_assets_criticality CHECK (criticality IN ('low','medium','high','critical')),
  CONSTRAINT chk_assets_status      CHECK (status IN ('active','paused','archived','error')),
  CONSTRAINT chk_assets_automation  CHECK (automation_mode IN ('suggest','auto_accept','off'))
);

CREATE INDEX idx_assets_org ON public.assets(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_venture ON public.assets(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assets_type ON public.assets(organization_id, asset_type) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read assets"
  ON public.assets FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members insert assets"
  ON public.assets FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update assets"
  ON public.assets FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete assets"
  ON public.assets FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────
-- signals: observations produced by Assets/Integrations
-- Skeleton table; full engine lands in a later milestone.
-- ─────────────────────────────────────────────
CREATE TABLE public.signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.integration_sources(id) ON DELETE SET NULL,
  content_item_id uuid REFERENCES public.ingested_content_items(id) ON DELETE SET NULL,
  signal_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text,
  significance text,
  status text NOT NULL DEFAULT 'new',
  dedup_key text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  detected_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_signals_severity CHECK (severity IN ('info','low','medium','high','critical')),
  CONSTRAINT chk_signals_status   CHECK (status IN ('new','triaged','acknowledged','resolved','dismissed','converted_to_knowledge'))
);

CREATE INDEX idx_signals_org ON public.signals(organization_id, detected_at DESC);
CREATE INDEX idx_signals_asset ON public.signals(asset_id, detected_at DESC);
CREATE INDEX idx_signals_status ON public.signals(organization_id, status) WHERE status IN ('new','triaged');
CREATE UNIQUE INDEX uq_signals_dedup ON public.signals(organization_id, dedup_key) WHERE dedup_key IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signals TO authenticated;
GRANT ALL ON public.signals TO service_role;

ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read signals"
  ON public.signals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Members insert signals"
  ON public.signals FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Members update signals"
  ON public.signals FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
CREATE POLICY "Admins delete signals"
  ON public.signals FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_signals_updated_at
  BEFORE UPDATE ON public.signals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────
-- Link existing integration_connections to Assets (additive)
-- ─────────────────────────────────────────────
ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_integration_connections_asset
  ON public.integration_connections(asset_id) WHERE asset_id IS NOT NULL;

-- Backfill: for each existing website connection, create a Website asset
-- and link it. Idempotent - only creates when asset_id is null.
DO $$
DECLARE
  c RECORD;
  new_asset_id uuid;
BEGIN
  FOR c IN
    SELECT id, organization_id, venture_id, display_name, homepage_url, automation_mode, status, created_at
    FROM public.integration_connections
    WHERE asset_id IS NULL AND provider = 'website' AND deleted_at IS NULL
  LOOP
    INSERT INTO public.assets(
      organization_id, venture_id, asset_type, display_name,
      description, status, automation_mode, metadata, last_activity_at, created_at
    ) VALUES (
      c.organization_id, c.venture_id, 'website', c.display_name,
      c.homepage_url,
      CASE WHEN c.status IN ('active','pending','error','disabled','archived') THEN
        CASE c.status WHEN 'archived' THEN 'archived' WHEN 'disabled' THEN 'paused' WHEN 'error' THEN 'error' ELSE 'active' END
      ELSE 'active' END,
      c.automation_mode,
      jsonb_build_object('backfilled_from_connection', c.id::text),
      c.created_at, c.created_at
    )
    RETURNING id INTO new_asset_id;

    UPDATE public.integration_connections SET asset_id = new_asset_id WHERE id = c.id;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- 3D.2b: change detection support fields on ingested_content_items
-- ─────────────────────────────────────────────
ALTER TABLE public.ingested_content_items
  ADD COLUMN IF NOT EXISTS current_version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_change_significance text,
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS classification_signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ingested_change_significance') THEN
    ALTER TABLE public.ingested_content_items
      ADD CONSTRAINT chk_ingested_change_significance
      CHECK (last_change_significance IS NULL OR last_change_significance IN ('none','minor','moderate','major'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ingested_content_items_asset
  ON public.ingested_content_items(asset_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ingested_content_items_freshness
  ON public.ingested_content_items(organization_id, freshness_status) WHERE deleted_at IS NULL;

ALTER TABLE public.ingested_content_versions
  ADD COLUMN IF NOT EXISTS change_significance text,
  ADD COLUMN IF NOT EXISTS diff_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_ingested_version_significance') THEN
    ALTER TABLE public.ingested_content_versions
      ADD CONSTRAINT chk_ingested_version_significance
      CHECK (change_significance IS NULL OR change_significance IN ('none','minor','moderate','major'));
  END IF;
END $$;