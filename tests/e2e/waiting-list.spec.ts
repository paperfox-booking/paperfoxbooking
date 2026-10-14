import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { signInAsTeam, sql, uniqueSuffix, visibleText } from "./team";

/**
 * The waiting list for a full event. Tagged @supabase because it needs the
 * local Supabase stack running. Everyone here is made up.
 */

test.describe("the waiting list @supabase", () => {
  test("an owner adds people, offers a place and books someone in", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await sql("update public.events set capacity = 3 where id = $1", [eventId]);
    const suffix = uniqueSuffix();
    const wendy = `Wendy Waiting ${suffix}`;
    const val = `Val Reserve ${suffix}`;

    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}/waiting-list`,
    );
    await expect(visibleText(page, /it's full/)).toBeVisible();
    await expectNoAccessibilityProblems(page);

    const add = async (name: string) => {
      await page.getByLabel("Name", { exact: true }).fill(name);
      await page
        .getByLabel("Email (optional)")
        .fill(`${name.replace(/\s+/g, ".").toLowerCase()}@example.test`);
      await page
        .getByRole("button", { name: "Add to the waiting list" })
        .click();
    };
    await add(wendy);
    await expect(
      page.getByRole("heading", { name: `1. ${wendy}` }),
    ).toBeVisible();
    await add(val);
    await expect(
      page.getByRole("heading", { name: `2. ${val}` }),
    ).toBeVisible();
    await add(wendy);
    // Wendy can't be added twice.
    await expect(
      visibleText(page, `${wendy} is already on the waiting list.`),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `1. ${wendy}` }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `2. ${val}` }),
    ).toBeVisible();
    await expect(visibleText(page, "Waiting (2)")).toBeVisible();

    // Offer Wendy a place.
    const card = page
      .locator("li")
      .filter({ has: page.getByRole("heading", { name: `1. ${wendy}` }) })
      .filter({ visible: true });
    await card.locator("summary", { hasText: "Offer a place" }).click();
    await card.getByRole("button", { name: `Offer ${wendy} a place` }).click();
    await expect(visibleText(page, /Marked as offered a place/)).toBeVisible();
    await expect(visibleText(page, /Offered a place on/)).toBeVisible();

    // The event is full, so booking her in explains why it can't.
    const offeredCard = page
      .locator("li")
      .filter({ has: page.getByRole("heading", { name: `1. ${wendy}` }) })
      .filter({ visible: true });
    await offeredCard.locator("summary", { hasText: "Book them in" }).click();
    await offeredCard
      .getByLabel("Option", { exact: true })
      .selectOption({ index: 1 });
    await offeredCard.getByRole("button", { name: `Book ${wendy} in` }).click();
    await expect(visibleText(page, /This event is full/)).toBeVisible();

    // Someone cancels, so there's a place.
    await sql(
      `update public.bookings b set cancelled_at = now(), cancel_reason = 'Test'
       from public.customers c where c.id = b.customer_id and c.full_name = $1`,
      [people.zoe],
    );
    await page.reload();
    const again = page
      .locator("li")
      .filter({ has: page.getByRole("heading", { name: `1. ${wendy}` }) })
      .filter({ visible: true });
    await again.locator("summary", { hasText: "Book them in" }).click();
    await again
      .getByLabel("Option", { exact: true })
      .selectOption({ index: 1 });
    await again.getByRole("button", { name: `Book ${wendy} in` }).click();
    await expect(
      visibleText(page, /Booked in from the waiting list/),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: wendy }),
    ).toBeVisible();

    // Val says no.
    await page.goto(`/admin/events/${eventId}/waiting-list`);
    await page.getByRole("button", { name: /^They said no/ }).click();
    await expect(visibleText(page, "Waiting (0)")).toBeVisible();
    await expect(visibleText(page, /said no/)).toBeVisible();
    await expect(visibleText(page, "open their booking")).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });
});
