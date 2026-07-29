REVOKE EXECUTE ON FUNCTION public.is_client_account(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.client_account_client_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.client_account_org_id(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_client_identity_scope() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_client_account(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_account_client_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_account_org_id(uuid) TO authenticated, service_role;