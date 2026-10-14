-- An event's Facebook group link, joining details and class kits text are
-- for the team and the people booked on it. Until now any signed-in account
-- could read them (visitors couldn't); now:
--   * signed-in accounts read every other column of an event as before, but
--     not these three;
--   * public.event_private_details(event_ids) gives them to the team, and to
--     someone with a booking (not cancelled) on that event;
--   * the team still changes them as before.

revoke select on public.events from authenticated;
grant select (
  id, slug, title, summary, description, included, hotel_info, venue_id,
  starts_at, ends_at, status, capacity, booking_opens_at, booking_closes_at,
  balance_due_on, deposit_hold_days, copied_from_event_id, created_at,
  updated_at, created_by, deleted_at
) on public.events to authenticated;

create or replace function public.event_private_details(event_ids uuid[])
returns table (
  event_id uuid,
  facebook_group_url text,
  joining_info text,
  class_kits_info text
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.facebook_group_url, e.joining_info, e.class_kits_info
    from public.events e
   where e.id = any(event_private_details.event_ids)
     and ((select private.is_staff()) or private.is_booked_on(e.id));
$$;

revoke all on function public.event_private_details(uuid[]) from public, anon;
grant execute on function public.event_private_details(uuid[]) to authenticated, service_role;

-- Copying an event read the whole source event as the person copying it,
-- which those three columns no longer allow, so it now runs as the database
-- owner. It still checks first that they're an owner or admin, and still
-- doesn't copy the three.
create or replace function public.copy_event(
  source_event_id uuid,
  new_title text,
  new_starts_on date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source public.events%rowtype;
  shift_days integer;
  new_event_id uuid;
begin
  if not (select private.has_staff_role(array['owner', 'admin']::public.staff_role[])) then
    raise exception 'Only owners and admins can copy events' using errcode = '42501';
  end if;

  select * into source
  from public.events
  where id = source_event_id and deleted_at is null;
  if not found then
    raise exception 'That event couldn''t be found. It may have been deleted.';
  end if;

  shift_days := new_starts_on - (source.starts_at at time zone 'Europe/London')::date;

  insert into public.events (
    title, summary, description, included, hotel_info, venue_id,
    starts_at, ends_at, capacity, booking_opens_at, booking_closes_at,
    balance_due_on, deposit_hold_days, copied_from_event_id
  )
  values (
    trim(new_title), source.summary, source.description, source.included,
    source.hotel_info, source.venue_id,
    private.shift_uk_days(source.starts_at, shift_days),
    private.shift_uk_days(source.ends_at, shift_days),
    source.capacity,
    private.shift_uk_days(source.booking_opens_at, shift_days),
    private.shift_uk_days(source.booking_closes_at, shift_days),
    source.balance_due_on + shift_days,
    source.deposit_hold_days,
    source.id
  )
  returning id into new_event_id;

  insert into public.ticket_types (
    event_id, name, description, price_pence, deposit_pence, starts_at,
    capacity, sort_order, on_sale
  )
  select
    new_event_id, t.name, t.description, t.price_pence, t.deposit_pence,
    private.shift_uk_days(t.starts_at, shift_days), t.capacity, t.sort_order,
    t.on_sale
  from public.ticket_types t
  where t.event_id = source.id and t.deleted_at is null;

  insert into public.event_rooms (event_id, name, capacity, notes, sort_order)
  select new_event_id, r.name, r.capacity, r.notes, r.sort_order
  from public.event_rooms r
  where r.event_id = source.id and r.deleted_at is null;

  insert into public.event_costs (
    event_id, category, description, supplier, amount_pence, paid, notes, sort_order
  )
  select new_event_id, c.category, c.description, c.supplier, c.amount_pence,
         false, c.notes, c.sort_order
  from public.event_costs c
  where c.event_id = source.id and c.deleted_at is null;

  return new_event_id;
end;
$$;
