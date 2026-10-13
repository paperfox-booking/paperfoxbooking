import { expect, type Page } from "@playwright/test";
import pg from "pg";

/**
 * Helpers for browser tests that need a team member. They talk to the local
 * Supabase (`supabase start`), so tests using them are tagged @supabase.
 */

export const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export function uniqueEmail(projectName: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${projectName}-${Date.now()}-${random}@example.test`;
}

/** A short random word, for unique event names in parallel tests. */
export function uniqueSuffix(): string {
  return Math.random().toString(36).slice(2, 7);
}

/** Runs SQL directly against the local database (test set-up only). */
export async function sql<Row extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    return (await client.query<Row>(text, params)).rows;
  } finally {
    await client.end();
  }
}

/**
 * Creates a confirmed account with a password, the way George adds a team
 * member in the Supabase dashboard (Authentication → Users → Add user).
 */
export async function createAccountWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const apiUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is needed to create test accounts",
    );
  }
  const response = await fetch(`${apiUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!response.ok) {
    throw new Error(
      `Couldn't create ${email}: ${response.status} ${await response.text()}`,
    );
  }
}

export async function giveRole(
  email: string,
  role: "owner" | "admin" | "door",
): Promise<void> {
  await sql(
    `insert into public.staff (user_id, role)
     select id, $2 from auth.users where email = $1`,
    [email, role],
  );
}

export async function teamSignIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Creates a team member with this role and signs them in at `path`. */
export async function signInAsTeam(
  page: Page,
  projectName: string,
  role: "owner" | "admin" | "door",
  path = "/admin",
): Promise<string> {
  const email = uniqueEmail(projectName);
  const password = "test password for the team";
  await createAccountWithPassword(email, password);
  await giveRole(email, role);
  await page.goto(path);
  await teamSignIn(page, email, password);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
  return email;
}

/**
 * Text that's actually on screen. Next.js keeps recently visited pages in the
 * document (hidden) so going back is instant, so plain getByText can also
 * find text on those hidden pages.
 */
export function visibleText(
  page: Page,
  text: string | RegExp,
  options?: { exact?: boolean },
) {
  return page.getByText(text, options).filter({ visible: true });
}
