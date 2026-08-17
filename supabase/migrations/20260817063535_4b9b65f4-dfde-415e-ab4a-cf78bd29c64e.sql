-- 1. Deterministic client identity resolution.
create unique index if not exists client_accounts_one_active_per_user
  on public.client_accounts (user_id)
  where status = 'active';

create or replace function public.client_account_client_id(_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select client_id from public.client_accounts
  where user_id = _user and status = 'active'
  order by created_at asc, id asc
  limit 1;
$$;

create or replace function public.client_account_org_id(_user uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.client_accounts
  where user_id = _user and status = 'active'
  order by created_at asc, id asc
  limit 1;
$$;

-- 2. Client document association ownership validation.
create or replace function public.client_document_links_owned(
  _client_id uuid,
  _onboarding_item_id uuid,
  _milestone_id uuid,
  _project_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (_onboarding_item_id is null or exists (
      select 1 from public.client_onboarding_items i
      where i.id = _onboarding_item_id and i.client_id = _client_id
    ))
    and (_milestone_id is null or exists (
      select 1 from public.client_delivery_milestones m
      join public.projects p on p.id = m.project_id
      where m.id = _milestone_id and p.client_id = _client_id
    ))
    and (_project_id is null or exists (
      select 1 from public.projects p
      where p.id = _project_id and p.client_id = _client_id
    ));
$$;

drop policy if exists cd_client_insert on public.client_documents;
create policy cd_client_insert on public.client_documents
for insert to authenticated
with check (
  client_id = public.client_account_client_id(auth.uid())
  and organization_id = public.client_account_org_id(auth.uid())
  and visibility = 'client_uploaded'::client_document_visibility
  and is_deliverable is not true
  and public.client_document_links_owned(client_id, onboarding_item_id, milestone_id, project_id)
);

drop policy if exists cd_client_update on public.client_documents;
create policy cd_client_update on public.client_documents
for update to authenticated
using (
  client_id = public.client_account_client_id(auth.uid())
  and organization_id = public.client_account_org_id(auth.uid())
  and visibility <> 'internal_only'::client_document_visibility
)
with check (
  client_id = public.client_account_client_id(auth.uid())
  and organization_id = public.client_account_org_id(auth.uid())
  and visibility <> 'internal_only'::client_document_visibility
  and public.client_document_links_owned(client_id, onboarding_item_id, milestone_id, project_id)
);

revoke execute on function public.client_document_links_owned(uuid, uuid, uuid, uuid) from anon;