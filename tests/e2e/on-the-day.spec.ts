import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { signInAsTeam, sql, visibleText } from "./team";

/**
 * The catering sheet, the printables and checking people in. Tagged @supabase
 * because it needs the local Supabase stack running. Everyone here is made up.
 */

async function expectNoSidewaysScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("on the day @supabase", () => {
  test("an owner opens the catering sheet and each printable", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await sql(
      `update public.customers set dietary_health = 'Vegetarian' where full_name = $1`,
      [people.zoe],
    );
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}`,
    );

    await page.getByRole("link", { name: "Printing and catering" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Printing" }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page.getByRole("link", { name: "Catering sheet" }).click();
    await expect(
      page.getByRole("heading", { name: "Numbers: 3 people" }),
    ).toBeVisible();
    const needs = page.getByRole("table", { name: "Dietary needs" });
    await expect(needs.getByRole("row")).toHaveCount(2);
    await expect(needs.getByText(people.zoe)).toBeVisible();
    await expect(needs.getByText("Vegetarian")).toBeVisible();
    await expectNoAccessibilityProblems(page);
    await expectNoSidewaysScroll(page);

    const csv = await page.request.get(
      `/admin/events/${eventId}/catering/export`,
    );
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text).toContain("Weekend (4pm start),2");
    expect(text).toContain(
      `${people.zoe},Weekend (4pm start),Main room,Vegetarian`,
    );

    for (const [path, heading] of [
      ["print/register", "Register"],
      ["print/badges", "Name badges"],
      ["print/rooms", "Room lists"],
      ["print/emergency", "Emergency contacts"],
    ] as const) {
      await page.goto(`/admin/events/${eventId}/${path}`);
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      // Badges put the surname on its own line, so look for the first two words.
      await expect(visibleText(page, /Bea Scrapper/).first()).toBeVisible();
      await expectNoAccessibilityProblems(page);
      await expectNoSidewaysScroll(page);
    }

    // The register shows what's still owed, to collect on the day.
    await page.goto(`/admin/events/${eventId}/print/register`);
    await expect(visibleText(page, "£195").first()).toBeVisible();
  });

  test("door staff check someone in and undo it", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "door",
      `/admin/events/${eventId}/check-in`,
    );

    await expect(
      page.getByRole("heading", { level: 1, name: "Check in" }),
    ).toBeVisible();
    await expect(visibleText(page, "0 of 3 here")).toBeVisible();
    // Door staff never see money.
    await expect(visibleText(page, /To pay/)).toHaveCount(0);
    await expectNoAccessibilityProblems(page);
    await expectNoSidewaysScroll(page);

    await page.getByLabel("Find someone").fill("zoe crafter");
    await expect(page.getByRole("button", { name: /^Arrived/ })).toHaveCount(1);
    await page.getByRole("button", { name: `Arrived: ${people.zoe}` }).click();
    await expect(visibleText(page, `${people.zoe} is here.`)).toBeVisible();
    await expect(visibleText(page, "1 of 3 here")).toBeVisible();
    await expect(visibleText(page, /^Here \d\d:\d\d$/)).toBeVisible();

    const [saved] = await sql<{ checked_in_at: string | null }>(
      `select b.checked_in_at from public.bookings b
       join public.customers c on c.id = b.customer_id
       where c.full_name = $1`,
      [people.zoe],
    );
    expect(saved?.checked_in_at).not.toBeNull();

    // Only people not here yet: Zoe drops off the list.
    await page.getByLabel("Find someone").fill("");
    await page.getByLabel("Only people not here yet").check();
    await expect(page.getByRole("button", { name: /^Arrived/ })).toHaveCount(2);
    await page.getByLabel("Only people not here yet").uncheck();

    await page
      .getByRole("button", { name: `Undo arrival for ${people.zoe}` })
      .click();
    await expect(
      visibleText(page, `${people.zoe} is no longer marked as here.`),
    ).toBeVisible();
    await expect(visibleText(page, "0 of 3 here")).toBeVisible();
  });

  test("an owner sees what each person still owes when checking in", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}/check-in`,
    );
    const zoe = page.getByRole("listitem").filter({ hasText: people.zoe });
    await expect(zoe.getByText("To pay: £195")).toBeVisible();
    // The team's free places owe nothing.
    const team = page.getByRole("listitem").filter({ hasText: people.team });
    await expect(team.getByText(/To pay/)).toHaveCount(0);
  });
});
