# Deploying

## How changes reach the live site

1. **A pull request** runs the automatic checks (the "CI" workflow). Once
   Vercel is connected, it also gets its own preview link.
2. **Merging into `main`:**
   - the "Deploy database" workflow applies any new database migrations to
     the **staging** Supabase project;
   - Vercel deploys the site.
3. **Before launch,** production gets its own Supabase project, with the same
   workflow plus an approval step, and the real web address.

Nobody changes the database by hand in the Supabase dashboard. Every change
is a migration file in `supabase/migrations/`.

## One-time setup: let GitHub update the staging database

GitHub needs three things from Supabase. They go into GitHub's settings,
never into a chat.

### In Supabase

1. **Access token:** click your profile picture (top right) → **Account
   preferences** → **Access Tokens** → **Generate new token**. Call it
   `GitHub deploy` and copy it.
2. **Database password:** the one generated when you created
   `paper-fox-staging`. If you didn't save it, go to the project →
   **Project Settings → Database → Reset database password**, and copy the
   new one.
3. **Project reference:** the project → **Project Settings → General** →
   **Project ID**. It's a string of letters, and it's also the first part of
   the project's URL (`https://<this>.supabase.co`).

### In GitHub

Open the repository → **Settings** → **Secrets and variables** → **Actions**.

1. On the **Secrets** tab, click **New repository secret** twice:
   - Name `SUPABASE_ACCESS_TOKEN`, value: the access token.
   - Name `SUPABASE_STAGING_DB_PASSWORD`, value: the database password.
2. On the **Variables** tab, click **New repository variable**:
   - Name `SUPABASE_STAGING_PROJECT_REF`, value: the project reference.

The next merge into `main` that changes `supabase/migrations/` then sets up
the database. To run it at any time, go to **Actions → Deploy database →
Run workflow**.

## Rolling back

- **The site:** in Vercel, open **Deployments**, find the last good one, and
  choose **Promote to Production** (or **Instant Rollback**).
- **The database:** never edit or delete a migration that has already been
  applied. Write a new migration that undoes the change, and merge it the
  normal way. For anything that has lost data, restore from Supabase's daily
  backup (production, Pro plan): **Database → Backups**.
