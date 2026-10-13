-- Two more of Paper Fox's regular emails, ready to send from Email people:
--   * class kits, about 4 weeks before;
--   * joining details, a few days before.
-- Their wording has notes in [square brackets] for the team to replace with
-- each event's details before sending; the preview warns while any are left.

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
  'About 4 weeks before, to offer the optional self-paced class kits. Replace the notes in [square brackets] first.',
  '{{event}}: class kits are now available',
  $kits$Hello {{first_name}}

We're getting excited for {{event}}, {{event_dates}}!

Our optional self-paced class kits are now available to everyone who's booked, before they go on general sale to the public.

[Add the kits, what's in each one, the prices and how to order.]

If you have any questions, just reply to this email.$kits$,
  false, false, false, 6
),
(
  'joining', 'Joining details',
  'A few days before, with everything people need to know for the weekend. Replace the notes in [square brackets] first.',
  '{{event}}: everything you need to know',
  $joining$Hello {{first_name}}

We can't wait to see you at {{event}}, {{event_dates}}, at {{venue}}.

You're booked on: {{option}}.

Arriving

[Add arrival times, where to go and parking.]

The weekend

[Add the timetable for the weekend.]

Nearby

[Add local amenities: shops, cash machines, places to eat.]

Questions people often ask

[Add the usual questions and answers.]

If you haven't joined the event's private Facebook group yet, it's here: {{facebook_group}}

See you soon!$joining$,
  false, false, true, 7
);
