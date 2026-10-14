import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import {
  createAccountWithPassword,
  signInAsTeam,
  sql,
  uniqueEmail,
  visibleText,
} from "./team";

/**
 * The team screen in Settings. Tagged @supabase because it needs the local
 * Supabase stack running. Everyone here is made up.
 */

test.describe("the team screen @supabase", () => {
  test("an owner adds someone, changes their role and removes them", async ({
    page,
  }, testInfo) => {
    const newcomer = uniqueEmail(testInfo.project.name);
    await createAccountWithPassword(newcomer, "a temporary password");
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      "/admin/settings/team",
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Team" }),
    ).toBeVisible();
    await expect(visibleText(page, /\(you\)/)).toBeVisible();
    await expectNoAccessibilityProblems(page);

    // An email with no account yet is explained.
    await page
      .getByLabel("Their email address")
      .fill("nobody.here@example.test");
    await page.getByRole("button", { name: "Add to the team" }).click();
    await expect(
      visibleText(page, /There's no account with that email yet/),
    ).toBeVisible();

    await page.getByLabel("Their email address").fill(newcomer);
    await page.getByLabel("What they can do").selectOption("door");
    await page.getByRole("button", { name: "Add to the team" }).click();
    await expect(
      visibleText(page, `${newcomer} is now on the team.`),
    ).toBeVisible();

    const role = page.getByLabel(`Role for ${newcomer}`);
    await expect(role).toHaveValue("door");
    await role.selectOption("admin");
    await expect
      .poll(async () => {
        const [row] = await sql<{ role: string }>(
          `select s.role from public.staff s join auth.users u on u.id = s.user_id where u.email = $1`,
          [newcomer],
        );
        return row?.role;
      })
      .toBe("admin");

    await page
      .getByRole("button", { name: `Remove ${newcomer} from the team` })
      .click();
    await page.getByRole("button", { name: `Yes, remove ${newcomer}` }).click();
    await expect
      .poll(async () => {
        const rows = await sql(
          `select 1 from public.staff s join auth.users u on u.id = s.user_id where u.email = $1`,
          [newcomer],
        );
        return rows.length;
      })
      .toBe(0);
  });

  test("admins can't open the team screen", async ({ page }, testInfo) => {
    await signInAsTeam(
      page,
      testInfo.project.name,
      "admin",
      "/admin/settings/team",
    );
    await expect(visibleText(page, "You can't use this page")).toBeVisible();
  });
});
