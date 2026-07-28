-- === NorthStar Labs Proposal Management System ===
-- Enum
CREATE TYPE public.nsl_proposal_status AS ENUM (
  'draft','internal_review','approved','ready_to_send','sent','viewed',
  'accepted','declined','expired','superseded','cancelled'
);

-- === Table: nsl_proposals ===
CREATE TABLE public.nsl_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.revenue_clients(id) ON DELETE RESTRICT,
  pipeline_id UUID REFERENCES public.revenue_pipeline(id) ON DELETE SET NULL,
  proposal_number TEXT NOT NULL,
  title TEXT NOT NULL,
  executive_summary TEXT DEFAULT '',
  business_overview TEXT DEFAULT '',
  current_challenges TEXT DEFAULT '',
  assessment_summary TEXT DEFAULT '',
  growth_opportunities TEXT DEFAULT '',
  recommended_strategy TEXT DEFAULT '',
  recommended_services TEXT DEFAULT '',
  deliverables TEXT DEFAULT '',
  implementation_timeline TEXT DEFAULT '',
  investment_summary TEXT DEFAULT '',
  payment_schedule TEXT DEFAULT '',
  terms TEXT DEFAULT '',
  status public.nsl_proposal_status NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  total_value_cents BIGINT NOT NULL DEFAULT 0,
  setup_fee_cents BIGINT NOT NULL DEFAULT 0,
  recurring_fee_cents BIGINT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  public_token_hash TEXT,
  public_token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, proposal_number)
);
CREATE INDEX nsl_proposals_org_idx ON public.nsl_proposals (organization_id, status, created_at DESC);
CREATE INDEX nsl_proposals_client_idx ON public.nsl_proposals (client_id);
CREATE UNIQUE INDEX nsl_proposals_token_hash_idx
  ON public.nsl_proposals (public_token_hash)
  WHERE public_token_hash IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nsl_proposals TO authenticated;
GRANT ALL ON public.nsl_proposals TO service_role;
ALTER TABLE public.nsl_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY nsl_proposals_select ON public.nsl_proposals FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY nsl_proposals_insert ON public.nsl_proposals FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY nsl_proposals_update ON public.nsl_proposals FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY nsl_proposals_delete ON public.nsl_proposals FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));

-- Lock + scope validation trigger
CREATE OR REPLACE FUNCTION public.nsl_proposals_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cli_org UUID; pip_org UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.locked_at IS NOT NULL AND current_user <> 'service_role' THEN
    -- allow only lock-consistent metadata updates? Simpler: block all non-service_role updates.
    RAISE EXCEPTION 'proposal is locked';
  END IF;
  SELECT organization_id INTO cli_org FROM public.revenue_clients WHERE id = NEW.client_id;
  IF cli_org IS NULL OR cli_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'client must belong to proposal organization';
  END IF;
  IF NEW.pipeline_id IS NOT NULL THEN
    SELECT organization_id INTO pip_org FROM public.revenue_pipeline WHERE id = NEW.pipeline_id;
    IF pip_org IS NULL OR pip_org <> NEW.organization_id THEN
      RAISE EXCEPTION 'pipeline must belong to proposal organization';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nsl_proposals_guard_ins BEFORE INSERT ON public.nsl_proposals
  FOR EACH ROW EXECUTE FUNCTION public.nsl_proposals_guard();
CREATE TRIGGER nsl_proposals_guard_upd BEFORE UPDATE ON public.nsl_proposals
  FOR EACH ROW EXECUTE FUNCTION public.nsl_proposals_guard();
CREATE TRIGGER nsl_proposals_touch BEFORE UPDATE ON public.nsl_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === Table: nsl_proposal_versions ===
CREATE TABLE public.nsl_proposal_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.nsl_proposals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, version)
);
CREATE INDEX nsl_proposal_versions_proposal_idx
  ON public.nsl_proposal_versions (proposal_id, version DESC);

GRANT SELECT, INSERT ON public.nsl_proposal_versions TO authenticated;
GRANT ALL ON public.nsl_proposal_versions TO service_role;
ALTER TABLE public.nsl_proposal_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY nsl_proposal_versions_select ON public.nsl_proposal_versions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY nsl_proposal_versions_insert ON public.nsl_proposal_versions FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));

-- === Table: nsl_proposal_activity ===
CREATE TABLE public.nsl_proposal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.nsl_proposals(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'user',
  actor_id UUID,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nsl_proposal_activity_proposal_idx
  ON public.nsl_proposal_activity (proposal_id, created_at DESC);

GRANT SELECT, INSERT ON public.nsl_proposal_activity TO authenticated;
GRANT ALL ON public.nsl_proposal_activity TO service_role;
ALTER TABLE public.nsl_proposal_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY nsl_proposal_activity_select ON public.nsl_proposal_activity FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY nsl_proposal_activity_insert ON public.nsl_proposal_activity FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role));

-- === Table: nsl_proposal_signatures ===
CREATE TABLE public.nsl_proposal_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.nsl_proposals(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  acknowledgement TEXT NOT NULL,
  proposal_version INTEGER NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, signer_email)
);
CREATE INDEX nsl_proposal_signatures_proposal_idx
  ON public.nsl_proposal_signatures (proposal_id);

GRANT SELECT ON public.nsl_proposal_signatures TO authenticated;
GRANT ALL ON public.nsl_proposal_signatures TO service_role;
ALTER TABLE public.nsl_proposal_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY nsl_proposal_signatures_select ON public.nsl_proposal_signatures FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
-- No authenticated INSERT policy; only service_role (public accept RPC) writes.

-- === Table: nsl_proposal_comments (internal only) ===
CREATE TABLE public.nsl_proposal_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id UUID NOT NULL REFERENCES public.nsl_proposals(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX nsl_proposal_comments_proposal_idx
  ON public.nsl_proposal_comments (proposal_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nsl_proposal_comments TO authenticated;
GRANT ALL ON public.nsl_proposal_comments TO service_role;
ALTER TABLE public.nsl_proposal_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY nsl_proposal_comments_select ON public.nsl_proposal_comments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY nsl_proposal_comments_insert ON public.nsl_proposal_comments FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), 'member'::org_role)
              AND author_id = auth.uid());
CREATE POLICY nsl_proposal_comments_update ON public.nsl_proposal_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
CREATE POLICY nsl_proposal_comments_delete ON public.nsl_proposal_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_org_role(organization_id, auth.uid(), 'admin'::org_role));
CREATE TRIGGER nsl_proposal_comments_touch BEFORE UPDATE ON public.nsl_proposal_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- === Atomic acceptance RPC ===
-- Runs in a single transaction. Idempotent by (proposal_id, signer_email).
-- Called from the public server route with a validated token_hash.
CREATE OR REPLACE FUNCTION public.nsl_proposal_accept(
  _token_hash TEXT,
  _signer_name TEXT,
  _signer_email TEXT,
  _acknowledgement TEXT,
  _ip TEXT,
  _user_agent TEXT
) RETURNS TABLE (proposal_id UUID, accepted_at TIMESTAMPTZ, idempotent BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD;
  existing_sig RECORD;
BEGIN
  IF _token_hash IS NULL OR length(_token_hash) < 32 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF _signer_name IS NULL OR length(btrim(_signer_name)) = 0 THEN
    RAISE EXCEPTION 'signer_name_required';
  END IF;
  IF _signer_email IS NULL OR _signer_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RAISE EXCEPTION 'signer_email_invalid';
  END IF;
  IF _acknowledgement IS NULL OR length(btrim(_acknowledgement)) < 3 THEN
    RAISE EXCEPTION 'acknowledgement_required';
  END IF;

  SELECT * INTO p FROM public.nsl_proposals
   WHERE public_token_hash = _token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF p.public_token_expires_at IS NOT NULL AND p.public_token_expires_at < now() THEN
    RAISE EXCEPTION 'token_expired';
  END IF;
  IF p.status IN ('declined','cancelled','superseded','expired') THEN
    RAISE EXCEPTION 'not_acceptable';
  END IF;

  -- Idempotent path: this signer already accepted.
  SELECT * INTO existing_sig FROM public.nsl_proposal_signatures
    WHERE proposal_id = p.id AND lower(signer_email) = lower(_signer_email);
  IF FOUND THEN
    RETURN QUERY SELECT p.id, p.accepted_at, TRUE;
    RETURN;
  END IF;

  -- Already accepted by someone else -> block additional signatures.
  IF p.status = 'accepted' OR p.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'already_accepted';
  END IF;

  INSERT INTO public.nsl_proposal_signatures
    (organization_id, proposal_id, signer_name, signer_email, ip_address, user_agent, acknowledgement, proposal_version)
  VALUES
    (p.organization_id, p.id, btrim(_signer_name), lower(_signer_email), _ip, _user_agent, _acknowledgement, p.version);

  UPDATE public.nsl_proposals
     SET status = 'accepted',
         accepted_at = now(),
         locked_at = now(),
         updated_at = now()
   WHERE id = p.id;

  INSERT INTO public.nsl_proposal_activity
    (organization_id, proposal_id, action, actor_type, notes, metadata)
  VALUES
    (p.organization_id, p.id, 'accepted', 'client',
     'Client accepted proposal',
     jsonb_build_object('signer_email', lower(_signer_email), 'version', p.version));

  RETURN QUERY SELECT p.id, now()::timestamptz, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.nsl_proposal_accept(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nsl_proposal_accept(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;
