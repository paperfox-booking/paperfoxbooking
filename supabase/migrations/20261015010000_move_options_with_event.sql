-- When an event moves to new dates, its options move with it.
--
-- Each option can have its own start (for example the 9am Kick Starter).
-- Changing the event's start date under "Change details" used to leave those
-- on the old dates. Now, when an event's start moves by a number of UK
-- calendar days, each of its options' starts moves by the same number of
-- days, keeping its UK clock time even when the clocks change in between
-- (as copying an event already does, with private.shift_uk_days).
--
-- Only the date matters: moving the start time on the same day leaves the
-- options alone. Options without their own start (they start when the event
-- does) and removed options are left alone too.

create or replace function private.move_options_with_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  shift_days integer;
begin
  shift_days := (new.starts_at at time zone 'Europe/London')::date
              - (old.starts_at at time zone 'Europe/London')::date;
  if shift_days <> 0 then
    update public.ticket_types t
       set starts_at = private.shift_uk_days(t.starts_at, shift_days)
     where t.event_id = new.id
       and t.starts_at is not null
       and t.deleted_at is null;
  end if;
  return null;
end;
$$;

revoke all on function private.move_options_with_event() from public, anon, authenticated;

create trigger events_move_options
  after update of starts_at on public.events
  for each row
  when (old.starts_at is distinct from new.starts_at)
  execute function private.move_options_with_event();
