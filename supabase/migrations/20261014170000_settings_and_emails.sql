-- Settings, terms and conditions, and the wording of the emails Paper Fox
-- sends (B1, B2, B3, thanks and the balance reminder).
--
-- Rules:
--   * one row of settings: business details, bank details for transfers, the
--     reply-to address, and the terms;
--   * owners and admins can read the settings (emails need the bank details);
--     only owners can change them;
--   * every change to the terms makes a new numbered version, kept for good,
--     so we always know which wording someone was sent;
--   * owners and admins can change the email wording;
--   * emails sent by the system are logged through public.log_email, so the
--     log itself can't be edited by anyone.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  business_name text not null default 'Paper Fox',
  legal_name text not null default 'Paper Fox Events Ltd',
  company_number text not null default '13717760',
  contact_email text not null default 'hello@paper-fox.co.uk',
  phone text not null default '+44 (0)24 7693 7383',
  address text not null default E'Suite 1B, The Hall\nRugby Road\nWolston\nCV8 3FZ',
  website text not null default 'https://www.paper-fox.co.uk/',
  facebook_url text not null default 'https://www.facebook.com/PaperFoxEvents/',
  facebook_group_url text not null default 'https://www.facebook.com/groups/paperfoxevents/',
  instagram_url text not null default 'https://www.instagram.com/paperfoxevents/',
  sign_off text not null default 'Nichola & Morag',
  -- Bank details for transfers. Added on the settings screen, never in code.
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_sort_code text not null default '',
  bank_account_number text not null default '',
  -- Replies to emails go here.
  email_reply_to text not null default 'hello@paper-fox.co.uk',
  -- While this has an address in it, every email goes there instead of to
  -- the customer, for trying the emails out safely.
  email_test_address text not null default '',
  -- Send B2, B3 or a thank you automatically when a payment is recorded.
  send_payment_emails boolean not null default true,
  terms_text text not null default '',
  terms_version integer not null default 1,
  terms_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  constraint settings_one_row check (singleton),
  constraint settings_short_text check (
    char_length(business_name) between 1 and 120
    and char_length(legal_name) <= 120
    and char_length(company_number) <= 20
    and char_length(phone) <= 40
    and char_length(sign_off) <= 120
    and char_length(bank_name) <= 80
    and char_length(bank_account_name) <= 80
  ),
  constraint settings_address_length check (char_length(address) <= 400),
  constraint settings_links_length check (
    char_length(website) <= 300
    and char_length(facebook_url) <= 300
    and char_length(facebook_group_url) <= 300
    and char_length(instagram_url) <= 300
  ),
  constraint settings_emails check (
    contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and email_reply_to ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and (email_test_address = '' or email_test_address ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  ),
  constraint settings_sort_code check (bank_sort_code ~ '^(\d{2}-\d{2}-\d{2})?$'),
  constraint settings_account_number check (bank_account_number ~ '^(\d{8})?$'),
  constraint settings_terms_length check (char_length(terms_text) <= 30000)
);

comment on table public.settings is
  'Paper Fox''s settings: one row. Owners change it; owners and admins read it.';

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function private.set_updated_at();

create trigger settings_audit
  after insert or update or delete on public.settings
  for each row execute function private.record_change();

-- Every version of the terms, kept for good.
create table public.terms_versions (
  version integer primary key,
  terms_text text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null
);

comment on table public.terms_versions is
  'Every version of the terms and conditions. Public, like the terms themselves.';

-- A change to the terms makes a new version.
create or replace function private.version_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  if new.terms_text is distinct from old.terms_text then
    new.terms_version := old.terms_version + 1;
    new.terms_updated_at := now();
    insert into public.terms_versions (version, terms_text)
    values (new.terms_version, new.terms_text);
  else
    new.terms_version := old.terms_version;
    new.terms_updated_at := old.terms_updated_at;
  end if;
  return new;
end;
$$;

create trigger settings_version_terms
  before update on public.settings
  for each row execute function private.version_terms();

alter table public.settings enable row level security;
alter table public.terms_versions enable row level security;

revoke all on public.settings, public.terms_versions from anon, authenticated;
grant select on public.settings to authenticated;
grant update (
  business_name, legal_name, company_number, contact_email, phone, address,
  website, facebook_url, facebook_group_url, instagram_url, sign_off,
  bank_name, bank_account_name, bank_sort_code, bank_account_number,
  email_reply_to, email_test_address, send_payment_emails, terms_text
) on public.settings to authenticated;
grant select on public.terms_versions to anon, authenticated;

create policy "Owners and admins read the settings"
  on public.settings for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners change the settings"
  on public.settings for update
  to authenticated
  using ((select private.has_staff_role(array['owner']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner']::public.staff_role[])));

create policy "Anyone can read the terms"
  on public.terms_versions for select
  to anon, authenticated
  using (true);

-- The 2026 terms, from Paper Fox's PDF (docs/reference), word for word apart
-- from spacing and the capital letters in the headings.
insert into public.settings (terms_text) values ($terms$"Company" means Paper Fox Events Ltd.

"Personal Data" means personal data as defined under the act.

"Fees" means the fees set out or calculated in accordance with the rates or charges as advertised on our website and booking form.

"Customer" means the person attending the event.

"Event" means crop, escape, retreat, class.

"Venue" means the hotel where the event is taking place.

"Goods" means kits, goody bags, product provided as part of an event.

## Price and payment

1. To book on any Company event the customer is required to complete the appropriate booking form on the Company official website. Upon receipt of the completed booking form, the Company will issue an invoice to the customer will then be sent an invoice for the deposit element portion of the fee or full payment, if booking within six weeks of the event start date. The Company will issue a reminder the balance approximately six weeks before the event.

2. Payments must be paid within 48 hours of receipt, or the place will not be held.

3. Bookings are only confirmed once payment has been received.

4. The customer shall pay fees and abide by the payment terms and methods of payments will be clearly detailed on the booking form.

5. For bookings made within six weeks of the event starting, full payment is required immediately on receipt of invoice.

6. The initial deposit is non-refundable or transferable.

7. All goods remain the property of the Company until full payment is received by the Company.

## Liabilities & responsibilities

1. The customer is responsible for booking accommodation with the hotel if required. Any changes to those arrangements are the customer's responsibility.

2. The company, its employees or representatives shall not be liable or responsible for any loss, theft, or damage to personal property. Furthermore, the company will also not be liable for damage or injury to persons. This includes items that are left in the event room unattended.

3. The venue is responsible for any required risk assessments. The onus is on the customer to ensure that they do not cause any potential harm to those around them such as trip hazards, electrical shock, etc.

4. The venue is responsible for complying with all relevant health and safety requirements.

## Cancellations

1. Cancellation by the Company

The Company reserves the right to cancel any booking without liability. In the event that the Company cancels an event or booking, the Customer will receive a full refund of all event fees paid to the Company. No further compensation shall be payable.

2. Cancellation by the Customer – more than six weeks' notice

If the Customer cancels their booking more than six (6) weeks prior to the first day of the event, a £60 administration fee will be retained to cover administrative costs incurred. Any monies paid in excess of this administration fee will be refunded. If the customer cancels within the six week period and the full balance has been paid, the Company will ensure that any products such as 'goody bags' are posted to the customer after the event.

3. Cancellation by the Customer – within six weeks of the event

If the Customer cancels their booking within six (6) weeks of the first day of the event, all monies paid are non-refundable.

Where possible, the Company may attempt to re-advertise and fill the cancelled place. If the Company is successful in reselling the space, a 25% administration surcharge will be deducted from the total event fee (in addition to the non-refundable booking deposit). Any remaining balance may be transferred as credit towards a future event or used against the Company's products. The original booking deposit remains non-refundable in all circumstances.

4. Customer – arranged replacement

If the Customer is unable to attend the event, they may request that a suitable replacement attend in their place. Any replacement attendee must be approved in advance by the Company, and the Customer must obtain prior written consent from the Company before making any such arrangement. The Company reserves the absolute right to approve or decline any proposed replacement at its discretion.

Customers are strictly prohibited from advertising, reselling, transferring, or offering their place for sale on social media, online marketplaces, community groups, or through other crafting businesses or event organisers. This restriction is in place to ensure the Company maintains control over event attendance and the suitability of all participants.

All replacement arrangements must be coordinated directly with and approved by the Company before the event. Failure to comply with this requirement may result in the booking being cancelled without refund.

If a replacement attendee is approved by the Company, any financial arrangements must be settled privately between the original Customer and the replacement attendee. The Company accepts no responsibility for handling, facilitating, or mediating these private transactions.

The Company must be formally notified of any approved substitution prior to the event.

The original booking deposit remains non-refundable in all circumstances.

5. Event materials, kits and products

Any event materials, including goody bags, kits, or other products associated with the event, remain payable in full regardless of attendance. If the Customer cancels within six (6) weeks of the event and their place is not filled, any applicable materials (such as goody bags or kits) will be posted to the Customer after the event at the Customer's expense and within a reasonable timeframe.

If the Customer's place is filled by a replacement attendee (either arranged by the Company or the Customer and approved by the Company), the goody bag and any event materials will be provided to the replacement attendee at the event.

6. Accommodation, travel and expenses

Any transport, hotel or additional expenses incurred by the customer it is the customer's responsibility and are not the responsibility of to recover these not the Company.

## Force majeure

Neither party shall be liable for event cancellation due to any pandemic, act of God, act of terrorism, war, strike, lock-out, industrial action, fire, flood, drought, tempest or any other event beyond the reasonable control of either party.

Should an event cancel then the Company will do its best endeavours to reschedule as soon as is possible. The Company will follow any government guidance and legislation that is in force at that time. However, any out-of-pocket cost such as kits, goody bags or other items will not be refunded but will be sent to you.

## Personal data

The Company has secure systems and processes in place to ensure customers data is held securely. Should you wish to find out more about how we protect your information you may request copies of the following Company documents:

- Information Protection Policy
- Subject Access Code of Practice
- Data Protection Systems
- GDPR Privacy Policy$terms$);

insert into public.terms_versions (version, terms_text, created_by)
select 1, terms_text, null from public.settings;

-- ---------------------------------------------------------------------------
-- Email wording
-- ---------------------------------------------------------------------------

create table public.email_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  -- When it's sent, in plain words, for the Emails screen.
  description text not null default '',
  subject text not null,
  body text not null,
  attach_booking_details boolean not null default false,
  attach_confirmation boolean not null default false,
  attach_terms boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  constraint email_templates_key check (key in ('B1', 'B2', 'B3', 'thanks', 'balance_reminder')),
  constraint email_templates_subject_length check (char_length(subject) between 1 and 200),
  constraint email_templates_body_length check (char_length(body) between 1 and 20000)
);

comment on table public.email_templates is
  'The wording of each standard email, with {{placeholders}}. Owners and admins edit it.';

create trigger email_templates_set_updated_at
  before update on public.email_templates
  for each row execute function private.set_updated_at();

create trigger email_templates_audit
  after insert or update or delete on public.email_templates
  for each row execute function private.record_change();

alter table public.email_templates enable row level security;
revoke all on public.email_templates from anon, authenticated;
grant select on public.email_templates to authenticated;
grant update (subject, body, attach_booking_details, attach_confirmation, attach_terms)
  on public.email_templates to authenticated;

create policy "Owners and admins read the email wording"
  on public.email_templates for select
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

create policy "Owners and admins change the email wording"
  on public.email_templates for update
  to authenticated
  using ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])))
  with check ((select private.has_staff_role(array['owner', 'admin']::public.staff_role[])));

-- Paper Fox's current emails (docs/reference/current-emails.md), with the
-- details of each booking filled in from {{placeholders}}. The sign-off and
-- social links are added to every email automatically.
insert into public.email_templates
  (key, name, description, subject, body, attach_booking_details, attach_terms, attach_confirmation, sort_order)
values
(
  'B1', 'B1: booking received',
  'When someone books. Their place is held until the deposit arrives.',
  '{{event}}: we''ve received your booking',
  $b1$Hello {{first_name}}

We are delighted to confirm that we have received your booking form and we have reserved a place for you on the {{event}} event, {{event_dates}}.

The prices are:

{{prices}}

Please find attached:

- the booking details, with all the information you need to know at the time of booking, including how to pay;
- the booking terms and conditions. Please read through these carefully.

Your place is reserved for a short time, and is only confirmed when we receive your deposit or full payment. This is due by {{deposit_due_by}}. After this date your place will be released.

To pay by bank transfer:

{{bank_details}}

You can book a hotel room direct with the hotel to get our rate. All the details are in the booking details. We highly recommend you do this as soon as possible, as they only hold our rate for a limited amount of time. Please make sure you book the room in the name required, as duplicate names will likely result in the room being cancelled (for example, if you book a room for someone else in your name).

IMPORTANT: please read the terms and conditions, as deposits are non-refundable under any circumstance, unless of course we have to cancel your place or the event.

What happens next?

- When your payment is received, you will receive a confirmation email. This confirms that your place is secured, and includes details of a private Facebook group. Don't worry if you are not on Facebook: you still receive important information by email.
- The balancing payment is due by {{balance_due_on}}, six weeks before the start of the event.
- About four weeks before our crafting weekend, we will contact you about optional self-paced class kits. Delegates may buy a kit before they go on general sale to the public.
- A few days before the event, you will receive an email with full details of everything you need to know for a great weekend away. It includes arrival, the timetable for the weekend, local amenities and typical FAQs. This should cover any questions you may have, but if not, feel free to pop us an email.

It is important to us that you have a relaxed, enjoyable weekend, so we will keep you informed along the way.

Thank you again for choosing Paper Fox. We are looking forward to spending a weekend of crafting with you.$b1$,
  true, true, false, 1
),
(
  'B2', 'B2: deposit received',
  'When their deposit is paid. Their place is secured.',
  '{{event}}: thank you for your payment',
  $b2$Hello {{first_name}}

Thank you for your payment and we are delighted to confirm your place is now secured.

Everything you need to know at this stage is on the attached document, including our private event Facebook group, {{facebook_group}}, and details of how to book hotel rooms should you need one. Please note the Facebook group is open, but some people have had issues joining: please come back to us if you have any problems.

If you have any other questions, you can ask in the Facebook group or pop us an email.

We would HIGHLY recommend you get your hotel room booked as soon as possible to make sure you get our lower rate. They don't take the money and you can cancel up to 5 days before, but they do need a credit card to hold your room.

You have paid {{paid}} of {{total}}. Your balance of {{balance}} is due by {{balance_due_on}}, but don't worry, we will remind you nearer the time.$b2$,
  false, false, true, 2
),
(
  'B3', 'B3: paid in full',
  'When they''ve paid in full, whether all at once or with the balance.',
  '{{event}}: thank you for your full payment',
  $b3$Hello {{first_name}}

Thank you for your full payment and we are delighted to confirm your place is secured.

Everything you need to know at this stage is on the attached document, including our private event Facebook group, {{facebook_group}}, and details of how to book hotel rooms should you need one. Please note the Facebook group is open, but some people have had issues joining: please come back to us if you have any problems.

If you have any other questions, you can ask in the Facebook group or pop us an email.

We would HIGHLY recommend you get your hotel room booked as soon as possible to make sure you get our lower rate. They don't take the money and you can cancel up to 5 days before, but they do need a credit card to hold your room.$b3$,
  false, false, true, 3
),
(
  'thanks', 'Thanks for your payment',
  'When a payment arrives that doesn''t complete the deposit or the balance, for example paying in parts.',
  '{{event}}: thank you for your payment',
  $thanks$Hello {{first_name}}

Thank you for your payment of {{amount_received}}, which we received on {{received_on}}.

You have now paid {{paid}} of {{total}}. The rest, {{balance}}, is due by {{balance_due_on}}.

To pay by bank transfer:

{{bank_details}}$thanks$,
  false, false, false, 4
),
(
  'balance_reminder', 'Balance reminder',
  'Before the balance due date, to anyone who still owes money.',
  '{{event}}: your balance is due by {{balance_due_on}}',
  $reminder$Hello {{first_name}}

We're really looking forward to seeing you at {{event}}, {{event_dates}}.

Just a reminder that your balance of {{balance}} is due by {{balance_due_on}}. You have paid {{paid}} of {{total}} so far.

To pay by bank transfer:

{{bank_details}}

If you've already paid, thank you, and please ignore this email. Bank transfers can take a few days to reach us.$reminder$,
  false, false, false, 5
);

-- ---------------------------------------------------------------------------
-- The email log: what the system sends
-- ---------------------------------------------------------------------------

alter table public.email_log
  add column to_email text not null default '',
  add column body text not null default '',
  add column attachments text[] not null default '{}',
  add column provider_message_id text,
  add column error text not null default '',
  add constraint email_log_to_email_length check (char_length(to_email) <= 320),
  add constraint email_log_body_length check (char_length(body) <= 50000),
  add constraint email_log_error_length check (char_length(error) <= 1000);

-- Records an email the system has just sent (or tried to send) about a
-- booking. Only owners and admins can, and nobody can change the log after.
create or replace function public.log_email(
  booking_id uuid,
  template text,
  subject text,
  to_email text,
  body text,
  attachments text[],
  sent boolean,
  provider_message_id text default null,
  error text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer uuid;
  new_id uuid;
begin
  if not (select private.has_staff_role(array['owner', 'admin']::public.staff_role[])) then
    raise exception 'Only owners and admins can send emails' using errcode = '42501';
  end if;
  select b.customer_id into customer from public.bookings b where b.id = log_email.booking_id;
  if not found then
    raise exception 'That booking couldn''t be found.';
  end if;
  insert into public.email_log (
    booking_id, customer_id, template, subject, to_email, body, attachments,
    sent_on, sent_at, outside_system, status, provider_message_id, error
  )
  values (
    log_email.booking_id, customer, log_email.template, left(log_email.subject, 300),
    log_email.to_email, left(log_email.body, 50000), coalesce(log_email.attachments, '{}'),
    case when log_email.sent then (now() at time zone 'Europe/London')::date end,
    now(), false, case when log_email.sent then 'sent' else 'failed' end,
    log_email.provider_message_id, left(coalesce(log_email.error, ''), 1000)
  )
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.log_email(uuid, text, text, text, text, text[], boolean, text, text)
  from public, anon;
grant execute on function public.log_email(uuid, text, text, text, text, text[], boolean, text, text)
  to authenticated, service_role;
