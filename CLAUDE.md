# Claude Code build prompt: Paper Fox event bookings

## How to use this file (for George)

1. Create a new **private** GitHub repository, for example `paper-fox-bookings`. Keep it separate from every other project.
2. Save this file in the repository's root as `CLAUDE.md`. Claude Code reads it at the start of every session.
3. Start a new Claude Code session on that repository only, and say: `Read CLAUDE.md in full, then ask me the questions in section 13 one at a time before starting Phase 0.`
4. Work one phase at a time. Each phase ends with a pull request and a plain English summary. Review it, then merge it yourself.

Everything below is written to Claude Code.

---

## 1. Your role and the goal

You are the lead engineer building a production quality online booking system for **Paper Fox**, a UK business that runs events every year. The person you work with is **George**, who is building it for the owner of Paper Fox.

People must be able to:

- browse upcoming events and see what's available;
- book places and pay, either in full or with a deposit;
- sign in to their own account to see their bookings, pay the balance they owe, and get receipts.

The Paper Fox team must be able to:

- create and run events, ticket types and prices;
- see every booking and who has paid what;
- take payments by bank transfer or cash, refund, cancel, and message attendees.

This is a brand new, standalone project with its own fresh database and its own accounts. It serves one business, Paper Fox: no multi-business or white label features.

Correctness around money, dates and places available matters more than speed. Work in small, testable steps. Ask before making a decision that would be expensive to reverse. Don't invent requirements: if something is unclear, ask George.

## 2. Who uses it

| Who | What they do |
| --- | --- |
| Visitors | See events and prices, start a booking. No sign in needed to browse. |
| Customers | Book and pay, sign in, see their bookings, pay balances, update attendee details, get receipts. |
| Owner | Everything, including settings, refunds and adding team members. |
| Admin | Run events and bookings, take manual payments, message attendees. No settings or team changes. |
| Door staff (if wanted) | Look up bookings and check people in on the day. Nothing else. |

## 3. Non negotiable rules

- **One fresh database for this project only.** Every table that holds personal or booking data has Postgres row level security. A customer can only ever read their own bookings, payments and details. This must be proven by automated tests.
- **TypeScript everywhere,** strict mode, with no `any` unless a comment justifies it.
- **Money is stored as integers in pence,** never floating point. Currency is GBP, with a `currency` column kept for later.
- **Dates and times are stored in UTC** and shown in `Europe/London`, using `date-fns` and `date-fns-tz`. The UI uses UK dates (`31/12/2027`) and 24 hour times.
- **Events can never be overbooked.** Places are taken inside a database transaction that locks the event or ticket type. A booking that's waiting for payment holds its places for 15 minutes, then releases them.
- **Payments are confirmed by Stripe's webhook, not by the browser returning.** Webhook handlers verify the signature and are idempotent, using the Stripe event id.
- **Secrets live in environment variables only.** Never commit them, and keep `.env.example` up to date. Never ask George to paste a key, token or password into chat: tell him exactly where to put it (Vercel's settings, Supabase's dashboard, a local `.env.local`).
- **Every database change is a migration file.** Never change the schema by hand in a dashboard.
- **Every feature ships with tests.** Anything touching money, places available, dates or permissions needs unit tests and at least one integration test.
- **Accessible and phone first.** Keyboard navigable, labelled form fields, enough contrast (WCAG 2.2 AA), and works well on a 375px wide screen. Most customers will book on a phone.
- **Plain English UI copy** in sentence case, with no jargon. Errors say what went wrong and how to fix it.
- **Docs are kept up to date** in `docs/`.
- **Small pull requests,** each with a plain English summary (see section 12). Commit after each task with a clear message. Never merge a pull request yourself: George merges.

## 4. Technology (don't change without asking)

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router), TypeScript, React Server Components where sensible | Read the bundled Next.js docs in `node_modules/next/dist/docs/` before relying on conventions; they change between versions |
| Styling | Tailwind CSS and shadcn/ui | Themed with Paper Fox's colours, fonts and logo |
| Database, sign in, files | Supabase: Postgres, Auth and Storage | A new project in the London region (eu-west-2). Firebase isn't needed: Supabase covers the database, sign in and file storage |
| Payments | Stripe Checkout, on Paper Fox's own Stripe account | Test mode until the owner says go live |
| Email | Resend, with React Email templates | Sent from Paper Fox's own domain once it's verified |
| Scheduled jobs | Vercel Cron, or Supabase `pg_cron` | For balance reminders, event reminders and releasing expired holds |
| Validation | Zod, shared between browser and server | On every server action and route |
| PDFs | `@react-pdf/renderer` | Receipts (and tickets, if wanted) |
| Hosting | Vercel (recommended for Next.js) or Netlify, as George chooses | Preview deployments for every pull request |
| Errors | Sentry, with personal data scrubbed | |
| Tests | Vitest (unit), Supabase local (database), Playwright (end to end), axe (accessibility) | |
| Package manager | pnpm | |
| CI | GitHub Actions: lint, type check, unit tests, database tests, a short browser test run | Keep CI quick (aim for under 10 minutes), as a private repository's Actions minutes are limited |

## 5. Accounts, environments and settings

All accounts should belong to Paper Fox (the owner's business email), so the business owns its data and its money. George sets them up, and Claude never needs the passwords.

- **GitHub:** the private repository.
- **Supabase:** two projects, `staging` and `production`, both in London.
- **Vercel** (or Netlify): the app.
- **Stripe:** Paper Fox's own account, test and live modes.
- **Resend:** for email, with the sending domain verified.
- **The domain:** for example `book.paperfox.co.uk`, plus the email domain.
- **Sentry:** for errors.

There are three environments: local, staging and production.

Provide `.env.example`, with every variable and a one line description, including:

```
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY            # server only
DATABASE_URL                         # migrations and tests only
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
RESEND_API_KEY
EMAIL_FROM                           # e.g. "Paper Fox <bookings@paperfox.co.uk>"
CRON_SECRET                          # protects scheduled endpoints
SENTRY_DSN
```

Write `docs/setup.md`: a step by step guide for George covering each account, which region to choose, where each setting goes, and how to run everything locally.

## 6. Data model

All ids are UUIDs. Tables have `created_at` and `updated_at`, and `created_by` where staff create records. Records that others point to use soft delete (`deleted_at`). Document the model with a diagram in `docs/data-model.md`.

- `profiles`: user id (from Supabase Auth), full name, phone, marketing consent (with when and how it was given).
- `staff`: user id, role (`owner`, `admin`, `door`).
- `venues`: name, address, map link, parking and access information.
- `events`: title, slug, description, images, venue, `starts_at`, `ends_at`, status (`draft`, `published`, `sold_out`, `cancelled`, `finished`), booking opens and closes, overall capacity, deposit rule, balance due rule, terms, and `copied_from_event_id`.
- `ticket_types`: event, name (for example Adult, Child, Table of 8, Stall), description, `price_pence`, optional capacity of its own, minimum and maximum per booking, sort order, on sale or not.
- `bookings`: reference (human readable, for example `PF-2027-0001`, with no gaps or duplicates), customer, event.
  - Status: `held`, `awaiting_payment`, `deposit_paid`, `paid`, `cancelled` or `refunded`.
  - Money: `total_pence`, `paid_pence`, `balance_due_on`.
  - Hold: `hold_expires_at`.
  - Other: source (online or staff), notes, and terms accepted (version and time).
- `booking_items`: booking, ticket type, quantity, `unit_price_pence`.
- `attendees`: booking, name, and the answers to the event's questions (for example dietary needs or access needs), stored as JSONB and validated.
- `event_questions`: event, question, type, required or not.
- `payments`: booking, `amount_pence`, method (`card`, `bank_transfer`, `cash`, `other`), Stripe checkout session and payment intent ids, received at, recorded by.
- `refunds`: payment, `amount_pence`, reason, Stripe refund id, status.
- `stripe_events`: Stripe event id and type, processed at (for idempotency).
- `scheduled_emails` and `email_log`: what was sent, to whom, when, and whether it was delivered.
- `discount_codes` and `waitlist`: only if George asks for them (section 13).
- `audit_log`: who changed what and when, with values before and after, for bookings, payments, refunds and events.
- `settings`: business details, bank details for transfers, terms and refund policy wording, and email sender.

**Money rules, in one place and unit tested:**

- the deposit (none, a fixed amount per booking or per ticket, or a percentage);
- the balance due date (for example 6 weeks before the event);
- what's still owed;
- what happens when a booking is made after the balance due date (pay in full).

## 7. What it does

### 7.1 Public pages (no sign in)

- **Home and events list:** upcoming events with dates, venue, the starting price and how many places are left ("Only 6 left", "Sold out").
- **Event page:** description, photos, venue and map, ticket types and prices, deposit and balance terms in plain words, and a **Book** button.
- Pages that can be shared, with good link previews (Open Graph images), and fast on a phone.
- Privacy, terms and cookies pages, with their wording supplied by Paper Fox.

### 7.2 Booking and checkout

1. Choose ticket types and quantities. The real-time places check shows a clear message if something sells out.
2. Enter an email address. An account is created or matched automatically, and they sign in by an emailed link, with no password needed (a password is optional).
3. Give attendee details and answers to the event's questions.
4. Choose to **pay in full** or **pay the deposit** (when the event allows a deposit), and accept the terms.
5. Pay by Stripe Checkout. The places are held for 15 minutes while they pay.
6. See a confirmation page with the booking reference, and get a confirmation email with the receipt (and tickets, if wanted).

Abuse protection on public forms: rate limiting, plus a CAPTCHA option.

### 7.3 Customer account

- **My bookings:** upcoming and past bookings, each showing what was booked, total, paid, **balance owed and the date it's due**.
- **Pay balance:** pays what's left (or part of it, if Paper Fox allows) through Stripe Checkout, and updates straight away once Stripe confirms.
- **Receipts:** download each one as a PDF, plus a full statement of payments for a booking.
- **Attendee details:** change them until a cut off set per event.
- **My details:** contact details and marketing consent, and a request to delete the account (handled within UK GDPR).
- **Cancellation request:** following Paper Fox's policy, which is shown to them before they confirm.

### 7.4 Emails and reminders

All emails are branded, plain English, and work on a phone. They're sent by a scheduled job that runs every 15 minutes, which re-checks each email is still needed before sending (for example, the balance is still unpaid).

- **Booking confirmation:** with the receipt, and tickets if wanted.
- **Payment receipt:** for every payment, by card or recorded by staff.
- **Balance reminders:** for example 14 days and 3 days before the due date, with a "Pay your balance" button. Then overdue notices.
- **Event reminder:** a few days before, with venue, times, parking and what to bring.
- **Cancellation and refund confirmations.**
- **Sign in links.**
- **Messages from Paper Fox** to everyone booked on an event (see 7.5).
- **Delivery tracking:** a log of what was sent, with bounces and failures shown to staff.

### 7.5 Admin area (Paper Fox team)

- **Dashboard:** upcoming events with places sold out of capacity, money taken, **balances still owed and overdue**, and today's emails that failed.
- **Events:**
  - create, edit, publish, cancel;
  - ticket types and prices, questions for attendees, deposit and balance rules, and images;
  - **copy last year's event** to make this year's in one step (dates moved on, everything else kept).
- **Bookings:**
  - search by name, email or reference, and filter by event, status, or balance owed or overdue;
  - booking page: items, attendees, payments timeline, emails sent, and the audit trail;
  - actions: record a bank transfer or cash payment, refund a card payment (in full or part) through Stripe, cancel, change attendees, resend emails, and add a booking for someone by phone;
  - every action is recorded in the audit log.
- **Attendee lists:** per event, printable, and exportable to CSV (names, tickets, answers, dietary and access needs).
- **Message attendees:** email everyone booked on an event, with a preview first.
- **Check in** (if wanted): search by name or reference, or scan the QR code on the ticket on a phone, and mark people as arrived.
- **Reports:** sales by event, payments by date (card versus bank transfer versus cash, for reconciling with Stripe and the bank), outstanding balances and refunds. All exportable to CSV.
- **Settings** (owner only):
  - business details, logo and colours;
  - bank details shown for transfers;
  - terms and refund policy wording;
  - email sender;
  - team members and their roles.

## 8. Security, privacy and money

- Row level security on every table. The service role key is used only in trusted server code.
- Staff permissions are checked on the server and in the database, not just hidden in the UI.
- Zod validation on every input. Security headers, CSRF protection on forms, and rate limits on sign in and booking.
- Stripe card details never touch this app (Stripe Checkout handles them). Never log secrets or card data.
- UK GDPR:
  - export everything held about a customer;
  - delete a customer on request (keeping only what accounting law requires, made anonymous);
  - a retention setting;
  - a breach process in `docs/security.md`.
- Backups: Supabase paid plan with daily backups on production. Document a restore, and rehearse it once before launch.
- If Paper Fox is VAT registered: prices include VAT, and receipts show the VAT number and the VAT amount.

## 9. Design

- **Paper Fox's own brand:** logo, colours and fonts (supplied by George). Defined as theme tokens in one place.
- Phone first, warm and simple, with big buttons for tapping.
- One clear action per screen in the booking flow, with a progress indicator (Tickets, Details, Pay).
- Empty states that say what to do next.
- Installable on a phone's home screen, as a progressive web app (manifest and icons), so the team can use it at the door.

## 10. Testing and quality

- **Unit tests:**
  - deposits, balances and due dates;
  - booking references;
  - places available and holds;
  - receipt totals;
  - permission checks;
  - email scheduling.
- **Database tests:**
  - row level security: customer A can't read or change customer B's anything;
  - door staff can't see payments, and admins can't change settings;
  - two people buying the last place at the same moment: exactly one succeeds.
- **Stripe integration tests** with recorded fixtures: deposit paid, balance paid, refund, duplicate webhook, and a webhook for an unknown booking.
- **Playwright end to end, at phone and desktop sizes, with accessibility checks:**
  - browse;
  - book with a deposit (Stripe test card);
  - sign in by email link;
  - pay the balance;
  - admin creates an event by copying last year's;
  - admin records a bank transfer;
  - refund;
  - attendee CSV export.
- **`pnpm seed`:** creates realistic made-up events, customers and bookings for local development and demos. No real customer data in seeds or tests.
- CI must pass before George merges.

## 11. Docs and runbooks (in `docs/`)

- `setup.md`: accounts, regions, settings and running locally.
- `deploy.md`: how `main` deploys to production, previews, database migrations, and rolling back.
- `running-an-event.md`: for the Paper Fox team, in plain English. Creating an event, copying last year's, chasing balances, the door, refunds, exporting lists.
- `payments.md`: Stripe setup, webhooks, test cards, going live, and reconciling with the bank.
- `security.md`: access, secrets, backups and the breach process.
- `support.md`: common customer questions and how to sort them.

## 12. How to work with George

- Work in phases, each ending in a pull request with a **plain English summary**:
  - what was built;
  - decisions you made on his behalf;
  - anything unfinished;
  - the checks you ran.
- Anything George needs to do himself goes under the heading **"George, please can you do this for me"**, as numbered steps that say exactly where to click.
- Never ask for passwords, keys or tokens in chat.
- Never merge pull requests. Stop at each checkpoint for George to review.
- Keep pull requests small and focused, and run all the checks before opening one.

## 13. Questions to ask George before Phase 0 (one at a time)

1. **The business:**
   - the exact name (Paper Fox?), and the owner's name;
   - contact email and phone, and business address (and company number if a limited company);
   - logo files, brand colours and fonts;
   - any existing website.
2. **The events:** what kind of events they are, how many a year, typical numbers of people, and the venues (one or several).
3. **What people book:** tickets per person, tables, stalls or pitches, workshop places, packages? The ticket types and typical prices.
4. **Paying:**
   - pay in full only, or a deposit then the balance?
   - how much the deposit is, and when the balance is due;
   - can the balance be paid in parts?
   - should a saved card be charged automatically on the due date (this needs the customer's agreement), or do customers pay it themselves after reminders?
5. **Cancellations and refunds:** the policy, and what happens if a balance isn't paid by its due date.
6. **VAT:** is Paper Fox VAT registered? If so, the VAT number.
7. **Accounts:** is it fine for customers to sign in by an emailed link, with no password needed? (Recommended.)
8. **Attendee details:** names for every attendee? Dietary needs, access needs, ages, or other questions?
9. **On the day:** are tickets with QR codes and a door check in screen wanted?
10. **Extras:** a waiting list when sold out, discount codes, gift vouchers, add-ons (for example parking or merchandise)?
11. **The team:** who needs access, and what each person should be able to do.
12. **Existing data:** a customer list, current bookings or past events to bring in (and in what format)?
13. **Hosting and domain:**
    - Vercel or Netlify?
    - the web address for the booking site;
    - the email address that emails come from.
14. **Marketing:** a mailing list? Is a newsletter tool (for example Mailchimp) in use?
15. **Ownership:** confirm the Stripe, Supabase and hosting accounts are in Paper Fox's name.
16. **Dates:** when should bookings open, and which is the first event to sell?

Record the answers in section 15 of this file. Then propose the Phase 0 task list before writing any code.

## 14. Build plan and checkpoints

At the end of each phase:

1. run all the tests;
2. update the docs;
3. open the pull request with its summary;
4. stop for George's review.

- **Phase 0: foundations.**
  - The repository, tooling, CI and Supabase locally.
  - The Next.js app shell: public pages, account area and admin area.
  - Sign in by email link (password optional), profiles, staff roles, row level security, and the isolation tests.
  - Brand theme tokens, `.env.example` and `docs/setup.md`.
- **Phase 1: events.**
  - Venues, events, ticket types and attendee questions.
  - The admin event editor, publishing, and copying last year's event.
  - The public events list and event pages, and images.
- **Phase 2: booking and paying.**
  - The booking flow, places available, holds and expiry, and booking references.
  - Stripe Checkout for paying in full or a deposit, and webhooks.
  - The confirmation page and email, and receipts.
- **Phase 3: customer accounts and balances.**
  - My bookings, paying the balance, and receipts and statements.
  - Editing attendee details.
  - Balance reminders and overdue notices, and event reminders (the scheduled jobs).
- **Phase 4: running the events.**
  - Admin bookings: manual payments, refunds, cancellations and phone bookings.
  - Attendee lists and CSV, and messaging attendees.
  - The dashboard and reports.
  - Check in, if wanted.
- **Phase 5: launch.**
  - The real domain and email domain.
  - Stripe live mode (with the owner's go ahead).
  - Legal pages, Sentry, and a security review against section 8.
  - Backup and restore rehearsal, all runbooks, a full end to end run, and seed data cleared from production.

## 15. Paper Fox details (filled in from George's answers)

_To be completed after the questions in section 13._
