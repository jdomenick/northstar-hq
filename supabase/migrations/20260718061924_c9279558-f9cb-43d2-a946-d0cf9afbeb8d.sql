alter table public.profiles
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists pronouns text,
  add column if not exists links jsonb not null default '{}'::jsonb;