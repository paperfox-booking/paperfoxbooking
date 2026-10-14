-- Customers read their own payments and refunds through a function that
-- gives only the amounts, dates and how they were paid, never the team's
-- notes, refund reasons or who recorded them. (After a place is passed on,
-- that also keeps the notes on the first person's payments private.)
--
-- Owners and admins read the tables themselves, as before.

drop policy "Owners and admins read payments; people read their own" on public.payments;
create policy "Owners and admins read payments"
  on public.payments for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

drop policy "Owners and admins read refunds; people read their own" on public.refunds;
create policy "Owners and admins read refunds"
  on public.refunds for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- The payments and refunds (not removed) on the signed-in person's own
-- bookings. Refunds come back as a positive amount with kind 'refund'.
create or replace function public.my_booking_money(booking_ids uuid[])
returns table (
  booking_id uuid,
  kind text,
  amount_pence integer,
  method public.payment_method,
  on_date date,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.booking_id, 'payment', p.amount_pence, p.method, p.received_on, p.created_at
    from public.payments p
   where p.booking_id = any(my_booking_money.booking_ids)
     and p.deleted_at is null
     and private.is_own_booking(p.booking_id)
  union all
  select r.booking_id, 'refund', r.amount_pence, r.method, r.refunded_on, r.created_at
    from public.refunds r
   where r.booking_id = any(my_booking_money.booking_ids)
     and r.deleted_at is null
     and private.is_own_booking(r.booking_id);
$$;

revoke all on function public.my_booking_money(uuid[]) from public, anon;
grant execute on function public.my_booking_money(uuid[]) to authenticated, service_role;
