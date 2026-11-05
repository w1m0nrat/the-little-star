-- THE LITTLE STAR / Celestial Lupus
-- Run in Supabase SQL Editor. Review before applying to an existing project.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  recovery_email text,
  display_name text,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  archive_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  star_code text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.clues (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid references public.missions(id) on delete cascade,
  clue_order integer not null default 1,
  clue_text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  content_key text not null unique,
  content_value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, recovery_email, display_name)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username','')),
    nullif(new.raw_user_meta_data->>'recovery_email',''),
    nullif(new.raw_user_meta_data->>'display_name','')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only an administrator can change account roles';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute procedure public.prevent_role_escalation();

alter table public.profiles enable row level security;
alter table public.wishes enable row level security;
alter table public.events enable row level security;
alter table public.missions enable row level security;
alter table public.clues enable row level security;
alter table public.site_content enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profile self update" on public.profiles;
create policy "profile self update" on public.profiles
for update to authenticated using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists "wish owner read or admin" on public.wishes;
create policy "wish owner read or admin" on public.wishes
for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "wish owner insert" on public.wishes;
create policy "wish owner insert" on public.wishes
for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "wish owner update or admin" on public.wishes;
create policy "wish owner update or admin" on public.wishes
for update to authenticated using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "wish owner delete or admin" on public.wishes;
create policy "wish owner delete or admin" on public.wishes
for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "published events read" on public.events;
create policy "published events read" on public.events
for select to anon, authenticated using (is_published or public.is_admin());
drop policy if exists "admin manage events" on public.events;
create policy "admin manage events" on public.events
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "published missions read" on public.missions;
create policy "published missions read" on public.missions
for select to anon, authenticated using (is_published or public.is_admin());
drop policy if exists "admin manage missions" on public.missions;
create policy "admin manage missions" on public.missions
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "clues read by admin only" on public.clues;
create policy "clues read by admin only" on public.clues
for select to authenticated using (public.is_admin());
drop policy if exists "admin manage clues" on public.clues;
create policy "admin manage clues" on public.clues
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "published site content read" on public.site_content;
create policy "published site content read" on public.site_content
for select to anon, authenticated using (true);
drop policy if exists "admin manage site content" on public.site_content;
create policy "admin manage site content" on public.site_content
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "audit logs admin read" on public.audit_logs;
create policy "audit logs admin read" on public.audit_logs
for select to authenticated using (public.is_admin());
drop policy if exists "audit logs admin insert" on public.audit_logs;
create policy "audit logs admin insert" on public.audit_logs
for insert to authenticated with check (public.is_admin());

grant usage on schema public to anon, authenticated;
grant select on public.events, public.missions, public.site_content to anon, authenticated;
grant select, insert, update, delete on public.wishes to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.clues, public.audit_logs to authenticated;
grant insert, update, delete on public.events, public.missions, public.clues, public.site_content, public.audit_logs to authenticated;

-- IMPORTANT: create the first admin role manually from trusted SQL after registering
-- the intended owner account. Never expose service_role or database credentials.
-- update public.profiles set role = 'admin' where username = 'YOUR_OWNER_USERNAME';
