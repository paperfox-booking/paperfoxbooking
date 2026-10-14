-- Refunds: money paid back to someone, usually after a cancellation. For now
-- refunds are made by bank transfer outside the system (or in cash), then
-- recorded here, like payments.
--
-- Rules:
--   * a refund is whole pence, and is only ever added or removed, never
--     edited (like payments);
--   * what someone has paid is always their payments less their refunds;
--   * a booking can never be refunded more than it's been paid, so a refund
--     that would do that is refused, and so is removing a payment that would
--     leave it that way. The booking is locked while this is checked, so two
--     at the same moment can't both get through;
--   * owners and admins can see and record refunds; door staff can't. The
--     person who booked can see their own;
--   * every change is in the audit log.

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  amount_pence integer not null,
  currency text not null default 'GBP',
  method public.payment_method not null default 'bank_transfer',
  -- The UK date the money was sent back.
  refunded_on date not null,
  reason text not null,
  recorded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A refund recorded by mistake is removed, never edited or deleted.
  deleted_at timestamptz,
  delete_reason text not null default '',
  constraint refunds_amount_range check (amount_pence between 1 and 10000000),
  constraint refunds_currency check (currency = 'GBP'),
  constraint refunds_reason_length check (char_length(trim(reason)) between 1 and 500),
  constraint refunds_delete_reason check (
    deleted_at is null or char_length(trim(delete_reason)) between 1 and 500
  )
);

comment on table public.refunds is
  'Money paid back for a booking, in pence. Owners and admins only, plus the person who booked.';

create index refunds_booking_id_idx on public.refunds (booking_id);

create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute function private.set_updated_at();

create trigger refunds_audit
  after insert or update or delete on public.refunds
  for each row execute function private.record_change();

-- "£135" or "£12.50", for messages.
create or replace function private.format_pounds(pence integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select '£' || case
    when pence % 100 = 0 then (pence / 100)::text
    else to_char(pence / 100.0, 'FM9999990.00')
  end;
$$;

-- Never refunded more than paid. Runs after the change, so the totals
-- include it, with the booking locked first.
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
  perform 1 from public.bookings b where b.id = new.booking_id for update;

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

create trigger refunds_check_covered
  after insert or update of deleted_at on public.refunds
  for each row execute function private.check_refunds_covered();

create trigger payments_check_refunds_covered
  after update of deleted_at on public.payments
  for each row
  when (new.deleted_at is not null and old.deleted_at is null)
  execute function private.check_refunds_covered();

alter table public.refunds enable row level security;
revoke all on public.refunds from anon, authenticated;
grant select on public.refunds to authenticated;
grant insert (booking_id, amount_pence, method, refunded_on, reason) on public.refunds to authenticated;
grant update (deleted_at, delete_reason) on public.refunds to authenticated;

create policy "Owners and admins read refunds; people read their own"
  on public.refunds for select
  to authenticated
  using (
    (select private.has_staff_role(array['owner', 'admin']::public.staff_role[]))
    or private.is_own_booking(booking_id)
  );

create policy "Owners and admins record refunds"
  on public.refunds for insert
  to authenticated
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins remove refunds"
  on public.refunds for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));
