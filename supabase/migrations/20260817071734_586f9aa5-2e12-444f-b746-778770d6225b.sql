DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'asset_types'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
  END LOOP;
END $$;

REVOKE ALL ON public.asset_types FROM anon;
GRANT SELECT ON public.asset_types TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

REVOKE EXECUTE ON FUNCTION public.nsl_default_organization_id() FROM authenticated;