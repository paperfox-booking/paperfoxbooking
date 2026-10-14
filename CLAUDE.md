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

_Being filled in as George answers the questions in section 13. Anything marked **to confirm** still needs an answer._

**Where a decision George has made here conflicts with sections 1 to 14, this section wins.** Sections 1 to 14 will be brought into line once all the questions are answered.

Sources so far:
- George's answers in chat.
- His March 2027 booking spreadsheet. It holds real customer data, so it is **not** in this repository and must never be added.
- His three standard emails (B1, B2, B3) and their attachments: the booking details PDF, the terms and conditions, and the confirmation PDF.

The email wording and the terms are kept in `docs/reference/`. The booking details PDF is not kept, because it includes the bank details.

### 1. The business

- **Name:** Paper Fox. The legal name is **Paper Fox Events Ltd**, company number **13717760**, both from the footer of the terms.
- **People:** Nichola and Morag run it and sign every email "Nichola & Morag". The spreadsheet's team rows give their surnames as Murphy and Cutts (to confirm). Still to confirm: which of them is the owner in the system's terms.
- **Phone:** +44 (0)24 7693 7383.
- **Email:** hello@paper-fox.co.uk.
- **Address:** Paper Fox, Suite 1B, The Hall, Rugby Road, Wolston, CV8 3FZ.
- **Social:**
  - Facebook page: https://www.facebook.com/PaperFoxEvents/
  - Facebook group: www.facebook.com/groups/paperfoxevents/ (there is also a private group for each event)
  - Instagram: https://www.instagram.com/paperfoxevents/
- **Bank details for transfers:** in the booking details PDF, in the name of Paper Fox Events Ltd. They go into the settings screen, never into code or this file.
- **Website:** https://www.paper-fox.co.uk/. The domain has a hyphen (`paper-fox.co.uk`), unlike the `paperfox.co.uk` examples earlier in this file. Use the hyphenated domain.
- **Logo files:**
  - `brand/paper-fox-logo-circle.png`: 1280 × 1280, the logo in a teal circle on a transparent background. Use it as the master copy.
  - `brand/paper-fox-logo-square.webp`: 2000 × 2000, the logo on a square teal background. It's compressed, so its colours are slightly off.
- **Colours:** taken from the PNG logo. George asked for white plus the logo's colours.

  | Token | Hex | Where it is in the logo | Use in the app |
  | --- | --- | --- | --- |
  | `teal` | `#93DED0` | The background circle | Header band, highlights and soft backgrounds |
  | `coral` | `#EC6851` | The fox's darker side | Primary buttons, accents |
  | `coral-light` | `#F68262` | The fox's lighter side | Hover states, illustrations |
  | `cream` | `#E8E2DA` | The fox's chest | Card and section backgrounds |
  | `ink` | `#221E1F` | The eyes and nose | Body text |
  | `black` | `#000000` | The "PAPER FOX" wordmark | The logo only |
  | `white` | `#FFFFFF` | The tail tip | Page background |
  | `coral-deep` | `#B82C14` | Not in the logo: a darker coral | Links and coral text on white or cream |

- **Contrast (WCAG 2.2 AA needs 4.5:1 for normal text):**
  - White on coral is 3.15:1, which fails. Ink on coral is 5.23:1, so coral buttons get ink text.
  - Coral text on white is 3.15:1, which fails. Use `coral-deep` for links and coral text instead (6.16:1 on white, 4.79:1 on cream).
  - White on teal is 1.54:1, which fails. Ink on teal is 10.68:1, so text on teal is always ink.
- **Fonts:** to confirm. The wordmark is a tall, condensed, all capitals sans serif. If nobody knows the font, use Bebas Neue (free, and a close match) for headings, and a plain, readable sans serif for body text.

### 2. The events

- **What they are:** papercraft and scrapbooking "crop" weekends, also called the "Paper Fox Escape" and the "Coventry Crop Weekend". The terms say an event can be a "crop, escape, retreat, class".
- **How often:** 4 a year, in March, June, September and November.
- **When:** Friday to Sunday. For example, 19 to 21 March 2027.
- **Venue:** Holiday Inn Coventry, Hinckley Road, Coventry, CV2 2HP (024 7509 7600). To confirm: is it always this venue?
- **Size:** March 2027 has 110 people on the list, 4 of them free places for the team and helpers.
  - The main room takes 78 at most ("prefer 74").
  - The rest are listed against "2nd Room A" (9), "2nd Room B" (13) and "Welsh" (10).
  - To confirm: what these rooms are, how many each takes, and whether "Welsh" is a room or a group.
- **Everyone gets** their own 4ft crop table.
- **Hotel rooms:** customers book directly with the hotel at Paper Fox's rate, and the hotel needs a card to hold the room. The booking system doesn't handle hotel rooms, but shows the details. Other local hotels are suggested too.
- **Each event** has its own private Facebook group.

### 3. What people book

- **One place per person**, in one of two options:

  | Option | Times | Price | Deposit |
  | --- | --- | --- | --- |
  | Weekend (4pm start) | Friday 4pm to Sunday 5pm | £195 | £60 |
  | Friday Kick Starter (9am start) | Friday 9am to Sunday 5pm | £245 | £85 |

- **The Kick Starter adds:** an extra self-paced class kit, Friday lunch, refreshments and early access to the shop.
- **Everyone gets:**
  - a welcome goody bag, challenges and activities;
  - tea and coffee throughout;
  - a light lunch on Saturday and Sunday, and an evening meal on Saturday;
  - free parking and wifi;
  - use of the die-cutting tools, and access to the craft shops.
- **Other prices:** the spreadsheet also has 2 people at £225 and 2 at £235. To confirm: are those discounts or old prices?
- **Class kits:** optional self-paced kits go on sale to people booked about 4 weeks before each event, before the public can buy them. To confirm: should the system sell these?
- **Free places:** the team and helpers take free places, listed with "AA" at the top of the spreadsheet so they sort first.

### 4. Paying

- **Today:** everything is paid by bank transfer, referenced with the person's name and the event month. Paper Fox acknowledges payments within 7 working days.
- **When bookings open:** about 12 months before the event.
- **Holding a place:** a booking form reserves a place until the deposit arrives. To confirm how long, because the sources disagree:
  - the B1 email gives a fixed date ("before the 30th March 2026");
  - the terms say "within 48 hours".
- **Deposit:** £60 (4pm start) or £85 (9am start). It's non-refundable and non-transferable.
- **Balance:** due 6 weeks before the event, with a reminder before then. To confirm: the March 2027 booking details give 26/01/2027, which is 7 weeks and 3 days before. Is the due date set by hand for each event?
- **Late bookings:** booking within 6 weeks of the event means paying in full straight away.
- **Paying in parts:** this already happens. The spreadsheet shows payments of £65, £100, £120 and £125.
- **Decided: bank transfer only, for now.** No card payments at launch. George said "at the moment", so cards may come later.
  - **No Stripe for now.** Stripe Checkout, the Stripe webhooks, the Stripe environment variables and the Stripe tests are all left out until cards are wanted. This replaces the Stripe parts of sections 3, 4, 5, 7, 10, 11 and 14.
  - **Ready for cards later.** Payments still record a method (`bank_transfer`, `cash`, `other`, and later `card`), so cards can be added without reworking anything.
  - **Places are held for longer.** A booking waiting for its deposit holds its place for much longer than the brief's 15 minutes (how long is to confirm). The no-overbooking rule still applies.
  - **Unique payment reference.** Each booking gets one (for example `PF-2027-0001`), and customers use it when they pay, so payments are easy to match on the bank statement.
  - **Staff record payments.** Staff record each transfer in the system. That updates the balance and sends the right email (B2 when the deposit is paid, B3 when it's paid in full) automatically.
  - **Refunds** are made by bank transfer outside the system, then recorded in it.
  - **Idea, not agreed:** upload a bank statement (CSV) and let the system match payments to bookings by reference.

### 5. Cancellations and refunds (from the 2026 terms)

- **If Paper Fox cancels:** everything paid is refunded in full.
- **If the customer cancels more than 6 weeks before:** a £60 admin fee is kept and the rest is refunded. To confirm: does that mean £60, not the £85 Kick Starter deposit, which the terms also call non-refundable?
- **If the customer cancels within 6 weeks:** nothing is refunded.
  - If Paper Fox resells the place, a 25% admin charge on the full price is kept, as well as the deposit.
  - What's left becomes **credit** towards a future event or Paper Fox products.
- **Sending someone else:** a customer can send a replacement, but only with Paper Fox's written approval. Any money is settled privately between them. Reselling a place on social media or elsewhere is banned.
- **Goody bags and kits:** if someone cancels within 6 weeks, has paid in full and the place isn't filled, these are posted to them after the event.
- **Unpaid balances:** to confirm what happens if the balance isn't paid by its due date.

### 8. Attendee details (from the spreadsheet)

- **Per person:**
  - name, email and mobile;
  - emergency contact: name, relationship and phone;
  - dietary and health needs;
  - notes, mostly seating requests ("sit with …");
  - start time (9am or 4pm);
  - room.
- **Health information** is special category data under UK GDPR. Only collect it with explicit consent, show it only to the staff who need it, and delete it after the event (the retention period is to confirm).

### 10. Extras

- **Waiting list: yes.** When an event is full, people join a reserve list. Staff pick someone and offer them a place, and that person accepts and pays. George compares it to turning a quote into a contract.
- **Discount codes, gift vouchers, add-ons:** to confirm. Class kits are the likely add-on (see 3).

### 11. The team

- Nichola and Morag, plus helpers who take free places at events. To confirm: who needs to sign in, and what each person should be able to do.

### 12. Existing data

- **The March 2027 spreadsheet:** one row per person, with these columns:
  - name and email;
  - "Friday Cropping" (start time) and "Room 2";
  - dietary and health;
  - total due, money received and balance due;
  - mobile, emergency contact and notes;
  - "Booking Sent", the date and which email was sent.
- **Its totals:** £23,310 due and £8,150 received. 98 people have paid a deposit or part, 4 have paid in full, and 4 have paid nothing yet.
- **Problems spotted, to check with George:**
  - The "Balance Due" total says £13,920, but the rows add up to £15,160 still owed, a gap of £1,240.
    - Rows 15, 17, 75, 89, 102, 103 and 109 have no balance formula, which leaves out £1,080.
    - Row 31 has 0 typed in where £160 is owed.
  - 6 people marked "9AM" are charged £195, and 1 marked "4PM" is charged £245.
  - Row 115 sits below the totals, under "Waiting list for each event".
- **The March 2027 bookings need importing.** To confirm: are there spreadsheets for other events?

### Emails sent today

- **B1, booking received:**
  - the place is reserved until the deposit arrives by a date;
  - prices and deposit options;
  - advice on booking the hotel;
  - deposits are non-refundable;
  - what happens next.
  - Attachments: the event's booking details PDF and the terms PDF.
- **B2, deposit received:**
  - the place is secured;
  - the balance is due 6 weeks before, with a reminder.
  - Attachment: the event's confirmation PDF (what's included, the Facebook group and the hotel).
- **B3, paid in full:** the same as B2, without the balance line.
- **"Thkd for Pmt":** the spreadsheet also records this. To confirm: is it a separate email for when the balance is paid?
- **Other emails mentioned:**
  - a balance reminder;
  - class kit news about 4 weeks before;
  - full joining details a few days before (arrival, timetable, local amenities, FAQs).
- **Sign-off:** every email is signed "Nichola & Morag, Paper Fox", with the social links.
- **Copy errors** in the current documents, which templates built from event details would prevent:
  - the March 2027 confirmation PDF links to the November 2026 Facebook group;
  - the hotel rates differ between the two PDFs (£74 and £84 in one, £72 and £82 in the other).

### What George wants the system to do (his words, tidied)

- Book the 9am start (£245) or the 4pm start (£195).
- Take a deposit when booking (about 12 months before), with the balance due 6 weeks before.
- Send the B1, B2 and B3 emails, each with its own attachments.
- Send emails chasing people for money.
- Keep a reserve list when an event is full, and offer places from it.
- Report on sales **and profit**.

### Where this changes the brief (proposed, waiting for George's agreement)

- **Payments (agreed):** bank transfer only for now, so no Stripe. See section 4 above.
- **Profit reports:** the brief only has sales reports. Profit needs each event's costs (room hire, food, goody bags and so on), so the costs need recording.
- **Waiting list:** in, with offers that have a time limit.
- **Credit:** customers can hold credit for future events or products, as the terms describe.
- **Replacement attendees:** staff approve a place moving to someone else.
- **Rooms:** places may need assigning to rooms, each with its own limit.
- **Event documents:** each event needs a "booking details" and a "confirmation" document. The system could produce these from the event's details, or staff could upload their own.

### Crucial answers (13/10/2026)

- **First event on the system: March 2027.** Its bookings are already taken (110 people, from the spreadsheet), so the first job is running it on the system:
  - bring the spreadsheet across;
  - record payments;
  - chase the balances due 26/01/2027;
  - send the emails.

  Online booking for later events comes after that.
- **Rooms:** Paper Fox has room maps (George will send them).
  - Until they arrive: one place limit for the whole event, plus the room recorded for each person.
  - A seating plan built from the maps may come later.
- **Sign-in: email address plus a 6-digit code** emailed each time (Supabase email OTP), with no password. George said "email address and a generated pin, that we choose". We read "that we choose" as "that's our choice", not a fixed PIN that Paper Fox sets for each customer. A fixed PIN was advised against, because staff would know it and short PINs can be guessed. To confirm with George.
- **Team sign-in (decided 13/10/2026): email and password.** Supabase's built-in email sender only sends 2 emails an hour, and sending through Resend needs the paper-fox.co.uk DNS set up first.
  - So the team (Nichola, Morag and George) sign in with an email and password on a separate **Team sign in** page.
  - George creates their accounts in the Supabase dashboard with a temporary password, and they change it in the admin area.
  - **Minimum password length: 8 characters** (George's choice, 13/10/2026). The same minimum is set in Supabase and in the site.
  - Customers keep the emailed 6-digit code, switched on once Resend is set up. That's needed before the emails phase anyway.
- **Hosting:** Vercel, as the brief recommends. George will set up the Supabase and Vercel accounts when ready. Until then he gets screenshots.

### The March 2027 people and the spreadsheet screen (George, 13/10/2026)

George asked for the spreadsheet to come into the system, built as soon as Phase 1 is done:

- **A profile for each person,** kept across events (the same people come back every quarter): name, email, mobile, emergency contact, dietary and health needs, and notes.
- **A spreadsheet-style screen for each event,** for quick typing, with the same columns as today:
  - name, start time (9am or 4pm) and room;
  - dietary and health, mobile, emergency contact and notes;
  - total due, received and balance;
  - payment notes, and comms (which email was sent, and when).
- **Team rows first:** the rows marked "AA" (Nichola, Morag and their helpers) stay at the top, then everyone else alphabetically.
- **Rooms with their own limits** (for example Main room 78, 2nd Room A, 2nd Room B and Welsh), as well as the event's overall limit.
- **The import is done in the app:** staff upload the spreadsheet on an import page, check a preview with problems flagged, then confirm. The real data never goes into this repository.
- **Working pace:** George asked to build quickly, so Claude carries on to the next phase without waiting for each pull request to be merged. George still reviews each one.
- **Merging (13/10/2026):** George asked Claude to merge pull request 3 for him. Claude merges only a specific pull request George asks it to merge, once its checks have passed; otherwise George merges.

### More from George (13/10/2026)

- **A profit and loss report,** with each event's costs typed into a spreadsheet-style list. (Built: event costs, and Reports across events.)
- **Spreadsheet views wherever there's a lot to update,** so the team can update many people at once instead of opening each profile. Recording payments must be as quick as possible. (Built: the Pay today box, and the People list as a spreadsheet.)
- **It must work on a phone.**

### Build order (proposed 13/10/2026, replaces the order of phases 1 to 4 in section 14)

1. **Phase 0: foundations.** As in section 14, with sign-in by emailed code.
2. **Phase 1: events.** Venues, events, the two ticket options (4pm and 9am), deposits and balance dates, copying an event, and the public event pages.
3. **Phase 2: running March 2027.**
   - Admin bookings and attendees, and the spreadsheet import.
   - Recording bank transfers and cash.
   - Booking references, the B1, B2 and B3 emails, balance chasers, and the email log.
   - The attendee list and CSV export.
4. **Phase 3: online booking.** Booking with a deposit by bank transfer, holds and expiry, and the waiting list with offers.
5. **Phase 4: customer accounts and reports.**
   - My bookings and statements.
   - Sales and profit reports, with event costs.
   - Refunds and credit.

### Questions for later (George wants to build first)

George asked to start building straight away and answer these later. Until he does, build with the default shown. Every default must be easy to change later: a setting or a per-event field, not something hard-coded.

| # | Question | Default until answered |
| --- | --- | --- |
| 1 | Owner's surname, and which of Nichola and Morag is the owner in the system's terms | Both are owners |
| 2 | The logo font | Bebas Neue for headings, a plain, readable sans serif for body text |
| 3 | Always the Holiday Inn Coventry? | Venues are a list, with the Holiday Inn as the first |
| 4 | Prices of £225 and £235 in the spreadsheet | Staff can change the price on a single booking, with a reason |
| 5 | Sell class kits through the system? | Not in the first version |
| 6 | How long a place is held waiting for the deposit | Set per event, default 7 days. A reminder before it runs out, then the place is released. Staff can extend it |
| 7 | Balance due date: exactly 6 weeks before, or chosen per event? | Set per event, defaulting to 6 weeks before |
| 8 | Paying in parts allowed? | Yes: staff record any amount |
| 9 | Cancelling more than 6 weeks before: keep £60, or the whole deposit? | Staff choose the refund amount, with the terms shown as a guide (built: Record a refund on a booking's page) |
| 10 | What happens if the balance isn't paid by the due date | Shown as overdue for staff to chase. Nothing automatic |
| 11 | Is "Thkd for Pmt" a separate email? | A "balance paid" email, the same as B3 |
| 12 | Other spreadsheets to import, and when to import March 2027 | Import is a later task |
| 13 | VAT registered? (section 13, question 6) | Not VAT registered |
| 14 | QR codes and a check-in screen? (question 9) | Not in the first version |
| 15 | Discount codes, gift vouchers? (question 10) | No |
| 16 | Who needs staff access, and what each can do (question 11) | Nichola and Morag as owners, and George as owner while it's being built |
| 17 | Mailing list or newsletter tool? (question 14) | A marketing consent tick box only |
| 18 | Accounts in Paper Fox's name? (question 15) | Assume yes. George sets them up |
| 19 | How long to keep health information after an event | To confirm before launch. Until then it stays on each person's profile, so it carries to their next event as George asked; section 8 of the brief says delete it after each event, so George needs to choose |
| 20 | The web address for bookings and the email sender (question 13) | `book.paper-fox.co.uk`, and `bookings@paper-fox.co.uk` |
| 21 | Row 2 of the spreadsheet is "Nichola Murphy & Debbie G": one shared place or two places? | Imported as one row, which staff can split |
| 22 | Credit towards a future event (the terms allow it) | Not built yet: note it in the booking's payment notes |
| 23 | Can admins record refunds, or only owners? | Owners and admins, as the roles were set up in Phase 0 |
| 24 | On the seating map customers see: everyone's names, first names and initials, or only their own seat? | First names and initials (suggested), when the room maps arrive |
| 25 | Automatic balance reminders on a schedule (for example 14 and 3 days before the due date) | Not yet: staff send the balance reminder from Email people. Automatic sending needs the go-ahead and `SUPABASE_SERVICE_ROLE_KEY` in Vercel |

### 6, 7, 9, 13 to 16

See "Questions for later" above, and the crucial questions asked on 13/10/2026.
