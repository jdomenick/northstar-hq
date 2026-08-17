update public.nsl_assessment_requests
set organization_id = '1c7c4814-5b92-4ba9-bc20-a9c7f2eb573a'
where organization_id is null;

create or replace function public.nsl_default_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.organizations order by created_at asc, id asc limit 1;
$$;

revoke execute on function public.nsl_default_organization_id() from anon, authenticated;

alter table public.nsl_assessment_requests
  alter column organization_id set default public.nsl_default_organization_id();

create or replace function public.nsl_assessment_set_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is null then
    new.organization_id := public.nsl_default_organization_id();
  end if;
  return new;
end;
$$;

drop trigger if exists nsl_assessment_set_org_trg on public.nsl_assessment_requests;
create trigger nsl_assessment_set_org_trg
before insert on public.nsl_assessment_requests
for each row execute function public.nsl_assessment_set_org();

alter table public.nsl_assessment_requests
  alter column organization_id set not null;