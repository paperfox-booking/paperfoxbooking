import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { expectNoAccessibilityProblems } from "./accessibility";
import { latestSignInCode } from "./mailbox";

/**
 * The full sign-in journey against real Supabase (`supabase start`), reading
 * the code from the local test mailbox. Tagged @supabase because it needs the
 * whole local Supabase stack running; CI always runs it.
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

  test("a team member signs in and sees the admin dashboard", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo.project.name);

    // The first sign-in creates the account; then an owner adds them.
    await page.goto("/sign-in");
    await signIn(page, email);
    await expect(page).toHaveURL(/\/account$/);
    await makeOwner(email);

    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(page.getByText(/You're signed in as\s+owner/)).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });
});
