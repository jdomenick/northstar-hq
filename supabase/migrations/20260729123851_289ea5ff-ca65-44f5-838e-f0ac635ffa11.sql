CREATE OR REPLACE FUNCTION public.nsl_proposal_accept(_token_hash text, _signer_name text, _signer_email text, _acknowledgement text, _ip text, _user_agent text)
 RETURNS TABLE(proposal_id uuid, accepted_at timestamp with time zone, idempotent boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  SELECT s.* INTO existing_sig FROM public.nsl_proposal_signatures s
    WHERE s.proposal_id = p.id AND lower(s.signer_email) = lower(_signer_email);
  IF FOUND THEN
    proposal_id := p.id;
    accepted_at := p.accepted_at;
    idempotent := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

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

  proposal_id := p.id;
  accepted_at := now();
  idempotent := FALSE;
  RETURN NEXT;
END;
$function$;