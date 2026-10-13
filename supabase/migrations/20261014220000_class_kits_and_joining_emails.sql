-- Two more of Paper Fox's regular emails, ready to send from Email people:
--   * class kits, about 4 weeks before;
--   * joining details, a few days before.
-- What they say about each event (the kits on offer; arrival, timetable and
-- so on) is kept on the event itself, so the wording never needs editing
-- between events and can't go out with last time's details.

alter table public.events
  add column class_kits_info text not null default '',
  add column joining_info text not null default '',
  add constraint events_class_kits_info_length check (char_length(class_kits_info) <= 5000),
  add constraint events_joining_info_length check (char_length(joining_info) <= 5000);

comment on column public.events.class_kits_info is
  'The class kits on offer, their prices and how to order, for the class kits email.';
comment on column public.events.joining_info is
  'Arrival, timetable, nearby and FAQs, for the joining details email.';

-- The team set them; visitors can't read them (only people signed in, as
-- with the Facebook group).
grant insert (class_kits_info, joining_info) on public.events to authenticated;
grant update (class_kits_info, joining_info) on public.events to authenticated;

-- Copying an event copies them too, as a starting point.
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
    balance_due_on, deposit_hold_days, copied_from_event_id,
    class_kits_info, joining_info
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
    source.id,
    source.class_kits_info,
    source.joining_info
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

alter table public.email_templates drop constraint email_templates_key;
alter table public.email_templates add constraint email_templates_key
  check (key in ('B1', 'B2', 'B3', 'thanks', 'balance_reminder', 'class_kits', 'joining'));

alter table public.email_log drop constraint email_log_template;
alter table public.email_log add constraint email_log_template
  check (template in ('B1', 'B2', 'B3', 'thanks', 'balance_reminder', 'class_kits', 'joining', 'other'));

insert into public.email_templates
  (key, name, description, subject, body, attach_booking_details, attach_terms, attach_confirmation, sort_order)
values
(
  'class_kits', 'Class kits',
  'About 4 weeks before, to offer the optional self-paced class kits. The kits come from the event''s Class kits box.',
  '{{event}}: class kits are now available',
  $kits$Hello {{first_name}}

We're getting excited for {{event}}, {{event_dates}}!

Our optional self-paced class kits are now available to everyone who's booked, before they go on general sale to the public.

{{class_kits_info}}

If you have any questions, just reply to this email.$kits$,
  false, false, false, 6
),
(
  'joining', 'Joining details',
  'A few days before, with everything people need to know for the weekend. The details come from the event''s Joining details box.',
  '{{event}}: everything you need to know',
  $joining$Hello {{first_name}}

We can't wait to see you at {{event}}, {{event_dates}}, at {{venue}}.

You're booked on: {{option}}.

{{joining_info}}

If you haven't joined the event's private Facebook group yet, it's here: {{facebook_group}}

See you soon!$joining$,
  false, false, true, 7
);
