-- Two more emails, sent to one person from their booking's page:
--   * booking cancelled, to confirm a cancellation;
--   * refund sent, once a refund has been recorded.
-- They're about one booking, so they aren't offered on Email people.

alter table public.email_templates drop constraint email_templates_key;
alter table public.email_templates add constraint email_templates_key
  check (key in (
    'B1', 'B2', 'B3', 'thanks', 'balance_reminder', 'class_kits', 'joining',
    'cancelled', 'refund'
  ));

alter table public.email_log drop constraint email_log_template;
alter table public.email_log add constraint email_log_template
  check (template in (
    'B1', 'B2', 'B3', 'thanks', 'balance_reminder', 'class_kits', 'joining',
    'cancelled', 'refund', 'other'
  ));

insert into public.email_templates
  (key, name, description, subject, body, attach_booking_details, attach_terms, attach_confirmation, sort_order)
values
(
  'cancelled', 'Booking cancelled',
  'Confirms that someone''s booking has been cancelled. Sent from their booking''s page, once it''s cancelled.',
  '{{event}}: your booking has been cancelled',
  $cancelled$Hello {{first_name}}

This is to confirm that your place at {{event}}, {{event_dates}}, has been cancelled. Your booking reference was {{reference}}.

If any money is due back to you under our terms and conditions, we'll send it to you by bank transfer, and email you when it's on its way.

We're sorry you can't make it this time, and we hope to see you at a future event.$cancelled$,
  false, false, false, 8
),
(
  'refund', 'Refund sent',
  'Lets someone know their refund is on its way. Sent from their booking''s page, once the refund is recorded.',
  '{{event}}: your refund is on its way',
  $refund$Hello {{first_name}}

We've refunded {{amount_refunded}} to you on {{refunded_on}}, for your booking on {{event}} (reference {{reference}}). It can take a few working days to reach your account.

If anything doesn't look right, just reply to this email.$refund$,
  false, false, false, 9
);
