
CREATE OR REPLACE FUNCTION internal.set_scheduler_secret(_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = internal, extensions, public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'automation_scheduler_secret';
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(_secret, 'automation_scheduler_secret', 'header for /api/public/automation/tick');
  ELSE
    PERFORM vault.update_secret(v_id, _secret, 'automation_scheduler_secret', 'header for /api/public/automation/tick');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION internal.set_scheduler_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION internal.set_scheduler_secret(text) TO service_role;
