-- Phase 2: the people who come, their bookings, rooms, payments and the
-- emails sent to them, plus an audit trail.
--
-- Rules (CLAUDE.md sections 3, 6, 8 and 15):
--   * a booking is one person's place on one event, with its own price and
--     deposit (kept even if the option's price changes later);
--   * every booking gets a reference like PF-2027-0001: one sequence per
--     year, with no gaps or duplicates;
--   * an event can never have more active bookings than places (nor an
--     option more than its own limit, if it has one);
--   * money is whole pence; payments are only ever added or removed, never
--     edited, and what's owed is always worked out from them;
--   * the team can read people and bookings; only owners and admins change
--     them, and only they can see payments (door staff can't);
--   * a customer who signs in can read their own details, bookings and
--     payments, and nobody else's;
--   * changes to bookings, payments, events and options are recorded in the
--     audit log.

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  -- Set when the person signs in with the same email address.
  user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  -- Stored in lower case. Optional: not everyone on the spreadsheet has one.
  email text,
  phone text not null default '',
  emergency_contact text not null default '',
  -- Special category data under UK GDPR: only the team and the person can
  -- read it.
  dietary_health text not null default '',
  notes text not null default '',
  -- Paper Fox team and helpers: listed first ("AA" on the spreadsheet).
  is_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint customers_full_name_length check (char_length(trim(full_name)) between 1 and 200),
  constraint customers_email_format check (
    email is null
    or (email = lower(email) and char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  constraint customers_phone_length check (char_length(phone) <= 40),
  constraint customers_emergency_contact_length check (char_length(emergency_contact) <= 300),
  constraint customers_dietary_health_length check (char_length(dietary_health) <= 1000),
  constraint customers_notes_length check (char_length(notes) <= 2000)
);

comment on table public.customers is
  'People who come to Paper Fox events, kept across events. Personal and health data: RLS protected.';

create unique index customers_email_key on public.customers (email)
  where email is not null and deleted_at is null;
create index customers_full_name_idx on public.customers (lower(full_name));

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();

-- When someone signs in for the first time (or changes their email), link
-- them to their record so they can see their own bookings.
create or replace function private.link_customer_to_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email <> '' then
    update public.customers
       set user_id = new.id
     where email = lower(new.email)
       and user_id is null
       and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger profiles_link_customer
  after insert or update of email on public.profiles
  for each row execute function private.link_customer_to_user();

-- ---------------------------------------------------------------------------
-- Rooms at an event (for example Main room, 2nd Room A, Welsh)
-- ---------------------------------------------------------------------------

create table public.event_rooms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  -- A guide for the team, not enforced: the event's place limit is.
  capacity integer,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint event_rooms_id_event unique (id, event_id),
  constraint event_rooms_name_length check (char_length(trim(name)) between 1 and 60),
  constraint event_rooms_capacity_range check (capacity is null or capacity between 1 and 2000),
  constraint event_rooms_notes_length check (char_length(notes) <= 300),
  constraint event_rooms_sort_order_range check (sort_order between 0 and 1000)
);

create unique index event_rooms_name_key on public.event_rooms (event_id, lower(name))
  where deleted_at is null;

create trigger event_rooms_set_updated_at
  before update on public.event_rooms
  for each row execute function private.set_updated_at();

-- Lets bookings check their option belongs to the same event.
alter table public.ticket_types
  add constraint ticket_types_id_event unique (id, event_id);

-- ---------------------------------------------------------------------------
-- Bookings: one person's place on one event
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  -- PF-2027-0001, set automatically (see below).
  reference text not null default '' unique,
  event_id uuid not null references public.events (id),
  customer_id uuid not null references public.customers (id),
  -- Empty for a team member's free place with no option.
  ticket_type_id uuid,
  room_id uuid,
  -- What this person owes in total, and the deposit that secures the place
  -- (copied from the option when booked; empty means pay in full).
  price_pence integer not null,
  deposit_pence integer,
  currency text not null default 'GBP',
  -- Why the price differs from the option's, if it does.
  price_note text not null default '',
  notes text not null default '',
  payment_notes text not null default '',
  source text not null default 'staff',
  cancelled_at timestamptz,
  cancel_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  constraint bookings_option_same_event foreign key (ticket_type_id, event_id)
    references public.ticket_types (id, event_id),
  constraint bookings_room_same_event foreign key (room_id, event_id)
    references public.event_rooms (id, event_id),
  constraint bookings_price_range check (price_pence between 0 and 10000000),
  constraint bookings_deposit_range check (
    deposit_pence is null or (deposit_pence > 0 and deposit_pence <= price_pence)
  ),
  constraint bookings_currency check (currency = 'GBP'),
  constraint bookings_source check (source in ('staff', 'import', 'online')),
  constraint bookings_price_note_length check (char_length(price_note) <= 300),
  constraint bookings_notes_length check (char_length(notes) <= 2000),
  constraint bookings_payment_notes_length check (char_length(payment_notes) <= 2000),
  constraint bookings_cancel_reason_length check (char_length(cancel_reason) <= 500)
);

comment on table public.bookings is
  'One person''s place on one event, with its price and deposit in pence. RLS protected.';

-- Someone can only have one active place on each event.
create unique index bookings_one_place_per_person on public.bookings (event_id, customer_id)
  where cancelled_at is null;
create index bookings_customer_id_idx on public.bookings (customer_id);
create index bookings_ticket_type_id_idx on public.bookings (ticket_type_id);
create index bookings_room_id_idx on public.bookings (room_id);

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function private.set_updated_at();

-- Booking references: PF-<year of the event>-<number>, one sequence per year.
-- The counter goes up inside the booking's own transaction, so a booking that
-- fails doesn't use up a number: no gaps and no duplicates.
create table private.booking_reference_counters (
  year integer primary key,
  last_number integer not null
);

create or replace function private.set_booking_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_year integer;
  next_number integer;
begin
  select extract(year from (e.starts_at at time zone 'Europe/London'))::integer
    into event_year
    from public.events e
   where e.id = new.event_id;

  insert into private.booking_reference_counters as counter (year, last_number)
  values (event_year, 1)
  on conflict (year) do update set last_number = counter.last_number + 1
  returning last_number into next_number;

  new.reference := format('PF-%s-%s', event_year, lpad(next_number::text, 4, '0'));
  return new;
end;
$$;

create trigger bookings_set_reference
  before insert on public.bookings
  for each row execute function private.set_booking_reference();

-- Never more active bookings than places. The event's row is locked first, so
-- two people taking the last place at the same moment can't both succeed.
create or replace function private.check_places()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_capacity integer;
  option_capacity integer;
  taken integer;
begin
  if new.cancelled_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE'
     and old.cancelled_at is null
     and new.ticket_type_id is not distinct from old.ticket_type_id then
    return new;
  end if;

  select e.capacity into event_capacity
    from public.events e
   where e.id = new.event_id
     for update;

  if tg_op = 'INSERT' or old.cancelled_at is not null then
    select count(*) into taken
      from public.bookings b
     where b.event_id = new.event_id and b.cancelled_at is null and b.id <> new.id;
    if taken >= event_capacity then
      raise exception 'This event is full (% places). To add someone, increase its places or cancel a booking first.', event_capacity;
    end if;
  end if;

  if new.ticket_type_id is not null then
    select t.capacity into option_capacity
      from public.ticket_types t
     where t.id = new.ticket_type_id;
    if option_capacity is not null then
      select count(*) into taken
        from public.bookings b
       where b.ticket_type_id = new.ticket_type_id and b.cancelled_at is null and b.id <> new.id;
      if taken >= option_capacity then
        raise exception 'That option is full (% places). Choose another option, or increase its places.', option_capacity;
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger bookings_check_places
  before insert or update of cancelled_at, ticket_type_id on public.bookings
  for each row execute function private.check_places();

-- ---------------------------------------------------------------------------
-- Payments (bank transfer and cash for now; cards may come later)
-- ---------------------------------------------------------------------------

create type public.payment_method as enum ('bank_transfer', 'cash', 'card', 'other');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  amount_pence integer not null,
  currency text not null default 'GBP',
  method public.payment_method not null default 'bank_transfer',
  -- The UK date the money arrived. Empty only for money brought over from the
  -- spreadsheet, whose dates weren't recorded (the note says so).
  received_on date,
  note text not null default '',
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A payment recorded by mistake is removed, never edited or deleted.
  deleted_at timestamptz,
  delete_reason text not null default '',
  constraint payments_amount_range check (amount_pence between 1 and 10000000),
  constraint payments_currency check (currency = 'GBP'),
  constraint payments_note_length check (char_length(note) <= 500),
  constraint payments_date_or_note check (received_on is not null or note <> ''),
  constraint payments_delete_reason check (
    deleted_at is null or char_length(trim(delete_reason)) between 1 and 500
  )
);

comment on table public.payments is
  'Money received for a booking, in pence. Owners and admins only, plus the person who booked.';

create index payments_booking_id_idx on public.payments (booking_id);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Emails and messages sent (including those sent outside the system)
-- ---------------------------------------------------------------------------

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id),
  customer_id uuid references public.customers (id),
  -- B1 (booking received), B2 (deposit received), B3 (paid in full),
  -- thanks (balance paid), balance_reminder, or other.
  template text not null,
  subject text not null default '',
  note text not null default '',
  -- The UK date it was sent. Empty if the spreadsheet didn't say.
  sent_on date,
  sent_at timestamptz,
  -- True for emails Paper Fox sent itself and recorded here.
  outside_system boolean not null default true,
  status text not null default 'sent',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  constraint email_log_about_someone check (booking_id is not null or customer_id is not null),
  constraint email_log_template check (
    template in ('B1', 'B2', 'B3', 'thanks', 'balance_reminder', 'other')
  ),
  constraint email_log_status check (status in ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  constraint email_log_subject_length check (char_length(subject) <= 300),
  constraint email_log_note_length check (char_length(note) <= 500)
);

create index email_log_booking_id_idx on public.email_log (booking_id);
create index email_log_customer_id_idx on public.email_log (customer_id);

-- ---------------------------------------------------------------------------
-- Audit log: who changed what, and when
-- ---------------------------------------------------------------------------

create table public.audit_log (
  id bigint generated always as identity primary key,
  table_name text not null,
  record_id uuid not null,
  action text not null,
  old_values jsonb,
  new_values jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now(),
  constraint audit_log_action check (action in ('insert', 'update', 'delete'))
);

comment on table public.audit_log is
  'Every change to bookings, payments, events and options. Owners and admins can read it; nobody can change it.';

create index audit_log_record_idx on public.audit_log (table_name, record_id, changed_at);

create or replace function private.record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;
  insert into public.audit_log (table_name, record_id, action, old_values, new_values, changed_by)
  values (
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op <> 'INSERT' then to_jsonb(old) end,
    case when tg_op <> 'DELETE' then to_jsonb(new) end,
    auth.uid()
  );
  return coalesce(new, old);
end;
$$;

create trigger bookings_audit
  after insert or update or delete on public.bookings
  for each row execute function private.record_change();
create trigger payments_audit
  after insert or update or delete on public.payments
  for each row execute function private.record_change();
create trigger events_audit
  after insert or update or delete on public.events
  for each row execute function private.record_change();
create trigger ticket_types_audit
  after insert or update or delete on public.ticket_types
  for each row execute function private.record_change();

-- ---------------------------------------------------------------------------
-- Copying an event now copies its rooms too
-- ---------------------------------------------------------------------------

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

  insert into public.event_rooms (event_id, name, capacity, notes, sort_order)
  select new_event_id, r.name, r.capacity, r.notes, r.sort_order
  from public.event_rooms r
  where r.event_id = source.id and r.deleted_at is null;

  return new_event_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Importing an event's spreadsheet in one go
-- ---------------------------------------------------------------------------

-- Brings the people on a spreadsheet into an event that has nobody booked
-- yet. Everything is saved, or nothing is. The app reads and checks the
-- spreadsheet first; this saves what the team confirmed.
--
-- rooms:  [{ "name": "Main room", "capacity": 78 }, ...]
-- people: [{ "full_name", "email", "is_team", "phone", "emergency_contact",
--            "dietary_health", "notes", "ticket_type_id", "room_name",
--            "price_pence", "price_note", "received_pence", "email_template",
--            "email_sent_on", "email_note" }, ...]
create or replace function public.import_bookings(
  target_event_id uuid,
  rooms jsonb,
  people jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  room jsonb;
  person jsonb;
  person_email text;
  found_customer_id uuid;
  found_room_id uuid;
  option_deposit integer;
  new_booking_id uuid;
  imported integer := 0;
begin
  if not (select private.has_staff_role(array['owner', 'admin']::public.staff_role[])) then
    raise exception 'Only owners and admins can import bookings' using errcode = '42501';
  end if;

  -- One import at a time for each event.
  perform pg_advisory_xact_lock(hashtextextended('paperfox.import.' || target_event_id::text, 0));

  if not exists (select 1 from public.events where id = target_event_id and deleted_at is null) then
    raise exception 'That event couldn''t be found. It may have been deleted.';
  end if;
  if exists (select 1 from public.bookings where event_id = target_event_id and cancelled_at is null) then
    raise exception 'This event already has people booked, so a spreadsheet can''t be imported into it. Imports only go into an event with nobody booked yet.';
  end if;

  for room in select * from jsonb_array_elements(coalesce(rooms, '[]'::jsonb)) loop
    if not exists (
      select 1 from public.event_rooms r
       where r.event_id = target_event_id and lower(r.name) = lower(room ->> 'name') and r.deleted_at is null
    ) then
      insert into public.event_rooms (event_id, name, capacity, sort_order)
      values (target_event_id, room ->> 'name', (room ->> 'capacity')::integer,
              (select count(*) from public.event_rooms r where r.event_id = target_event_id));
    end if;
  end loop;

  for person in select * from jsonb_array_elements(people) loop
    person_email := lower(nullif(trim(person ->> 'email'), ''));
    found_customer_id := null;

    if person_email is not null then
      select c.id into found_customer_id
        from public.customers c
       where c.email = person_email and c.deleted_at is null;
    end if;

    if found_customer_id is null then
      insert into public.customers (full_name, email, phone, emergency_contact, dietary_health, is_team)
      values (
        trim(person ->> 'full_name'), person_email,
        coalesce(person ->> 'phone', ''), coalesce(person ->> 'emergency_contact', ''),
        coalesce(person ->> 'dietary_health', ''), coalesce((person ->> 'is_team')::boolean, false)
      )
      returning id into found_customer_id;
    else
      -- They've been before: the spreadsheet's details are the newest.
      update public.customers c
         set phone = coalesce(nullif(person ->> 'phone', ''), c.phone),
             emergency_contact = coalesce(nullif(person ->> 'emergency_contact', ''), c.emergency_contact),
             dietary_health = coalesce(nullif(person ->> 'dietary_health', ''), c.dietary_health),
             is_team = c.is_team or coalesce((person ->> 'is_team')::boolean, false)
       where c.id = found_customer_id;
    end if;

    found_room_id := null;
    if nullif(trim(person ->> 'room_name'), '') is not null then
      select r.id into found_room_id
        from public.event_rooms r
       where r.event_id = target_event_id
         and lower(r.name) = lower(trim(person ->> 'room_name'))
         and r.deleted_at is null;
      if found_room_id is null then
        insert into public.event_rooms (event_id, name, sort_order)
        values (target_event_id, trim(person ->> 'room_name'),
                (select count(*) from public.event_rooms r where r.event_id = target_event_id))
        returning id into found_room_id;
      end if;
    end if;

    option_deposit := null;
    if person ->> 'ticket_type_id' is not null then
      select t.deposit_pence into option_deposit
        from public.ticket_types t
       where t.id = (person ->> 'ticket_type_id')::uuid and t.event_id = target_event_id;
    end if;

    insert into public.bookings (
      event_id, customer_id, ticket_type_id, room_id, price_pence,
      deposit_pence, price_note, notes, source
    )
    values (
      target_event_id, found_customer_id, (person ->> 'ticket_type_id')::uuid,
      found_room_id, (person ->> 'price_pence')::integer,
      case
        when option_deposit is null or option_deposit > (person ->> 'price_pence')::integer then null
        else option_deposit
      end,
      coalesce(person ->> 'price_note', ''), coalesce(person ->> 'notes', ''), 'import'
    )
    returning id into new_booking_id;

    if coalesce((person ->> 'received_pence')::integer, 0) > 0 then
      insert into public.payments (booking_id, amount_pence, method, received_on, note)
      values (
        new_booking_id, (person ->> 'received_pence')::integer, 'bank_transfer', null,
        'Received before the spreadsheet was imported'
      );
    end if;

    if person ->> 'email_template' is not null then
      insert into public.email_log (booking_id, customer_id, template, note, sent_on)
      values (
        new_booking_id, found_customer_id, person ->> 'email_template',
        coalesce(person ->> 'email_note', ''), (person ->> 'email_sent_on')::date
      );
    end if;

    imported := imported + 1;
  end loop;

  return imported;
end;
$$;

revoke all on function public.import_bookings(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.import_bookings(uuid, jsonb, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.event_rooms enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.email_log enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.customers, public.event_rooms, public.bookings,
  public.payments, public.email_log, public.audit_log from anon, authenticated;

grant select on public.customers, public.event_rooms, public.bookings,
  public.payments, public.email_log, public.audit_log to authenticated;

grant insert (full_name, email, phone, emergency_contact, dietary_health, notes, is_team)
  on public.customers to authenticated;
grant update (full_name, email, phone, emergency_contact, dietary_health, notes, is_team, deleted_at)
  on public.customers to authenticated;

grant insert (event_id, name, capacity, notes, sort_order) on public.event_rooms to authenticated;
grant update (name, capacity, notes, sort_order, deleted_at) on public.event_rooms to authenticated;

grant insert (
  event_id, customer_id, ticket_type_id, room_id, price_pence, deposit_pence,
  price_note, notes, payment_notes, source
) on public.bookings to authenticated;
grant update (
  ticket_type_id, room_id, price_pence, deposit_pence, price_note, notes,
  payment_notes, cancelled_at, cancel_reason
) on public.bookings to authenticated;

grant insert (booking_id, amount_pence, method, received_on, note) on public.payments to authenticated;
grant update (deleted_at, delete_reason) on public.payments to authenticated;

grant insert (booking_id, customer_id, template, subject, note, sent_on)
  on public.email_log to authenticated;

-- A person's own records, once they've signed in with the same email.
create or replace function private.is_own_customer(customer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.customers c
     where c.id = customer and c.user_id = (select auth.uid()) and c.deleted_at is null
  );
$$;

create or replace function private.is_own_booking(booking uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
      join public.customers c on c.id = b.customer_id
     where b.id = booking and c.user_id = (select auth.uid()) and c.deleted_at is null
  );
$$;

revoke all on function private.is_own_customer(uuid) from public;
revoke all on function private.is_own_booking(uuid) from public;
grant execute on function private.is_own_customer(uuid) to authenticated, service_role;
grant execute on function private.is_own_booking(uuid) to authenticated, service_role;

-- People
create policy "The team reads everyone; people read their own record"
  on public.customers for select
  to authenticated
  using ((select private.is_staff()) or user_id = (select auth.uid()));

create policy "Owners and admins add people"
  on public.customers for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change people"
  on public.customers for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Rooms
create policy "The team reads rooms"
  on public.event_rooms for select
  to authenticated
  using ((select private.is_staff()));

create policy "Owners and admins add rooms"
  on public.event_rooms for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change rooms"
  on public.event_rooms for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Bookings
create policy "The team reads all bookings; people read their own"
  on public.bookings for select
  to authenticated
  using ((select private.is_staff()) or private.is_own_customer(customer_id));

create policy "Owners and admins add bookings"
  on public.bookings for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change bookings"
  on public.bookings for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Payments: door staff can't see them.
create policy "Owners and admins read payments; people read their own"
  on public.payments for select
  to authenticated
  using (
    (select private.has_staff_role(array['owner', 'admin']::public.staff_role[]))
    or private.is_own_booking(booking_id)
  );

create policy "Owners and admins record payments"
  on public.payments for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins remove payments"
  on public.payments for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Emails
create policy "Owners and admins read the email log"
  on public.email_log for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins record emails"
  on public.email_log for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Audit log
create policy "Owners and admins read the audit log"
  on public.audit_log for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));
