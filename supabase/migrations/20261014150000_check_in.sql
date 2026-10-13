-- Check-in on the day: marking people as arrived.
--
-- Door staff can't change bookings, so arriving goes through one function
-- that only touches the arrival columns, for anyone on the team.

alter table public.bookings
  add column checked_in_at timestamptz,
  add column checked_in_by uuid references auth.users (id) on delete set null;

comment on column public.bookings.checked_in_at is
  'When the person arrived at the event, if they have.';

-- Marks someone as arrived (or not, to undo a mistake). Returns the time they
-- were marked as arrived, or null.
create or replace function public.set_checked_in(booking_id uuid, arrived boolean)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  result timestamptz;
begin
  if not (select private.is_staff()) then
    raise exception 'Only the Paper Fox team can check people in' using errcode = '42501';
  end if;

  update public.bookings b
     set checked_in_at = case when arrived then coalesce(b.checked_in_at, now()) end,
         checked_in_by = case when arrived then coalesce(b.checked_in_by, auth.uid()) end
   where b.id = set_checked_in.booking_id
     and b.cancelled_at is null
  returning b.checked_in_at into result;

  if not found then
    raise exception 'That booking couldn''t be found, or it has been cancelled.';
  end if;
  return result;
end;
$$;

revoke all on function public.set_checked_in(uuid, boolean) from public, anon;
grant execute on function public.set_checked_in(uuid, boolean) to authenticated, service_role;
