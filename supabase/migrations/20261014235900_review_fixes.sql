-- Fixes from reviewing refunds and passing a place on.
--
-- 1. Two refunds recorded on one booking at the same moment could deadlock
--    (each adding its row holds a key share lock on the booking, then asks
--    for an update lock). The check now asks for a "no key update" lock,
--    which waits its turn instead.
-- 2. Someone given a place passed on to them comes off that event's waiting
--    list.
-- 3. A person added by the team is linked straight away to a sign-in account
--    with the same, confirmed, email address, as people who sign up later
--    already are.

create or replace function private.check_refunds_covered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid integer;
  refunded integer;
begin
  -- "No key update", not "update": adding a refund already holds a key
  -- share lock on the booking (for its foreign key), and two refunds at the
  -- same moment would otherwise each wait for the other.
  perform 1 from public.bookings b where b.id = new.booking_id for no key update;

  select coalesce(sum(p.amount_pence), 0)::integer into paid
    from public.payments p
   where p.booking_id = new.booking_id and p.deleted_at is null;
  select coalesce(sum(r.amount_pence), 0)::integer into refunded
    from public.refunds r
   where r.booking_id = new.booking_id and r.deleted_at is null;

  if refunded > paid then
    if tg_table_name = 'refunds' then
      raise exception 'That''s more than they''ve paid. The most you can refund is %.',
        private.format_pounds(greatest(paid - (refunded - new.amount_pence), 0));
    end if;
    raise exception 'This payment can''t be removed, because they''ve been refunded more than they''d then have paid. Remove the refund first.';
  end if;
  return null;
end;
$$;

create or replace function public.pass_place(
  booking_id uuid,
  new_customer_id uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  booking public.bookings%rowtype;
  old_name text;
  new_name text;
  note text;
  new_notes text;
begin
  if not (select private.has_staff_role(array['owner', 'admin']::public.staff_role[])) then
    raise exception 'Only owners and admins can pass a place on' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(pass_place.reason, ''))) not between 1 and 300 then
    raise exception 'Say why the place is being passed on, in 300 characters or fewer.';
  end if;

  select * into booking from public.bookings b
   where b.id = pass_place.booking_id
     for update;
  if not found then
    raise exception 'That booking couldn''t be found.';
  end if;
  if booking.cancelled_at is not null then
    raise exception 'This booking is cancelled, so its place can''t be passed on.';
  end if;
  if booking.customer_id = pass_place.new_customer_id then
    raise exception 'They already have this place.';
  end if;

  select c.full_name into new_name from public.customers c
   where c.id = pass_place.new_customer_id and c.deleted_at is null;
  if not found then
    raise exception 'That person couldn''t be found.';
  end if;
  if exists (
    select 1 from public.bookings b
     where b.event_id = booking.event_id
       and b.customer_id = pass_place.new_customer_id
       and b.cancelled_at is null
  ) then
    raise exception '% already has a place on this event.', new_name;
  end if;

  select c.full_name into old_name from public.customers c
   where c.id = booking.customer_id;
  note := format(
    'Place passed on from %s on %s: %s',
    old_name,
    to_char((now() at time zone 'Europe/London')::date, 'DD/MM/YYYY'),
    trim(pass_place.reason)
  );
  new_notes := case when booking.notes = '' then note else booking.notes || E'\n' || note end;
  if char_length(new_notes) > 2000 then
    raise exception 'The booking''s notes are too long to add this to. Shorten them first.';
  end if;

  update public.bookings b
     set customer_id = pass_place.new_customer_id,
         notes = new_notes,
         checked_in_at = null,
         checked_in_by = null
   where b.id = booking.id;

  -- They have a place now, so they're no longer waiting for one.
  update public.waitlist w
     set status = 'removed',
         notes = left(trim(both from w.notes || ' Given a place passed on from ' || old_name || '.'), 500)
   where w.event_id = booking.event_id
     and w.customer_id = pass_place.new_customer_id
     and w.status in ('waiting', 'offered');
end;
$$;

create or replace function private.link_new_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null and new.deleted_at is null and coalesce(new.email, '') <> '' then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = new.email
       and u.email_confirmed_at is not null
       and not exists (select 1 from public.customers c where c.user_id = u.id)
     limit 1;
  end if;
  return new;
end;
$$;

create trigger customers_link_account
  before insert or update of email on public.customers
  for each row execute function private.link_new_customer();
