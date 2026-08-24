CREATE OR REPLACE FUNCTION public.get_reporting_secret()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'northstar_reporting_secret'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_reporting_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_reporting_secret() FROM anon;
REVOKE ALL ON FUNCTION public.get_reporting_secret() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_reporting_secret() TO service_role;