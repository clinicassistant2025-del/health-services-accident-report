-- HEALTH SERVICES ACCIDENT REPORTING SYSTEM
-- Run this in Supabase SQL Editor.
-- IMPORTANT: create the Storage bucket "accident-pictures" as PRIVATE.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  company text not null check (company in ('CGSI','CLMC','VFI','MVBI')),
  role text not null default 'encoder' check (role in ('encoder','admin')),
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.accidents (
  id uuid primary key default gen_random_uuid(),
  report_no bigint generated always as identity unique,
  company text not null check (company in ('CGSI','CLMC','VFI','MVBI')),
  accident_at timestamptz not null,
  place_of_accident text not null,
  reported_at timestamptz not null,
  employee_name text not null,
  age integer not null check (age between 0 and 120),
  sex text not null check (sex in ('Male','Female')),
  department text not null,
  nature_history text not null,
  intervention text not null,
  fit_to_work text not null check (fit_to_work in ('FIT','UNFIT','FOR FOLLOW-UP')),
  picture_path text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_company()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select company from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin')
$$;

alter table public.profiles enable row level security;
alter table public.accidents enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "accidents company read" on public.accidents;
create policy "accidents company read" on public.accidents
for select to authenticated
using (company = public.current_company() or public.is_admin());

drop policy if exists "accidents company insert" on public.accidents;
create policy "accidents company insert" on public.accidents
for insert to authenticated
with check ((company = public.current_company() and created_by = auth.uid()) or public.is_admin());

drop policy if exists "accidents company update" on public.accidents;
create policy "accidents company update" on public.accidents
for update to authenticated
using (company = public.current_company() or public.is_admin())
with check (company = public.current_company() or public.is_admin());

drop policy if exists "accidents company delete" on public.accidents;
create policy "accidents company delete" on public.accidents
for delete to authenticated
using (company = public.current_company() or public.is_admin());

grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.accidents to authenticated;

-- Auto-create a profile if a user is created with user metadata:
-- { "username":"john", "company":"MVBI", "role":"encoder", "full_name":"John Melvic" }
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id,username,company,role,full_name)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    upper(coalesce(new.raw_user_meta_data->>'company','MVBI')),
    coalesce(new.raw_user_meta_data->>'role','encoder'),
    new.raw_user_meta_data->>'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- STORAGE
-- Create the bucket in Dashboard > Storage:
-- Name: accident-pictures
-- Public: OFF / Private

drop policy if exists "accident pictures read by company" on storage.objects;
create policy "accident pictures read by company"
on storage.objects for select to authenticated
using (
  bucket_id='accident-pictures'
  and (
    (storage.foldername(name))[1] = public.current_company()
    or public.is_admin()
  )
);

drop policy if exists "accident pictures upload by company" on storage.objects;
create policy "accident pictures upload by company"
on storage.objects for insert to authenticated
with check (
  bucket_id='accident-pictures'
  and (
    (storage.foldername(name))[1] = public.current_company()
    or public.is_admin()
  )
);

drop policy if exists "accident pictures update by company" on storage.objects;
create policy "accident pictures update by company"
on storage.objects for update to authenticated
using (
  bucket_id='accident-pictures'
  and (
    (storage.foldername(name))[1] = public.current_company()
    or public.is_admin()
  )
)
with check (
  bucket_id='accident-pictures'
  and (
    (storage.foldername(name))[1] = public.current_company()
    or public.is_admin()
  )
);

drop policy if exists "accident pictures delete by company" on storage.objects;
create policy "accident pictures delete by company"
on storage.objects for delete to authenticated
using (
  bucket_id='accident-pictures'
  and (
    (storage.foldername(name))[1] = public.current_company()
    or public.is_admin()
  )
);
