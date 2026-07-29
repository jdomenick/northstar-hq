-- Client identity foundation

CREATE TYPE public.client_account_role AS ENUM ('client_admin','client_user');
CREATE TYPE public.client_account_status AS ENUM ('active','deactivated');

CREATE TABLE public.client_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  phone text,
  preferred_contact_method text NOT NULL DEFAULT 'email',
  role public.client_account_role NOT NULL DEFAULT 'client_user',
  status public.client_account_status NOT NULL DEFAULT 'active',
  last_login_at timestamptz,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_accounts_user_unique UNIQUE (user_id),
  CONSTRAINT client_accounts_contact_method_chk
    CHECK (preferred_contact_method IN ('email','phone','sms'))
);
CREATE INDEX client_accounts_client_idx ON public.client_accounts(client_id);
CREATE INDEX client_accounts_org_idx ON public.client_accounts(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_accounts TO authenticated;
GRANT ALL ON public.client_accounts TO service_role;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.revenue_clients(id) ON DELETE CASCADE,
  email text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  role public.client_account_role NOT NULL DEFAULT 'client_user',
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_account_id uuid REFERENCES public.client_accounts(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_invitations_client_idx ON public.client_invitations(client_id);
CREATE INDEX client_invitations_org_idx ON public.client_invitations(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_invitations TO authenticated;
GRANT ALL ON public.client_invitations TO service_role;
ALTER TABLE public.client_invitations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.client_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.revenue_clients(id) ON DELETE SET NULL,
  client_account_id uuid REFERENCES public.client_accounts(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.client_invitations(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX client_audit_events_client_idx ON public.client_audit_events(client_id, created_at DESC);

GRANT SELECT ON public.client_audit_events TO authenticated;
GRANT ALL ON public.client_audit_events TO service_role;
ALTER TABLE public.client_audit_events ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer, avoid recursive policy lookups)
CREATE OR REPLACE FUNCTION public.is_client_account(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_accounts
                 WHERE user_id = _user AND status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.client_account_client_id(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.client_accounts
  WHERE user_id = _user AND status = 'active' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.client_account_org_id(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.client_accounts
  WHERE user_id = _user AND status = 'active' LIMIT 1;
$$;

-- Policies: client_accounts
CREATE POLICY "operators read client accounts" ON public.client_accounts
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "client reads own account" ON public.client_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "org admins insert client accounts" ON public.client_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "org admins update client accounts" ON public.client_accounts
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "org admins delete client accounts" ON public.client_accounts
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- Policies: client_invitations (operators only; acceptance runs server-side)
CREATE POLICY "operators read client invitations" ON public.client_invitations
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "org admins insert client invitations" ON public.client_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "org admins update client invitations" ON public.client_invitations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'admin'));

CREATE POLICY "org admins delete client invitations" ON public.client_invitations
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'));

-- Policies: client_audit_events (operator read only; writes via service role)
CREATE POLICY "operators read client audit" ON public.client_audit_events
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

-- updated_at triggers
CREATE TRIGGER client_accounts_set_updated_at
  BEFORE UPDATE ON public.client_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER client_invitations_set_updated_at
  BEFORE UPDATE ON public.client_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Scope validation: client must belong to the invitation/account organization
CREATE OR REPLACE FUNCTION public.validate_client_identity_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref_org uuid;
BEGIN
  SELECT organization_id INTO ref_org FROM public.revenue_clients WHERE id = NEW.client_id;
  IF ref_org IS NULL OR ref_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'client must belong to the given organization';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER client_accounts_scope
  BEFORE INSERT OR UPDATE ON public.client_accounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_identity_scope();

CREATE TRIGGER client_invitations_scope
  BEFORE INSERT OR UPDATE ON public.client_invitations
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_identity_scope();