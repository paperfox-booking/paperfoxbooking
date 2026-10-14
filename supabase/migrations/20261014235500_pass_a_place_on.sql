-- Passing a place to someone else. The terms let a customer send a
-- replacement, with Paper Fox's written approval; any money is settled
-- privately between them. So the booking itself (its reference, option,
-- room, price and payments) moves to the new person, in one step.
--
-- Rules:
--   * only owners and admins can do it, and only for a booking that isn't
--     cancelled;
--   * the new person can't already have a place on the event;
--   * the reason is added to the booking's notes, with who it came from and
--     the date, and the change is in the audit log;
--   * if the first person had been checked in, that's undone.

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
end;
$$;

revoke all on function public.pass_place(uuid, uuid, text) from public, anon;
grant execute on function public.pass_place(uuid, uuid, text) to authenticated, service_role;
