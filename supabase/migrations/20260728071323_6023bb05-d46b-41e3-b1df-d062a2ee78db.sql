DROP POLICY IF EXISTS mos_select ON public.meta_oauth_states;
REVOKE SELECT ON public.meta_oauth_states FROM authenticated;
REVOKE SELECT ON public.meta_oauth_states FROM anon;
GRANT ALL ON public.meta_oauth_states TO service_role;