-- Phase 3D.1: Integration + Content Ingestion foundation

-- ─────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────
CREATE TYPE public.integration_provider AS ENUM (
  'website', 'supabase', 'rest_api', 'webhook', 'csv_import', 'json_import', 'api_token', 'other'
);

CREATE TYPE public.integration_connection_status AS ENUM (
  'pending', 'active', 'error', 'disabled', 'archived'
);

CREATE TYPE public.integration_connection_type AS ENUM (
  'website', 'database', 'rest', 'webhook', 'file_import', 'api_token'
);

CREATE TYPE public.integration_source_type AS ENUM (
  'webpage', 'sitemap', 'blog', 'docs', 'db_table', 'rest_endpoint', 'webhook_topic', 'csv_file', 'json_file', 'manual', 'other'
);

CREATE TYPE public.integration_sync_status AS ENUM (
  'queued', 'running', 'succeeded', 'partial', 'failed', 'cancelled'
);

CREATE TYPE public.content_verification_status AS ENUM (
  'unverified', 'reviewed', 'verified', 'disputed', 'rejected'
);

CREATE TYPE public.content_freshness_status AS ENUM (
  'fresh', 'aging', 'stale', 'inaccessible', 'unknown'
);

-- ─────────────────────────────────────────────
-- integration_connections
-- ─────────────────────────────────────────────
CREATE TABLE public.integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  provider public.integration_provider NOT NULL,
  connection_type public.integration_connection_type NOT NULL,
  display_name text NOT NULL,
  status public.integration_connection_status NOT NULL DEFAULT 'pending',
  credentials_reference text,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at timestamptz,
  last_successful_sync_at timestamptz,
  next_cursor jsonb,
  last_error_code text,
  last_error_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_integration_connections_org ON public.integration_connections(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_connections_venture ON public.integration_connections(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_connections_status ON public.integration_connections(organization_id, status) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_connections TO authenticated;
GRANT ALL ON public.integration_connections TO service_role;

ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read integration connections"
  ON public.integration_connections FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members insert integration connections"
  ON public.integration_connections FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "Members update integration connections"
  ON public.integration_connections FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "Admins delete integration connections"
  ON public.integration_connections FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_integration_connections_updated_at
  BEFORE UPDATE ON public.integration_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────
-- integration_sources
-- ─────────────────────────────────────────────
CREATE TABLE public.integration_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  source_type public.integration_source_type NOT NULL,
  source_url text,
  external_id text,
  title text NOT NULL,
  category text,
  trust_level text NOT NULL DEFAULT 'unverified',
  sync_enabled boolean NOT NULL DEFAULT true,
  sync_frequency text NOT NULL DEFAULT 'manual',
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_integration_sources_org ON public.integration_sources(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_sources_venture ON public.integration_sources(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_integration_sources_connection ON public.integration_sources(connection_id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_sources TO authenticated;
GRANT ALL ON public.integration_sources TO service_role;

ALTER TABLE public.integration_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read integration sources"
  ON public.integration_sources FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members insert integration sources"
  ON public.integration_sources FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "Members update integration sources"
  ON public.integration_sources FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "Admins delete integration sources"
  ON public.integration_sources FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_integration_sources_updated_at
  BEFORE UPDATE ON public.integration_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────
-- integration_sync_runs
-- ─────────────────────────────────────────────
CREATE TABLE public.integration_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  source_id uuid REFERENCES public.integration_sources(id) ON DELETE SET NULL,
  status public.integration_sync_status NOT NULL DEFAULT 'queued',
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  trigger_type text NOT NULL DEFAULT 'manual',
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  records_discovered integer NOT NULL DEFAULT 0,
  records_created integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_skipped integer NOT NULL DEFAULT 0,
  records_failed integer NOT NULL DEFAULT 0,
  failure_code text,
  failure_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_sync_runs_org ON public.integration_sync_runs(organization_id, created_at DESC);
CREATE INDEX idx_integration_sync_runs_connection ON public.integration_sync_runs(connection_id, created_at DESC);
CREATE INDEX idx_integration_sync_runs_source ON public.integration_sync_runs(source_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.integration_sync_runs TO authenticated;
GRANT ALL ON public.integration_sync_runs TO service_role;

ALTER TABLE public.integration_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read integration sync runs"
  ON public.integration_sync_runs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members insert integration sync runs"
  ON public.integration_sync_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "Members update integration sync runs"
  ON public.integration_sync_runs FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

-- ─────────────────────────────────────────────
-- ingested_content_items
-- ─────────────────────────────────────────────
CREATE TABLE public.ingested_content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  source_id uuid REFERENCES public.integration_sources(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES public.integration_connections(id) ON DELETE SET NULL,
  source_type public.integration_source_type NOT NULL,
  external_id text,
  canonical_url text,
  title text NOT NULL,
  content_text text,
  content_summary text,
  content_hash text NOT NULL,
  published_at timestamptz,
  modified_at timestamptz,
  author text,
  category text,
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status public.content_verification_status NOT NULL DEFAULT 'unverified',
  freshness_status public.content_freshness_status NOT NULL DEFAULT 'fresh',
  review_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  last_ingested_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX idx_ingested_content_items_org ON public.ingested_content_items(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ingested_content_items_venture ON public.ingested_content_items(venture_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ingested_content_items_source ON public.ingested_content_items(source_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_ingested_content_items_verification ON public.ingested_content_items(organization_id, verification_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_ingested_content_items_review ON public.ingested_content_items(organization_id, review_status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX uq_ingested_content_items_source_external
  ON public.ingested_content_items(source_id, external_id)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ingested_content_items TO authenticated;
GRANT ALL ON public.ingested_content_items TO service_role;

ALTER TABLE public.ingested_content_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read ingested content"
  ON public.ingested_content_items FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members insert ingested content"
  ON public.ingested_content_items FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "Members update ingested content"
  ON public.ingested_content_items FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));

CREATE POLICY "Admins delete ingested content"
  ON public.ingested_content_items FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE TRIGGER trg_ingested_content_items_updated_at
  BEFORE UPDATE ON public.ingested_content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────
-- ingested_content_versions
-- ─────────────────────────────────────────────
CREATE TABLE public.ingested_content_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.ingested_content_items(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  content_hash text NOT NULL,
  title text,
  content_text text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  captured_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_item_id, version_number)
);

CREATE INDEX idx_ingested_content_versions_item ON public.ingested_content_versions(content_item_id, version_number DESC);
CREATE INDEX idx_ingested_content_versions_org ON public.ingested_content_versions(organization_id);

GRANT SELECT, INSERT ON public.ingested_content_versions TO authenticated;
GRANT ALL ON public.ingested_content_versions TO service_role;

ALTER TABLE public.ingested_content_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read ingested content versions"
  ON public.ingested_content_versions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Members insert ingested content versions"
  ON public.ingested_content_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'));
