# Security and data protection

## Who can see what

The database itself enforces these rules (row level security), so a mistake
in a screen can't show anyone more than they're allowed. Automated tests
prove them (`tests/db/`).

|                                               | Customer | Door staff | Admin | Owner |
| --------------------------------------------- | -------- | ---------- | ----- | ----- |
| Their own bookings, payments and documents    | ✓        |            |       |       |
| Who's booked, rooms, dietary needs, check in  |          | ✓          | ✓     | ✓     |
| Money, payments, emails, reports, costs       |          |            | ✓     | ✓     |
| Change bookings, record payments, send emails |          |            | ✓     | ✓     |
| Settings (bank details, terms) and the team   |          |            |       | ✓     |

- **Team accounts** sign in with an email and password (8 characters or
  more). Owners manage who's on the team under **Settings → Team**, and
  there's always at least one owner.
- **Customers** will sign in with a code emailed to them, with no password.
  They only ever see their own bookings.
- **Everything is recorded.** Changes to events, bookings, payments, costs,
  settings and the waiting list go into an audit log with who did it and
  when. Nobody can change the log or the email log.

## Secrets

- Keys and passwords live only in Vercel's environment variables (and a
  local `.env.local`, which is never committed). `.env.example` lists them
  all, with no values.
- Never paste a key, token or password into chat, email or a document. If
  one is ever exposed, make a new one where it came from (Supabase, Resend)
  and replace it in Vercel straight away.
- The bank details are in the database (Settings), not in the code.

## Personal data (UK GDPR)

- **Health information** (in "Dietary and health") is special category
  data. Only collect what's needed, with the person's agreement. The
  catering sheet shows it, so check what you send the hotel. How long to
  keep it after an event is still to decide (question 19 in CLAUDE.md).
- **The emergency contacts sheet** is private: keep it with you at the event
  and shred it afterwards.
- **No real customer data** goes in the code, the tests or the demo data.
  The March 2027 spreadsheet is never added to the repository.
- **A request to see their data:** open them under **People**, and choose
  **Download everything we hold about them**. It's a file with their
  details, bookings, payments, emails and waiting lists, to send them.
- **A request to delete their data:** for now, George removes it on request,
  keeping what accounting law needs (payments, made anonymous). A screen for
  this comes before launch.

## Backups

Supabase's paid plan keeps daily backups of the production database
(**Database → Backups**). Before launch, rehearse a restore once (into a
spare project), and note here how long it took.

## If something goes wrong (a breach)

A breach is any personal data being lost, stolen, sent to the wrong person,
or seen by someone who shouldn't see it. For example, an email to the wrong
person, a lost printed list, or a password someone else has learned.

1. **Stop it getting worse.** Change the password or key involved, remove
   the person's access (Settings → Team), or ask the wrong recipient to
   delete the email.
2. **Write down** what happened, when, whose data, and what you've done.
   Keep it, even if it turns out to be minor.
3. **Decide within 72 hours** whether to report it to the ICO
   (ico.org.uk/report-a-breach). Report it if it's likely to put people at
   risk (for example, health information or bank details). If unsure, call
   the ICO helpline.
4. **Tell the people affected** if it's a high risk to them, in plain words:
   what happened, what it means for them, and what you're doing.
5. **Learn from it:** what would stop it happening again?
