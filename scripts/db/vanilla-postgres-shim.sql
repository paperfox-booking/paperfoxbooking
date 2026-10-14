-- A minimal stand-in for the parts of Supabase our migrations rely on, so the
-- database tests can run on plain PostgreSQL where Docker (and so the real
-- Supabase stack) isn't available.
--
-- Only scripts/db/reset-without-docker.sh uses this. Never run it against a
-- real Supabase database: Supabase already provides all of this. CI runs the
-- same migrations and tests against real Supabase, which is the source of truth.

-- The API roles Supabase creates.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

-- Lets the tests (connected as postgres) act as each API role.
grant anon, authenticated, service_role to postgres;

-- Supabase Auth's schema: just the columns our migrations and tests use.
create schema if not exists auth;

create table if not exists auth.users (
  instance_id uuid,
  id uuid primary key,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  email_confirmed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- How Supabase reads the signed-in user from the request's JWT claims.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.role', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
    ),
    ''
  )::text;
$$;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

-- Supabase's default privileges on the public schema (RLS then restricts rows).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
