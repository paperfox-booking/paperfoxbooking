-- The waiting list: when an event is full, people join a reserve list in
-- order. When a place comes up, staff offer it to someone for a few days;
-- if they accept, staff book them in, which takes a place like any booking
-- (so the event still can't be overbooked).
--
-- Rules:
--   * owners and admins can see and change the waiting list; door staff and
--     customers can't (yet);
--   * someone can only be waiting (or offered a place) once per event;
--   * booking someone in from the list happens in one step, all or nothing;
--   * changes are audited.

create type public.waitlist_status as enum ('waiting', 'offered', 'booked', 'declined', 'removed');

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  -- The option they'd like, if they said.
  ticket_type_id uuid,
  notes text not null default '',
  status public.waitlist_status not null default 'waiting',
  offered_at timestamptz,
  -- The last day they have to accept the place offered.
  offer_expires_on date,
  booking_id uuid references public.bookings (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  constraint waitlist_option_same_event foreign key (ticket_type_id, event_id)
    references public.ticket_types (id, event_id),
  constraint waitlist_notes_length check (char_length(notes) <= 500),
  constraint waitlist_offer_dates check (
    (status = 'offered') = (offered_at is not null and offer_expires_on is not null)
    or status in ('booked', 'declined', 'removed')
  ),
  constraint waitlist_booked_has_booking check ((status = 'booked') = (booking_id is not null))
);

comment on table public.waitlist is
  'People waiting for a place on a full event, in the order they joined. Owners and admins only.';

create unique index waitlist_once_per_event
  on public.waitlist (event_id, customer_id)
  where status in ('waiting', 'offered');
create index waitlist_event_idx on public.waitlist (event_id, created_at);

create trigger waitlist_set_updated_at
  before update on public.waitlist
  for each row execute function private.set_updated_at();

create trigger waitlist_audit
  after insert or update or delete on public.waitlist
  for each row execute function private.record_change();

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant select on public.waitlist to authenticated;
grant insert (event_id, customer_id, ticket_type_id, notes) on public.waitlist to authenticated;
grant update (ticket_type_id, notes, status, offered_at, offer_expires_on)
  on public.waitlist to authenticated;

create policy "Owners and admins read the waiting list"
  on public.waitlist for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins add to the waiting list"
  on public.waitlist for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change the waiting list"
  on public.waitlist for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check (
    (select private.has_staff_role(array['owner', 'admin']::public.staff_role[]))
    -- Only book_from_waitlist() marks someone as booked.
    and status <> 'booked'
  );

-- Books someone in from the waiting list: makes their booking (at the
-- option's price and deposit) and marks them as booked, together. The
-- booking's own checks still apply, so a full event refuses it.
create or replace function public.book_from_waitlist(
  waitlist_id uuid,
  option_id uuid,
  room_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  entry public.waitlist%rowtype;
  option public.ticket_types%rowtype;
  new_booking uuid;
begin
  if not (select private.has_staff_role(array['owner', 'admin']::public.staff_role[])) then
    raise exception 'Only owners and admins can book people in' using errcode = '42501';
  end if;

  select * into entry from public.waitlist w
   where w.id = book_from_waitlist.waitlist_id
   for update;
  if not found or entry.status not in ('waiting', 'offered') then
    raise exception 'That person isn''t waiting for a place any more.';
  end if;

  select * into option from public.ticket_types t
   where t.id = book_from_waitlist.option_id
     and t.event_id = entry.event_id
     and t.deleted_at is null;
  if not found then
    raise exception 'Choose an option for this event.';
  end if;

  insert into public.bookings (
    event_id, customer_id, ticket_type_id, room_id, price_pence, deposit_pence,
    source, notes, created_by
  )
  values (
    entry.event_id, entry.customer_id, option.id, book_from_waitlist.room_id,
    option.price_pence, option.deposit_pence, 'staff',
    'Booked from the waiting list', auth.uid()
  )
  returning id into new_booking;

  update public.waitlist w
     set status = 'booked', booking_id = new_booking
   where w.id = entry.id;

  return new_booking;
end;
$$;

revoke all on function public.book_from_waitlist(uuid, uuid, uuid) from public, anon;
grant execute on function public.book_from_waitlist(uuid, uuid, uuid) to authenticated, service_role;
