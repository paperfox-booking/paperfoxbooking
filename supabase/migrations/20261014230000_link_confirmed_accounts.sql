-- A person's record (with their bookings) is linked to a sign-in account
-- with the same email address only once that email address is confirmed,
-- so nobody can see someone else's bookings by signing up with their email.
-- (With customer sign-in by emailed code, signing in confirms the address.)

create or replace function private.link_customer_to_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email <> '' and exists (
    select 1 from auth.users u
     where u.id = new.id and u.email_confirmed_at is not null
  ) then
    update public.customers
       set user_id = new.id
     where email = lower(new.email)
       and user_id is null
       and deleted_at is null;
  end if;
  return new;
end;
$$;

-- When an account's email is confirmed, link it then.
create or replace function private.link_customer_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and old.email_confirmed_at is null
     and coalesce(new.email, '') <> '' then
    update public.customers
       set user_id = new.id
     where email = lower(new.email)
       and user_id is null
       and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function private.link_customer_on_confirm();
