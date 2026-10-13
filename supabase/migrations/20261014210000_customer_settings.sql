-- What a customer needs from the settings to pay and to download their
-- documents: the business details, the bank details for transfers and the
-- terms. Only for people with a booking of their own, and never the email
-- settings (test mode, reply-to and so on).

create or replace function public.customer_settings()
returns table (
  business_name text,
  legal_name text,
  company_number text,
  contact_email text,
  phone text,
  address text,
  website text,
  facebook_url text,
  facebook_group_url text,
  instagram_url text,
  sign_off text,
  bank_name text,
  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,
  terms_text text,
  terms_version integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.business_name, s.legal_name, s.company_number, s.contact_email,
         s.phone, s.address, s.website, s.facebook_url, s.facebook_group_url,
         s.instagram_url, s.sign_off, s.bank_name, s.bank_account_name,
         s.bank_sort_code, s.bank_account_number, s.terms_text, s.terms_version
    from public.settings s
   where exists (
     select 1
       from public.bookings b
       join public.customers c on c.id = b.customer_id
      where c.user_id = (select auth.uid())
        and c.deleted_at is null
   );
$$;

revoke all on function public.customer_settings() from public, anon;
grant execute on function public.customer_settings() to authenticated, service_role;

-- Customers can always see the events they're booked on, and their options
-- (for their account), even one that isn't on the website, such as a draft.
create or replace function private.is_booked_on(event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.bookings b
      join public.customers c on c.id = b.customer_id
     where b.event_id = event
       and c.user_id = (select auth.uid())
       and c.deleted_at is null
  );
$$;

revoke all on function private.is_booked_on(uuid) from public;
grant execute on function private.is_booked_on(uuid) to authenticated, service_role;

create policy "Customers read the events they're booked on"
  on public.events for select
  to authenticated
  using (private.is_booked_on(id));

create policy "Customers read the options of events they're booked on"
  on public.ticket_types for select
  to authenticated
  using (private.is_booked_on(event_id));
