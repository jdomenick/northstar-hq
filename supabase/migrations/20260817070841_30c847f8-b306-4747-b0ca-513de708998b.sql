-- 1. Reasoning replay rows with no organization were readable by every signed-in user.
DROP POLICY IF EXISTS sam_reasoning_replays_admin_read ON public.sam_reasoning_replays;
CREATE POLICY sam_reasoning_replays_admin_read
  ON public.sam_reasoning_replays
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND has_org_role(organization_id, auth.uid(), 'admin'::org_role)
  );

-- 2. Privileged RPCs must not be callable straight from the Data API.
--    Server code invokes them with the service role.
REVOKE EXECUTE ON FUNCTION public.nsl_proposal_accept(text, text, text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nsl_default_organization_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.client_document_links_owned(uuid, uuid, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.shares_org_with(uuid, uuid) FROM anon;