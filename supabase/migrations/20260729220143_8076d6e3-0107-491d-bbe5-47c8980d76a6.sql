CREATE OR REPLACE FUNCTION public.client_workspace_events_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_client_account(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'client accounts cannot change activity records';
  END IF;
  IF NEW.event_type NOT IN ('onboarding_item_submitted', 'document_uploaded') THEN
    RAISE EXCEPTION 'invalid client activity type';
  END IF;
  NEW.is_notice := false;
  NEW.invoice_id := NULL;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.client_workspace_events_guard() FROM anon, public;

CREATE TRIGGER cwe_client_guard BEFORE INSERT OR UPDATE OR DELETE ON public.client_workspace_events
  FOR EACH ROW EXECUTE FUNCTION public.client_workspace_events_guard();

CREATE POLICY cwe_client_insert ON public.client_workspace_events
  FOR INSERT TO authenticated
  WITH CHECK (client_id = public.client_account_client_id(auth.uid())
              AND organization_id = public.client_account_org_id(auth.uid())
              AND event_type IN ('onboarding_item_submitted', 'document_uploaded'));