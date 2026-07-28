DROP POLICY IF EXISTS sam_missions_insert ON public.sam_missions;
DROP POLICY IF EXISTS sam_missions_update ON public.sam_missions;
CREATE POLICY sam_missions_insert ON public.sam_missions FOR INSERT TO authenticated
  WITH CHECK (has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY sam_missions_update ON public.sam_missions FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (has_org_role(organization_id, auth.uid(), 'member'::org_role));

DROP POLICY IF EXISTS sam_work_items_insert ON public.sam_mission_work_items;
DROP POLICY IF EXISTS sam_work_items_update ON public.sam_mission_work_items;
CREATE POLICY sam_work_items_insert ON public.sam_mission_work_items FOR INSERT TO authenticated
  WITH CHECK (has_org_role(organization_id, auth.uid(), 'member'::org_role));
CREATE POLICY sam_work_items_update ON public.sam_mission_work_items FOR UPDATE TO authenticated
  USING (has_org_role(organization_id, auth.uid(), 'member'::org_role))
  WITH CHECK (has_org_role(organization_id, auth.uid(), 'member'::org_role));