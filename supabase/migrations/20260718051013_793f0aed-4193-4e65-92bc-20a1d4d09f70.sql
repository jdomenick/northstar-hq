
-- ============================================================
-- Meta infrastructure migration
-- ============================================================

-- 1) Content item state expansion
ALTER TABLE public.social_content_items
  DROP CONSTRAINT IF EXISTS social_content_items_status_check;

ALTER TABLE public.social_content_items
  ADD CONSTRAINT social_content_items_status_check
  CHECK (status = ANY (ARRAY[
    'idea','draft','generated','needs_review','changes_requested',
    'approved','scheduled','queued','publishing','processing_media',
    'pending_verification','published','failed','paused','cancelled',
    'archived','approval_revoked'
  ]));

ALTER TABLE public.social_content_items
  ADD COLUMN IF NOT EXISTS publish_generation integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS approval_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS approval_revoked_reason text;

-- 2) OAuth state
CREATE TABLE IF NOT EXISTS public.meta_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE SET NULL,
  state text NOT NULL UNIQUE,
  code_verifier text,
  redirect_uri text NOT NULL,
  requested_scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'connect' CHECK (purpose IN ('connect','reauthorize')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.meta_oauth_states TO authenticated;
GRANT ALL ON public.meta_oauth_states TO service_role;
ALTER TABLE public.meta_oauth_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY mos_select ON public.meta_oauth_states FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));

-- 3) Destinations (Facebook Pages / Instagram Business)
CREATE TABLE IF NOT EXISTS public.meta_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('facebook_page','instagram_business')),
  external_id text NOT NULL,
  display_name text NOT NULL,
  username text,
  connected_ig_id text,
  connected_fb_page_id text,
  granted_permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  page_tasks text[] NOT NULL DEFAULT ARRAY[]::text[],
  publish_available boolean NOT NULL DEFAULT false,
  insights_available boolean NOT NULL DEFAULT false,
  last_capability_check timestamptz,
  last_capability_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, kind, external_id)
);
GRANT SELECT ON public.meta_destinations TO authenticated;
GRANT ALL ON public.meta_destinations TO service_role;
ALTER TABLE public.meta_destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY md_select ON public.meta_destinations FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE TRIGGER md_set_updated_at BEFORE UPDATE ON public.meta_destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Encrypted page tokens (service role only)
CREATE TABLE IF NOT EXISTS public.meta_page_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  destination_id uuid NOT NULL REFERENCES public.meta_destinations(id) ON DELETE CASCADE,
  encrypted_token text NOT NULL,
  encryption_scheme text NOT NULL DEFAULT 'aes-256-gcm-v1',
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  obtained_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  last_refresh_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (destination_id)
);
-- NO authenticated grant. service_role only.
GRANT ALL ON public.meta_page_tokens TO service_role;
ALTER TABLE public.meta_page_tokens ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for authenticated: RLS + no grant = fully locked.

-- 5) Media delivery tokens (service role only for read; created server-side)
CREATE TABLE IF NOT EXISTS public.meta_media_delivery_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.content_media_assets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'ig_container' CHECK (purpose IN ('ig_container','fb_photo')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  delivered_bytes bigint,
  delivery_ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.meta_media_delivery_tokens TO service_role;
ALTER TABLE public.meta_media_delivery_tokens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS mmdt_token_idx ON public.meta_media_delivery_tokens(token) WHERE consumed_at IS NULL;
CREATE INDEX IF NOT EXISTS mmdt_expires_idx ON public.meta_media_delivery_tokens(expires_at);

-- 6) Publication history (durable per-attempt record)
CREATE TABLE IF NOT EXISTS public.content_publication_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  content_item_id uuid NOT NULL REFERENCES public.social_content_items(id) ON DELETE CASCADE,
  content_version_id uuid REFERENCES public.social_content_versions(id) ON DELETE SET NULL,
  destination_id uuid REFERENCES public.meta_destinations(id) ON DELETE SET NULL,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  provider text NOT NULL,
  api_version text NOT NULL,
  publish_generation integer NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('attempted','provider_ok','verified','failed','blocked')),
  provider_post_id text,
  provider_media_id text,
  permalink text,
  request_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_code text,
  error_message text,
  verified_at timestamptz,
  verification_response jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  automation_job_id uuid REFERENCES public.automation_jobs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);
GRANT SELECT ON public.content_publication_history TO authenticated;
GRANT ALL ON public.content_publication_history TO service_role;
ALTER TABLE public.content_publication_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY cph_select ON public.content_publication_history FOR SELECT TO authenticated
  USING (is_org_member(organization_id, auth.uid()));
CREATE TRIGGER cph_set_updated_at BEFORE UPDATE ON public.content_publication_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX IF NOT EXISTS cph_item_gen_idx ON public.content_publication_history(content_item_id, publish_generation);

-- 7) Approval-invalidation trigger
CREATE OR REPLACE FUNCTION public.sci_invalidate_approval_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  material_change boolean := false;
  reason_parts text[] := ARRAY[]::text[];
BEGIN
  -- Only revoke when already approved / scheduled / queued (not yet published)
  IF OLD.status NOT IN ('approved','scheduled','queued') THEN
    RETURN NEW;
  END IF;
  -- Skip if this update IS the revocation itself
  IF NEW.status = 'approval_revoked' THEN
    RETURN NEW;
  END IF;
  IF OLD.body IS DISTINCT FROM NEW.body THEN
    material_change := true; reason_parts := array_append(reason_parts, 'body');
  END IF;
  IF OLD.title IS DISTINCT FROM NEW.title OR OLD.final_title IS DISTINCT FROM NEW.final_title THEN
    material_change := true; reason_parts := array_append(reason_parts, 'title');
  END IF;
  IF OLD.hook IS DISTINCT FROM NEW.hook OR OLD.cta IS DISTINCT FROM NEW.cta THEN
    material_change := true; reason_parts := array_append(reason_parts, 'hook_or_cta');
  END IF;
  IF OLD.social_account_id IS DISTINCT FROM NEW.social_account_id THEN
    material_change := true; reason_parts := array_append(reason_parts, 'destination');
  END IF;
  IF OLD.scheduled_for IS DISTINCT FROM NEW.scheduled_for THEN
    -- Reschedule alone does NOT revoke; only if content also changed.
    NULL;
  END IF;
  IF material_change THEN
    NEW.status := 'approval_revoked';
    NEW.approval_revoked_at := now();
    NEW.approval_revoked_reason := 'material_change:' || array_to_string(reason_parts, ',');
    NEW.approval_status := 'revoked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sci_invalidate_approval ON public.social_content_items;
CREATE TRIGGER sci_invalidate_approval
  BEFORE UPDATE ON public.social_content_items
  FOR EACH ROW EXECUTE FUNCTION public.sci_invalidate_approval_on_change();
