import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { expectNoAccessibilityProblems } from "./accessibility";
import { latestSignInCode } from "./mailbox";

/**
 * The full sign-in journeys against real Supabase (`supabase start`):
 * customers with a code read from the local test mailbox, and the team with a
 * password. Tagged @supabase because they need the whole local Supabase stack
 * running; CI always runs them.
 */

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function uniqueEmail(projectName: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `e2e-${projectName}-${Date.now()}-${random}@example.test`;
}

async function requestCode(page: Page, email: string): Promise<Date> {
  const sentAfter = new Date(Date.now() - 1000);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a code" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  return sentAfter;
}

async function signIn(page: Page, email: string): Promise<void> {
  const sentAfter = await requestCode(page, email);
  const code = await latestSignInCode(email, sentAfter);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/**
 * Creates a confirmed account with a password, the way George adds a team
 * member in the Supabase dashboard (Authentication → Users → Add user).
 */
async function createAccountWithPassword(
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

async function teamSignIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function makeOwner(email: string): Promise<void> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(
      `insert into public.staff (user_id, role)
       select id, 'owner' from auth.users where email = $1`,
      [email],
    );
  } finally {
    await client.end();
  }
}

test.describe("signing in with an emailed code @supabase", () => {
  test("a customer signs in, sees their account, and can't see admin", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo.project.name);

    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    await signIn(page, email);

    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "My bookings" }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", {
        name: "This area is for the Paper Fox team",
      }),
    ).toBeVisible();

    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("a wrong code explains what to do", async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo.project.name);
    await page.goto("/sign-in");
    await requestCode(page, email);

    await page.getByLabel("6-digit code").fill("000000");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText(/That code didn't work/)).toBeVisible();
    await expect(page.getByLabel("6-digit code")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expectNoAccessibilityProblems(page);
  });
});

test.describe("team sign-in with a password @supabase", () => {
  test("a team member signs in, sees the dashboard and changes their password", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo.project.name);
    const temporary = "temporary password 2027";
    const chosen = "a brand new crop weekend password";
    await createAccountWithPassword(email, temporary);
    await makeOwner(email);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\/team\?next=%2Fadmin$/);
    await teamSignIn(page, email, temporary);

    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByText(/You're signed in as\s+owner/)).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page.getByRole("link", { name: "Change password" }).click();
    await page.getByLabel("New password").fill(chosen);
    await page.getByLabel("Type it again").fill(chosen);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(
      page.getByText("Your password has been changed"),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    // The old password stops working and the new one works.
    await page.goto("/admin");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.goto("/sign-in/team");
    await teamSignIn(page, email, temporary);
    await expect(page.getByText(/don't match/)).toBeVisible();
    await teamSignIn(page, email, chosen);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("a wrong password explains what to do", async ({ page }, testInfo) => {
    const email = uniqueEmail(testInfo.project.name);
    await createAccountWithPassword(email, "the right password here");

    await page.goto("/sign-in/team");
    await teamSignIn(page, email, "the wrong password");
    await expect(
      page.getByText(/That email and password don't match/),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });

  test("new passwords must be long enough and typed the same twice", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo.project.name);
    const password = "temporary password 2027";
    await createAccountWithPassword(email, password);
    await makeOwner(email);

    await page.goto("/sign-in/team?next=%2Fadmin%2Fpassword");
    await teamSignIn(page, email, password);
    await expect(page).toHaveURL(/\/admin\/password$/);

    await page.getByLabel("New password").fill("short");
    await page.getByLabel("Type it again").fill("short");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/at least 8 characters/).last()).toBeVisible();

    await page.getByLabel("New password").fill("long enough password one");
    await page.getByLabel("Type it again").fill("long enough password two");
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText(/don't match/)).toBeVisible();
  });
});
