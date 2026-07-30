CREATE OR REPLACE FUNCTION public.nsl_assessment_convert(
  _assessment_id uuid,
  _organization_id uuid,
  _existing_client_id uuid DEFAULT NULL,
  _company text DEFAULT NULL,
  _contact_name text DEFAULT NULL,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _website text DEFAULT NULL,
  _industry text DEFAULT NULL
)
RETURNS TABLE(client_id uuid, created boolean, idempotent boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _a public.nsl_assessment_requests%ROWTYPE;
  _uid uuid := auth.uid();
  _client uuid;
  _created boolean := false;
BEGIN
  IF _uid IS NULL OR NOT public.has_org_role(_organization_id, _uid, 'executive'::org_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO _a FROM public.nsl_assessment_requests WHERE id = _assessment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'assessment_not_found'; END IF;

  IF _a.revenue_client_id IS NOT NULL THEN
    RETURN QUERY SELECT _a.revenue_client_id, false, true;
    RETURN;
  END IF;

  IF _existing_client_id IS NOT NULL THEN
    SELECT id INTO _client FROM public.revenue_clients
      WHERE id = _existing_client_id AND organization_id = _organization_id;
    IF _client IS NULL THEN RAISE EXCEPTION 'client_not_found'; END IF;
  ELSE
    INSERT INTO public.revenue_clients (organization_id, name, status, created_by)
    VALUES (_organization_id, COALESCE(NULLIF(btrim(_company), ''), _a.company), 'onboarding'::client_status, _uid)
    RETURNING id INTO _client;
    _created := true;
  END IF;

  INSERT INTO public.client_company_profiles (
    organization_id, client_id, legal_business_name, primary_email, primary_phone,
    website_url, primary_contact_name, primary_contact_email, primary_contact_phone, updated_by
  ) VALUES (
    _organization_id, _client,
    COALESCE(NULLIF(btrim(_company), ''), _a.company),
    COALESCE(NULLIF(btrim(_email), ''), _a.email),
    NULLIF(btrim(COALESCE(_phone, _a.phone, '')), ''),
    NULLIF(btrim(COALESCE(_website, _a.website, '')), ''),
    COALESCE(NULLIF(btrim(_contact_name), ''), _a.full_name),
    COALESCE(NULLIF(btrim(_email), ''), _a.email),
    NULLIF(btrim(COALESCE(_phone, _a.phone, '')), ''),
    _uid
  )
  ON CONFLICT (client_id) DO NOTHING;

  UPDATE public.nsl_assessment_requests
     SET revenue_client_id = _client,
         organization_id = _organization_id,
         status = 'converted',
         converted_at = now(),
         converted_by = _uid,
         updated_at = now()
   WHERE id = _assessment_id;

  INSERT INTO public.activity_events (organization_id, actor_user_id, action, summary, entity_type, entity_id, metadata)
  VALUES (
    _organization_id, _uid, 'assessment.converted',
    'Assessment converted to revenue client', 'nsl_assessment_request', _assessment_id,
    jsonb_build_object('client_created', _created, 'industry', COALESCE(_industry, _a.industry))
  );

  RETURN QUERY SELECT _client, _created, false;
END;
$$;

REVOKE ALL ON FUNCTION public.nsl_assessment_convert(uuid,uuid,uuid,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nsl_assessment_convert(uuid,uuid,uuid,text,text,text,text,text,text) TO authenticated;