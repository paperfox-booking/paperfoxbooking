# Data model

The database is Supabase Postgres. Every table holding personal or booking
data has row level security (RLS), so the database itself decides who can see
and change each row, whatever the app does.

## People and the team (Phase 0)

```mermaid
erDiagram
  AUTH_USERS ||--|| PROFILES : "has one"
  AUTH_USERS ||--o| STAFF : "may be"

  AUTH_USERS {
    uuid id PK
    text email
  }
  PROFILES {
    uuid id PK "same as auth.users.id"
    text email "copied from auth.users"
    text full_name
    text phone
    boolean marketing_consent
    timestamptz marketing_consent_at "set automatically"
    text marketing_consent_source "how it was given"
    timestamptz created_at
    timestamptz updated_at
  }
  STAFF {
    uuid user_id PK
    staff_role role "owner, admin or door"
    uuid created_by
    timestamptz created_at
    timestamptz updated_at
  }
```

- **`auth.users`** belongs to Supabase Auth. A row is created the first time
  someone signs in with a code.
- **`profiles`** gets one row per person, created automatically by a trigger.
  Its email follows any change in `auth.users`.
- **`staff`** lists the Paper Fox team and their role.

## Who can do what

|                                           | Customer | Door staff | Admin | Owner |
| ----------------------------------------- | -------- | ---------- | ----- | ----- |
| Read own profile                          | ✓        | ✓          | ✓     | ✓     |
| Read other people's profiles              |          | ✓          | ✓     | ✓     |
| Change own name, phone, marketing consent | ✓        | ✓          | ✓     | ✓     |
| Change other people's profiles            |          |            | ✓     | ✓     |
| Change anyone's email directly            |          |            |       |       |
| Read own staff row                        |          | ✓          | ✓     | ✓     |
| Read, add, change and remove staff        |          |            |       | ✓     |

- Visitors who aren't signed in can't read either table at all.
- There must always be at least one owner. The database refuses to remove or
  demote the last one.
- The same rules are in `src/lib/auth/permissions.ts` for the app, and
  `tests/db/profiles-and-staff.test.ts` proves the database enforces them.

## Events (Phase 1)

```mermaid
erDiagram
  VENUES ||--o{ EVENTS : "holds"
  EVENTS ||--o{ TICKET_TYPES : "offers"
  EVENTS |o--o{ EVENTS : "copied from"

  VENUES {
    uuid id PK
    text name
    text address "one line per line"
    text postcode
    text phone
    text map_url
    text parking
    text access_info
    timestamptz deleted_at
  }
  EVENTS {
    uuid id PK
    text slug "web address, set once from the title"
    text title
    text summary
    text description
    text included "one item per line"
    text hotel_info
    text facebook_group_url "team and booked people only"
    uuid venue_id FK
    timestamptz starts_at "UTC"
    timestamptz ends_at "UTC"
    event_status status "draft, published, sold_out, cancelled, finished"
    integer capacity
    timestamptz booking_opens_at
    timestamptz booking_closes_at
    date balance_due_on "6 weeks before unless changed"
    integer deposit_hold_days "7 unless changed"
    uuid copied_from_event_id FK
    timestamptz deleted_at "drafts only"
  }
  TICKET_TYPES {
    uuid id PK
    uuid event_id FK
    text name "for example Weekend (4pm start)"
    text description
    integer price_pence
    integer deposit_pence "empty means pay in full"
    text currency "GBP"
    timestamptz starts_at "if different from the event"
    integer capacity "optional limit of its own"
    integer sort_order
    boolean on_sale
    timestamptz deleted_at
  }
```

- **Money** is whole pence. A deposit must be more than £0 and less than the
  full price; empty means pay in full.
- **Dates** are stored in UTC and shown in UK time. The balance due date is a
  plain date, and must be before the UK date the event starts.
- **Statuses:** an event can only be published once it has an option on
  sale. A cancelled event can't be reopened. Only drafts can be deleted.
- **Copying** (`public.copy_event`) makes a draft with every date moved on by
  the same number of days, keeping UK clock times across the clocks
  changing. It copies the options but not the Facebook group, which is
  different for each event.
- **Moving** an event: when its start moves to another UK date, a trigger
  (`events_move_options`) moves each option's own start by the same number
  of days, keeping its UK clock time. Options without their own start, and
  removed options, are left alone.
- Every table has `created_at`, `updated_at` and `created_by`.

### Who can do what with events

|                                                                     | Visitor | Customer | Door staff | Admin | Owner |
| ------------------------------------------------------------------- | ------- | -------- | ---------- | ----- | ----- |
| Read published events, their options and venues                     | ✓       | ✓        | ✓          | ✓     | ✓     |
| Read an event's Facebook group, joining details and class kits text |         | ✓\*      | ✓          | ✓     | ✓     |
| Read drafts                                                         |         |          | ✓          | ✓     | ✓     |
| Add and change venues, events and options; copy events              |         |          |            | ✓     | ✓     |
| Change an event's web address, or who created a record              |         |          |            |       |       |
| Delete rows outright (records are marked deleted)                   |         |          |            |       |       |

\* Only for an event they have a booking on (not cancelled). Nobody signed
in can select these three columns directly: they come from
`public.event_private_details(event_ids)`, which gives them to the team and
to people booked on the event.

`tests/db/events.test.ts` and `tests/db/customer-settings.test.ts` prove
these rules.

## People, bookings and money (Phase 2)

```mermaid
erDiagram
  CUSTOMERS ||--o{ BOOKINGS : "books"
  EVENTS ||--o{ BOOKINGS : "has"
  TICKET_TYPES |o--o{ BOOKINGS : "chosen"
  EVENT_ROOMS |o--o{ BOOKINGS : "seated in"
  EVENTS ||--o{ EVENT_ROOMS : "has"
  EVENTS ||--o{ EVENT_COSTS : "costs"
  BOOKINGS ||--o{ PAYMENTS : "paid by"
  BOOKINGS ||--o{ REFUNDS : "paid back by"
  BOOKINGS ||--o{ EMAIL_LOG : "emails"
  AUTH_USERS |o--o| CUSTOMERS : "signs in as"

  CUSTOMERS {
    uuid id PK
    uuid user_id FK "set when they sign in with the same email"
    text full_name
    text email "lower case, one person each"
    text phone
    text emergency_contact
    text dietary_health "special category data"
    text notes
    boolean is_team "listed first, like AA rows"
  }
  BOOKINGS {
    uuid id PK
    text reference "PF-2027-0001, no gaps"
    uuid event_id FK
    uuid customer_id FK
    uuid ticket_type_id FK "empty for a free team place"
    uuid room_id FK
    integer price_pence "kept even if the option's price changes"
    integer deposit_pence
    text price_note "why the price differs"
    text notes
    text payment_notes
    text source "staff, import or online"
    timestamptz cancelled_at
    text cancel_reason
    timestamptz checked_in_at "when they arrived"
    uuid checked_in_by FK
  }
  EVENT_ROOMS {
    uuid id PK
    uuid event_id FK
    text name
    integer capacity "a guide only"
    text notes
  }
  PAYMENTS {
    uuid id PK
    uuid booking_id FK
    integer amount_pence
    payment_method method "bank_transfer, cash, card, other"
    date received_on "empty only for imported totals"
    text note
    uuid recorded_by FK
    timestamptz deleted_at "removed, with a reason"
    text delete_reason
  }
  REFUNDS {
    uuid id PK
    uuid booking_id FK
    integer amount_pence
    payment_method method "how it was paid back"
    date refunded_on
    text reason
    uuid recorded_by FK
    timestamptz deleted_at "removed, with a reason"
    text delete_reason
  }
  EMAIL_LOG {
    uuid id PK
    uuid booking_id FK
    uuid customer_id FK
    text template "B1, B2, B3, thanks, balance_reminder, other"
    date sent_on
    boolean outside_system
    text status
  }
  EVENT_COSTS {
    uuid id PK
    uuid event_id FK
    text category "venue, food, goody_bags and so on"
    text description
    text supplier
    integer amount_pence
    boolean paid
  }
```

- **One booking is one person's place on one event.** What they've paid and
  still owe is always worked out from their payments, never typed in.
- **Booking references** come from one counter per year, inside the
  booking's own transaction, so there are no gaps or duplicates.
- **No overbooking.** Adding a booking (or reinstating one) locks the event
  and checks its places, and the option's own limit if it has one. Two
  people taking the last place at the same moment can't both succeed.
- **Payments are never edited or deleted.** A mistake is removed with a
  reason, and stays in the history.
- **Refunds** work the same way. What someone has paid is always their
  payments less their refunds, everywhere (the people list, emails, reports
  and their account). A booking can never be refunded more than it's been
  paid: the database locks the booking and refuses a refund that would, or
  removing a payment that would leave it that way.
- **`public.import_bookings`** brings a checked spreadsheet into an event
  with nobody booked yet, all at once or not at all. It reuses people
  already on file (matched by email).
- **`audit_log`** records every change to events, options, bookings,
  payments and costs, with who made it. Nobody can change it.
- **`public.pass_place(booking_id, new_customer_id, reason)`** passes a
  place to someone else (owners and admins only): the booking, with its
  reference and payments, moves to them in one step, the reason is added to
  its notes, someone already booked on the event is refused, and the new
  person comes off the event's waiting list.
- **Linking accounts:** a person's record is linked to a sign-in account
  with the same email address once that address is confirmed, whether the
  account or the record came first.
- **`public.set_checked_in(booking_id, arrived)`** marks someone as arrived,
  or undoes it. Any team member can, door staff included, but only for a
  booking that isn't cancelled. Pressing Arrived twice keeps the first time.

### Who can do what with people and money

|                                                      | Customer | Door staff | Admin | Owner |
| ---------------------------------------------------- | -------- | ---------- | ----- | ----- |
| Read their own record, bookings, payments, refunds   | ✓        |            |       |       |
| Read everyone's records and bookings                 |          | ✓          | ✓     | ✓     |
| Add and change people, bookings and rooms            |          |            | ✓     | ✓     |
| Read and record payments and refunds; emails         |          |            | ✓     | ✓     |
| Check people in on the day                           |          | ✓          | ✓     | ✓     |
| Read and change costs; read the audit log            |          |            | ✓     | ✓     |
| Edit or delete a payment or refund, or the audit log |          |            |       |       |

Customers can't read the payments and refunds tables themselves:
`public.my_booking_money(booking_ids)` gives them the amounts, dates and
methods for their own bookings, without the team's notes.

`tests/db/bookings.test.ts`, `tests/db/refunds.test.ts`,
`tests/db/costs.test.ts` and `tests/db/check-in.test.ts` prove these rules.

## Settings and emails

```mermaid
erDiagram
  SETTINGS ||--o{ TERMS_VERSIONS : "every version of the terms"
  BOOKINGS ||--o{ EMAIL_LOG : "emails"

  SETTINGS {
    uuid id PK
    boolean singleton "only ever one row"
    text business_name
    text bank_sort_code "12-34-56"
    text bank_account_number "8 digits"
    text email_reply_to
    text email_test_address "when set, every email goes here"
    boolean send_payment_emails "B2, B3 or thanks after a payment"
    text terms_text
    integer terms_version "goes up when the terms change"
  }
  TERMS_VERSIONS {
    integer version PK
    text terms_text
    timestamptz created_at
  }
  EMAIL_TEMPLATES {
    uuid id PK
    text key "B1, B2, B3, thanks, balance_reminder"
    text subject "with {{placeholders}}"
    text body
    boolean attach_booking_details
    boolean attach_confirmation
    boolean attach_terms
  }
  EMAIL_LOG {
    uuid id PK
    text to_email
    text subject
    text body "as sent"
    text_array attachments
    text status "sent or failed"
    text error "why it failed"
    text provider_message_id "Resend's id"
  }
```

- **Settings** is one row. Owners and admins can read it (the emails need
  the bank details); only owners can change it.
- **Terms:** changing the wording makes a new version in `terms_versions`,
  kept for good, so we always know what someone was sent. The terms are
  public, so anyone can read them.
- **Email wording** is in `email_templates`. Owners and admins change it.
- **The email log** can't be changed by anyone. The system adds to it
  through `public.log_email()`, which only owners and admins can use.
  Emails sent outside the system can still be recorded by hand.

`tests/db/settings-and-emails.test.ts` proves these rules.

## The waiting list

- **`waitlist`**: event, customer, the option they'd like, notes, status
  (`waiting`, `offered`, `booked`, `declined`, `removed`), when a place was
  offered and the last day to accept, and the booking once they're booked.
- Someone can only be waiting (or offered a place) once per event.
- **`public.book_from_waitlist(waitlist_id, option_id, room_id)`** makes the
  booking at the option's price and marks them booked, together. The
  booking's own checks still apply, so a full event refuses it.
- Owners and admins only. `tests/db/waiting-list.test.ts` proves these rules.

## Helper functions

These live in the `private` schema, which the API doesn't expose:

- `private.is_staff()`;
- `private.has_staff_role(roles)`;
- `private.current_staff_role()`.

RLS policies call them. They're `security definer`, so a policy on one table
can check the staff table without opening it up.

## Coming next

Following CLAUDE.md section 6, with the changes agreed in section 15:

| Phase | Tables                                                                               |
| ----- | ------------------------------------------------------------------------------------ |
| 2     | Sending the B1, B2 and B3 emails, balance reminders and chasers (`scheduled_emails`) |
| 3     | `waitlist`, holds and expiry, `scheduled_emails`                                     |
| 4     | Credit towards a future event                                                        |
