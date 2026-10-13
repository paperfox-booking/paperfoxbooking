-- Phase 0 foundations: customer profiles, staff roles and the row level
-- security that keeps each customer's details private.
--
-- Rules (CLAUDE.md sections 2, 3 and 8):
--   * a customer can only read and change their own profile;
--   * staff (owner, admin, door) can read profiles to look people up;
--   * only owners and admins can change someone else's profile;
--   * only owners can add, change or remove staff;
--   * there must always be at least one owner.

-- Helpers that RLS policies call live in a schema the API doesn't expose.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

-- Keeps updated_at current on every table that has one.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles: one per signed-in person, created automatically.
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Copied from auth.users so staff can search by email. Only the trigger
  -- below changes it: people change their email through sign-in.
  email text not null,
  full_name text,
  phone text,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  -- How consent was given or withdrawn, for example 'booking_form',
  -- 'account_page' or 'staff'.
  marketing_consent_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 200),
  constraint profiles_phone_length check (phone is null or char_length(phone) <= 40),
  constraint profiles_consent_recorded check (
    not marketing_consent
    or (marketing_consent_at is not null and marketing_consent_source is not null)
  )
);

comment on table public.profiles is
  'One row per person who has signed in (customers and staff). Personal data: RLS protected.';

create index profiles_email_idx on public.profiles (lower(email));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Stamp the time whenever marketing consent changes, so it can't be forgotten.
create or replace function private.stamp_marketing_consent()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.marketing_consent is distinct from old.marketing_consent then
    if new.marketing_consent or tg_op = 'UPDATE' then
      new.marketing_consent_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_stamp_marketing_consent
  before insert or update of marketing_consent on public.profiles
  for each row execute function private.stamp_marketing_consent();

-- Create a profile whenever Supabase Auth creates a user, and keep the email
-- in step when it changes.
create or replace function private.handle_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, email, full_name)
    values (
      new.id,
      coalesce(new.email, ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
    );
  elsif new.email is distinct from old.email then
    update public.profiles set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_auth_user_change();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.handle_auth_user_change();

-- ---------------------------------------------------------------------------
-- Staff: the Paper Fox team and what each person may do.
-- ---------------------------------------------------------------------------

create type public.staff_role as enum ('owner', 'admin', 'door');

create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);

comment on table public.staff is
  'Paper Fox team members and their role. Only owners can change it.';

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function private.set_updated_at();

-- The signed-in person's staff role, or null for customers. Security definer
-- so policies on other tables can call it without granting access to staff.
create or replace function private.current_staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select s.role from public.staff s where s.user_id = (select auth.uid());
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()));
$$;

create or replace function private.has_staff_role(roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where s.user_id = (select auth.uid()) and s.role = any (roles)
  );
$$;

revoke all on function private.current_staff_role() from public;
revoke all on function private.is_staff() from public;
revoke all on function private.has_staff_role(public.staff_role[]) from public;
grant execute on function private.current_staff_role() to authenticated, service_role;
grant execute on function private.is_staff() to authenticated, service_role;
grant execute on function private.has_staff_role(public.staff_role[]) to authenticated, service_role;

-- Never leave Paper Fox without an owner: refuse to remove or demote the last one.
create or replace function private.keep_an_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Two owners removing each other at the same moment must not both succeed.
  perform pg_advisory_xact_lock(hashtextextended('paperfox.staff.keep_an_owner', 0));
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.staff s where s.role = 'owner' and s.user_id <> old.user_id
     ) then
    raise exception 'There must always be at least one owner'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger staff_keep_an_owner
  before update of role or delete on public.staff
  for each row execute function private.keep_an_owner();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.staff enable row level security;

-- Visitors who aren't signed in get nothing from these tables.
revoke all on public.profiles from anon;
revoke all on public.staff from anon;

-- Signed-in people may only change these profile columns (RLS then decides
-- whose rows). Email and id are managed by sign-in, never directly.
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, marketing_consent, marketing_consent_source)
  on public.profiles to authenticated;

create policy "People read their own profile; staff read all"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select private.is_staff()));

create policy "People update their own profile; owners and admins update any"
  on public.profiles for update
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.has_staff_role(array['owner', 'admin']::public.staff_role[]))
  )
  with check (
    id = (select auth.uid())
    or (select private.has_staff_role(array['owner', 'admin']::public.staff_role[]))
  );

revoke all on public.staff from authenticated;
grant select, insert, update, delete on public.staff to authenticated;

create policy "Staff read their own row; owners read the whole team"
  on public.staff for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_staff_role(array['owner']::public.staff_role[]))
  );

create policy "Only owners add team members"
  on public.staff for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner']::public.staff_role[])));

create policy "Only owners change roles"
  on public.staff for update
  to authenticated
  using ((select private.has_staff_role(array['owner']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner']::public.staff_role[])));

create policy "Only owners remove team members"
  on public.staff for delete
  to authenticated
  using ((select private.has_staff_role(array['owner']::public.staff_role[])));
