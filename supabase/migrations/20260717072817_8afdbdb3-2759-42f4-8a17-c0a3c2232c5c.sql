CREATE POLICY "Creators read newly created organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (created_by = auth.uid());