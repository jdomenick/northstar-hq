CREATE TABLE public.social_oauth_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid REFERENCES public.ventures(id) ON DELETE CASCADE,
  platform text NOT NULL,
  state text NOT NULL UNIQUE,
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  requested_scopes text[] NOT NULL DEFAULT '{}',
  requested_by uuid,
  purpose text NOT NULL DEFAULT 'connect',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.social_oauth_states TO service_role;
ALTER TABLE public.social_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.social_oauth_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  venture_id uuid NOT NULL REFERENCES public.ventures(id) ON DELETE CASCADE,
  platform text NOT NULL,
  social_account_id uuid REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  external_account_id text,
  external_username text,
  external_display_name text,
  access_token_encrypted text NOT NULL,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  connected_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, venture_id, platform)
);

GRANT ALL ON public.social_oauth_credentials TO service_role;
ALTER TABLE public.social_oauth_credentials ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_social_oauth_states_expiry ON public.social_oauth_states (expires_at);
CREATE INDEX idx_social_oauth_credentials_scope ON public.social_oauth_credentials (organization_id, venture_id, platform);