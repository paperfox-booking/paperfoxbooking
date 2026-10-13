# Setting up Paper Fox bookings

This guide covers the accounts the system needs, where each setting goes, and
how to run it on your own computer. Every account should be in Paper Fox's
name (the business email), so the business owns its data.

Never paste a password, key or token into a chat with Claude. This guide says
where each one goes instead.

## 1. Accounts

### GitHub (done)

The private repository `paperfox-booking/paperfoxbooking`.

### Supabase: the database and sign-in

You need two projects: `staging` for testing and `production` for real
customers. The free plan is fine for staging. Production needs the Pro plan
before launch, for daily backups.

1. Go to [supabase.com](https://supabase.com) and sign up with the Paper Fox
   email address.
2. Create an organisation called **Paper Fox**.
3. Click **New project**:
   - Name: `paper-fox-staging`.
   - Database password: click **Generate a password** and save it in a
     password manager. You won't need to give it to anyone.
   - Region: **West EU (London)**, also called `eu-west-2`.
4. Repeat for `paper-fox-production`, also in London.

For each project, in the Supabase dashboard:

1. **Authentication → Sign In / Providers → Email**:
   - make sure **Email** is turned on;
   - set **Email OTP length** to 6;
   - set **Email OTP expiration** to 600 seconds (10 minutes).
2. **Authentication → Emails → Templates**: open **Magic link or OTP** and
   **Confirm sign up**. Replace each one's subject with
   `Your Paper Fox sign-in code` and its message with the wording in
   `supabase/templates/sign-in-code.html`. It must contain `{{ .Token }}`,
   which is where the 6-digit code goes.

   Supabase only lets you edit these once custom SMTP is set up, so do the
   [Resend](#resend-sending-emails-needed-for-sign-in-codes) steps first.
   Until then its default emails contain a sign-in link instead of a code,
   which this site doesn't use, so signing in won't work yet.

3. **Authentication → URL Configuration**: set **Site URL** to the site's
   address, for example `https://book.paper-fox.co.uk` (or the Vercel address
   until the real one is ready).

The database tables are created automatically by GitHub, not by hand: see
[`docs/deploy.md`](deploy.md) for the one-time setup.

Supabase's menu names change from time to time. If something isn't exactly
where this says, it will be close by.

### Vercel: the website

1. Go to [vercel.com](https://vercel.com) and sign up with the Paper Fox email
   address, choosing **Continue with GitHub**.
2. Click **Add New → Project** and import `paperfox-booking/paperfoxbooking`.
3. Before deploying, open **Environment Variables** and add the settings from
   [section 3](#3-settings).
4. Click **Deploy**. Every pull request then gets its own preview link.

### Resend: sending emails (needed for sign-in codes)

Supabase's built-in email sender only sends 2 emails an hour and can't be
raised: it's for testing. Real sign-in codes (and later every booking email)
go through Resend, from Paper Fox's own address.

1. Go to [resend.com](https://resend.com) and sign up with the Paper Fox email
   address.
2. **Domains → Add domain**: enter `paper-fox.co.uk` and choose the
   **London (eu-west-2)** region if asked. Resend lists a few DNS records.
3. Add those records wherever `paper-fox.co.uk`'s DNS is managed (the company
   the domain is registered with, or whoever runs the website). They only add a
   signature and a `send` sub-address, so they don't affect the existing
   `hello@paper-fox.co.uk` mailbox. Back in Resend, click **Verify**; it can
   take from a few minutes to a few hours.
4. **API Keys → Create API key**: name it `Supabase sign-in`, permission
   **Sending access**, and copy it.
5. In Supabase, **Authentication → Emails → SMTP Settings**, turn on **Enable
   custom SMTP** and fill in:

   | Field        | Value                          |
   | ------------ | ------------------------------ |
   | Sender email | `bookings@paper-fox.co.uk`     |
   | Sender name  | `Paper Fox`                    |
   | Host         | `smtp.resend.com`              |
   | Port         | `465`                          |
   | Username     | `resend`                       |
   | Password     | the Resend API key from step 4 |

6. In Supabase, **Authentication → Rate Limits**: raise **Rate limit for
   sending emails** to `100` an hour. (Resend's free plan sends up to 100 a
   day and 3,000 a month, which is plenty for sign-in codes.)

### Later

- **Sentry**, for error reports.
- **Stripe**, only if card payments are wanted. For now Paper Fox takes bank
  transfers only.

## 2. Adding the team (Nichola, Morag and you)

The team sign in with an email address and a password, on the **Team sign
in** page (`/sign-in/team`, linked at the bottom of every page). Customers
sign in differently, with an emailed code, once Resend is set up.

Do this once the database has been set up (see `docs/deploy.md`).

1. **Password length:** in Supabase, go to **Authentication → Sign In /
   Providers → Email** and set **Minimum password length** to `8`.
2. **Create each account:** go to **Authentication → Users → Add user →
   Create new user**:
   - Email address: their own email address;
   - Password: a temporary one, at least 8 characters (a few words strung
     together works well);
   - tick **Auto Confirm User**, then click **Create user**.
3. **Make them owners:** go to **SQL Editor** and run this, with the real
   email addresses:

   ```sql
   insert into public.staff (user_id, role)
   select id, 'owner' from auth.users
   where email in ('nichola@example.com', 'morag@example.com', 'you@example.com')
   on conflict (user_id) do nothing;
   ```

   Use `'admin'` or `'door'` instead of `'owner'` for anyone who should have
   less access. It's safe to run again: anyone already on the team is skipped.
   To check who's on the team, run:

   ```sql
   select u.email, s.role
   from public.staff s
   join auth.users u on u.id = s.user_id;
   ```

4. **Tell each person their temporary password** in person or by phone, not
   by email. They sign in at **Team sign in** and change it straight away
   under **Change password** in the admin area.

**If someone forgets their password,** set a new temporary one for them in
the **SQL Editor** (changing the email and password), then tell them it:

```sql
update auth.users
set encrypted_password = extensions.crypt('new temporary password', extensions.gen_salt('bf'))
where email = 'nichola@example.com';
```

A "Forgot your password?" email comes once Resend is set up.

## 3. Settings

The full list, with a description of each, is in `.env.example`. Locally
they go in `.env.local`. On Vercel they go in **Project → Settings →
Environment Variables**.

| Setting                         | Where to find it                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | The site's address, for example `https://book.paper-fox.co.uk`                                       |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → **Project Settings → API** → Project URL                                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → **Project Settings → API keys** → `anon` `public` key                                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase → **Project Settings → API keys** → `service_role` key. Secret: server only. Not needed yet |
| `DATABASE_URL`                  | Supabase → **Connect** → connection string. Only for running migrations from a computer              |

## 4. Running it on your computer

You need:

- [Node.js](https://nodejs.org) 22 or later;
- pnpm: run `corepack enable` once;
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), running;
- the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

Then, in the project folder:

```sh
pnpm install
supabase start          # local database, sign-in and test mailbox
supabase status         # shows the local API URL and anon key
cp .env.example .env.local
# put the API URL and anon key from `supabase status` into .env.local
pnpm dev                # the site is now at http://localhost:3000
```

Sign-in emails aren't really sent locally. Open the test mailbox at
<http://127.0.0.1:54324> to see the code.

To try things out with made-up events, people and bookings, run
`pnpm seed` (or `pnpm seed --reset` to start again). It only ever works on
the database on your own computer.

## 5. Checks

| Command                       | What it checks                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`                   | Code style problems                                                                                           |
| `pnpm typecheck`              | TypeScript types                                                                                              |
| `pnpm format:check`           | Formatting (`pnpm format` fixes it)                                                                           |
| `pnpm test`                   | Unit tests: money, dates, permissions                                                                         |
| `pnpm test:db`                | Database security rules (needs `supabase start`)                                                              |
| `pnpm build && pnpm test:e2e` | Browser tests at phone and desktop sizes, with accessibility checks (needs `supabase start` and `.env.local`) |
| `pnpm db:types`               | Regenerates `src/lib/supabase/database.types.ts` after a migration                                            |

GitHub runs all of these on every pull request.

### Without Docker

If Docker isn't available, the database tests can run on plain PostgreSQL
16 or later instead:

```sh
scripts/db/reset-without-docker.sh   # rebuilds the database from the migrations
pnpm test:db
```

This uses a small stand-in for the parts of Supabase the migrations need. It
can't run sign-in, so the `@supabase` browser tests need the real thing:
`pnpm test:e2e --grep-invert @supabase` runs the rest.

## 6. Changing the database

Every change is a new file in `supabase/migrations/`, never a change made by
hand in the Supabase dashboard. After adding one:

```sh
supabase db reset    # rebuilds the local database from all migrations
pnpm db:types
pnpm test:db
```
