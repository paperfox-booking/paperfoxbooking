-- Phase 1: venues, events and the options people book (ticket types).
--
-- Rules (CLAUDE.md sections 6 and 15):
--   * anyone can read venues, and events that have been published, with
--     their options; drafts are only visible to the team;
--   * only owners and admins create and change venues, events and options;
--   * money is whole pence, and dates are stored in UTC;
--   * each option has its own deposit (for example £60 for the 4pm start and
--     £85 for the 9am start), or none, meaning pay in full;
--   * the balance due date is set per event (6 weeks before by default, which
--     the app fills in);
--   * copying an event moves every date on by the same number of days, keeping
--     UK clock times (a 9am start stays 9am across the clocks changing).

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Turns a title into the readable part of a web address:
-- "Paper Fox Escape: March 2027" → "paper-fox-escape-march-2027".
create or replace function private.slugify(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from left(
        trim(both '-' from regexp_replace(
          lower(regexp_replace(coalesce(value, ''), '[''’]', '', 'g')),
          '[^a-z0-9]+', '-', 'g'
        )),
        60
      )),
      ''
    ),
    'event'
  );
$$;

-- Moves a moment on by whole days in UK time, so 09:00 stays 09:00 even when
-- the clocks change in between.
create or replace function private.shift_uk_days(moment timestamptz, days integer)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select ((moment at time zone 'Europe/London') + make_interval(days => days))
    at time zone 'Europe/London';
$$;

-- Visitors' reads check whether they're on the team (they never are), so
-- they need to be able to ask.
grant execute on function private.is_staff() to anon;

grant execute on function private.slugify(text) to authenticated, service_role;
grant execute on function private.shift_uk_days(timestamptz, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Venues
-- ---------------------------------------------------------------------------

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- One line of the address per line of text.
  address text not null default '',
  postcode text not null default '',
  phone text not null default '',
  map_url text,
  parking text not null default '',
  access_info text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint venues_name_length check (char_length(trim(name)) between 1 and 120),
  constraint venues_address_length check (char_length(address) <= 500),
  constraint venues_postcode_length check (char_length(postcode) <= 12),
  constraint venues_phone_length check (char_length(phone) <= 40),
  constraint venues_map_url_https check (map_url is null or map_url ~ '^https://'),
  constraint venues_parking_length check (char_length(parking) <= 1000),
  constraint venues_access_info_length check (char_length(access_info) <= 1000)
);

comment on table public.venues is
  'Where events are held. Public information: anyone can read venues that are not deleted.';

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create type public.event_status as enum ('draft', 'published', 'sold_out', 'cancelled', 'finished');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- The readable part of the event's web address. Set once from the title,
  -- then never changed, so shared links keep working. The trigger below
  -- always sets it; the empty default just means it needn't be given.
  slug text not null default '' unique,
  title text not null,
  -- A sentence or two for the events list and link previews.
  summary text not null default '',
  description text not null default '',
  -- What everyone gets, one item per line.
  included text not null default '',
  -- How to book a hotel room, and the rate. Rooms are booked with the hotel.
  hotel_info text not null default '',
  -- Each event has its own private Facebook group, so this is never copied.
  facebook_group_url text,
  venue_id uuid not null references public.venues (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.event_status not null default 'draft',
  -- The most people the event can take.
  capacity integer not null,
  -- When people can start booking online, and when booking stops. Empty
  -- means straight away, and until the event starts.
  booking_opens_at timestamptz,
  booking_closes_at timestamptz,
  -- The date the balance must be paid by. Booking on or after it means paying
  -- in full.
  balance_due_on date not null,
  -- How many days a place is held while waiting for the deposit.
  deposit_hold_days integer not null default 7,
  copied_from_event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint events_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 70),
  constraint events_title_length check (char_length(trim(title)) between 1 and 120),
  constraint events_summary_length check (char_length(summary) <= 300),
  constraint events_description_length check (char_length(description) <= 5000),
  constraint events_included_length check (char_length(included) <= 3000),
  constraint events_hotel_info_length check (char_length(hotel_info) <= 3000),
  constraint events_facebook_group_url_https check (facebook_group_url is null or facebook_group_url ~ '^https://'),
  constraint events_ends_after_start check (ends_at > starts_at),
  constraint events_capacity_range check (capacity between 1 and 2000),
  constraint events_booking_window check (
    booking_closes_at is null
    or ((booking_opens_at is null or booking_closes_at > booking_opens_at) and booking_closes_at <= ends_at)
  ),
  constraint events_balance_due_before_start check (
    balance_due_on < (starts_at at time zone 'Europe/London')::date
  ),
  constraint events_deposit_hold_days_range check (deposit_hold_days between 1 and 60)
);

comment on table public.events is
  'Paper Fox events. Anyone can read events that are not drafts; only owners and admins change them.';

create index events_starts_at_idx on public.events (starts_at);
create index events_venue_id_idx on public.events (venue_id);
create index events_copied_from_event_id_idx on public.events (copied_from_event_id);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

-- Gives a new event its web address, adding -2, -3 and so on if it's taken.
create or replace function private.set_event_slug()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := private.slugify(new.title);
  candidate text := base;
  attempt integer := 1;
begin
  while exists (select 1 from public.events e where e.slug = candidate) loop
    attempt := attempt + 1;
    candidate := base || '-' || attempt;
  end loop;
  new.slug := candidate;
  return new;
end;
$$;

create trigger events_set_slug
  before insert on public.events
  for each row execute function private.set_event_slug();

-- ---------------------------------------------------------------------------
-- Options people book (ticket types), for example "Weekend (4pm start)"
-- ---------------------------------------------------------------------------

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  description text not null default '',
  price_pence integer not null,
  -- The deposit for one place. Empty means no deposit: pay in full.
  deposit_pence integer,
  currency text not null default 'GBP',
  -- When this option starts, if it's different from the event (for example
  -- the 9am Kick Starter). Empty means when the event starts.
  starts_at timestamptz,
  -- A limit for this option on its own. Empty means only the event's limit.
  capacity integer,
  sort_order integer not null default 0,
  on_sale boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint ticket_types_name_length check (char_length(trim(name)) between 1 and 80),
  constraint ticket_types_description_length check (char_length(description) <= 1000),
  constraint ticket_types_price_range check (price_pence between 0 and 10000000),
  constraint ticket_types_deposit_below_price check (
    deposit_pence is null or (deposit_pence > 0 and deposit_pence < price_pence)
  ),
  constraint ticket_types_currency check (currency = 'GBP'),
  constraint ticket_types_capacity_range check (capacity is null or capacity between 1 and 2000),
  constraint ticket_types_sort_order_range check (sort_order between 0 and 1000)
);

comment on table public.ticket_types is
  'The options people book on an event, with prices and deposits in pence. Readable when the event is.';

create index ticket_types_event_id_idx on public.ticket_types (event_id, sort_order);

create trigger ticket_types_set_updated_at
  before update on public.ticket_types
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rules for changing an event's status
-- ---------------------------------------------------------------------------

-- These messages are shown to the team as they are, so they're plain English.
create or replace function private.check_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'This event has been cancelled, so it can''t be reopened. Copy it to make a new event instead.';
  end if;

  if new.status in ('published', 'sold_out')
     and (tg_op = 'INSERT' or old.status not in ('published', 'sold_out'))
     and not exists (
       select 1 from public.ticket_types t
       where t.event_id = new.id and t.deleted_at is null and t.on_sale
     ) then
    raise exception 'Add at least one option that''s on sale before publishing this event.';
  end if;

  if tg_op = 'UPDATE' and new.deleted_at is not null and old.deleted_at is null
     and old.status <> 'draft' then
    raise exception 'Only draft events can be deleted. To stop a published event, cancel it instead.';
  end if;

  return new;
end;
$$;

create trigger events_check_change
  before insert or update on public.events
  for each row execute function private.check_event_change();

-- ---------------------------------------------------------------------------
-- Copying an event (for example last year's March weekend to make this year's)
-- ---------------------------------------------------------------------------

-- Makes a draft copy of an event and its options, with every date moved on so
-- the copy starts on new_starts_on (a UK date). Returns the new event's id.
-- Runs as the person calling it, so row level security still applies.
create or replace function public.copy_event(
  source_event_id uuid,
  new_title text,
  new_starts_on date
)
returns uuid
language plpgsql
security invoker
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

  return new_event_id;
end;
$$;

revoke all on function public.copy_event(uuid, text, date) from public, anon;
grant execute on function public.copy_event(uuid, text, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.venues enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;

-- Nobody deletes rows: records others point to are marked deleted instead.
-- The columns people may set are listed, so nobody can fake who created a
-- record, change an event's web address or create one that's already live.
revoke all on public.venues, public.events, public.ticket_types from anon, authenticated;
grant select on public.venues, public.ticket_types to anon, authenticated;
grant select on public.events to authenticated;
-- The Facebook group is private to people who've booked, so visitors can't
-- read its address.
grant select (
  id, slug, title, summary, description, included, hotel_info, venue_id,
  starts_at, ends_at, status, capacity, booking_opens_at, booking_closes_at,
  balance_due_on, deposit_hold_days, copied_from_event_id, created_at,
  updated_at, deleted_at
) on public.events to anon;

grant insert (name, address, postcode, phone, map_url, parking, access_info)
  on public.venues to authenticated;
grant update (name, address, postcode, phone, map_url, parking, access_info, deleted_at)
  on public.venues to authenticated;

grant insert (
  title, summary, description, included, hotel_info, facebook_group_url,
  venue_id, starts_at, ends_at, capacity, booking_opens_at, booking_closes_at,
  balance_due_on, deposit_hold_days, copied_from_event_id
) on public.events to authenticated;
grant update (
  title, summary, description, included, hotel_info, facebook_group_url,
  venue_id, starts_at, ends_at, status, capacity, booking_opens_at,
  booking_closes_at, balance_due_on, deposit_hold_days, deleted_at
) on public.events to authenticated;

grant insert (
  event_id, name, description, price_pence, deposit_pence, starts_at,
  capacity, sort_order, on_sale
) on public.ticket_types to authenticated;
grant update (
  name, description, price_pence, deposit_pence, starts_at, capacity,
  sort_order, on_sale, deleted_at
) on public.ticket_types to authenticated;

-- Venues
create policy "Anyone reads venues; the team also sees deleted ones"
  on public.venues for select
  to anon, authenticated
  using (deleted_at is null or (select private.is_staff()));

create policy "Owners and admins add venues"
  on public.venues for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change venues"
  on public.venues for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Events
create policy "Anyone reads events that aren't drafts; the team reads all"
  on public.events for select
  to anon, authenticated
  using (
    (status <> 'draft' and deleted_at is null)
    or (select private.is_staff())
  );

create policy "Owners and admins add events"
  on public.events for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change events"
  on public.events for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Options
create policy "Anyone reads the options of events they can see; the team reads all"
  on public.ticket_types for select
  to anon, authenticated
  using (
    (
      deleted_at is null
      and exists (
        select 1 from public.events e
        where e.id = ticket_types.event_id and e.status <> 'draft' and e.deleted_at is null
      )
    )
    or (select private.is_staff())
  );

create policy "Owners and admins add options"
  on public.ticket_types for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change options"
  on public.ticket_types for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- ---------------------------------------------------------------------------
-- The venue Paper Fox uses today (public information, CLAUDE.md section 15)
-- ---------------------------------------------------------------------------

insert into public.venues (name, address, postcode, phone, map_url, parking)
values (
  'Holiday Inn Coventry',
  E'Hinckley Road\nCoventry',
  'CV2 2HP',
  '024 7509 7600',
  'https://www.google.com/maps/search/?api=1&query=Holiday+Inn+Coventry+CV2+2HP',
  'Free parking at the hotel.'
);
