drop policy if exists "Operators can view assessment requests" on public.nsl_assessment_requests;
drop policy if exists "Operators can update assessment requests" on public.nsl_assessment_requests;

create policy "Operators can view assessment requests"
on public.nsl_assessment_requests
for select to authenticated
using (public.is_org_member(organization_id, auth.uid()));

create policy "Operators can update assessment requests"
on public.nsl_assessment_requests
for update to authenticated
using (public.is_org_member(organization_id, auth.uid()))
with check (public.is_org_member(organization_id, auth.uid()));