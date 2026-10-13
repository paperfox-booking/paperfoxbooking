-- Profit and loss: what each event costs to run (room hire, food, goody bags
-- and so on), so reports can show income, costs and profit.
--
-- Rules:
--   * only owners and admins can see or change costs (door staff can't);
--   * money is whole pence;
--   * costs are marked deleted, never removed, and changes are audited;
--   * copying an event copies its costs as a starting point, marked unpaid.

create table public.event_costs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  category text not null default 'other',
  description text not null default '',
  supplier text not null default '',
  amount_pence integer not null,
  currency text not null default 'GBP',
  paid boolean not null default false,
  notes text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  constraint event_costs_category check (
    category in ('venue', 'food', 'goody_bags', 'class_kits', 'staff', 'prizes', 'printing', 'travel', 'other')
  ),
  constraint event_costs_description_length check (char_length(description) <= 200),
  constraint event_costs_supplier_length check (char_length(supplier) <= 120),
  constraint event_costs_amount_range check (amount_pence between 0 and 100000000),
  constraint event_costs_currency check (currency = 'GBP'),
  constraint event_costs_notes_length check (char_length(notes) <= 500),
  constraint event_costs_sort_order_range check (sort_order between 0 and 100000)
);

comment on table public.event_costs is
  'What each event costs to run, in pence, for profit and loss. Owners and admins only.';

create index event_costs_event_id_idx on public.event_costs (event_id, sort_order);

create trigger event_costs_set_updated_at
  before update on public.event_costs
  for each row execute function private.set_updated_at();

create trigger event_costs_audit
  after insert or update or delete on public.event_costs
  for each row execute function private.record_change();

alter table public.event_costs enable row level security;

revoke all on public.event_costs from anon, authenticated;
grant select on public.event_costs to authenticated;
grant insert (event_id, category, description, supplier, amount_pence, paid, notes, sort_order)
  on public.event_costs to authenticated;
grant update (category, description, supplier, amount_pence, paid, notes, sort_order, deleted_at)
  on public.event_costs to authenticated;

create policy "Owners and admins read costs"
  on public.event_costs for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins add costs"
  on public.event_costs for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change costs"
  on public.event_costs for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Copying an event now also copies its costs, as unpaid estimates.
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
