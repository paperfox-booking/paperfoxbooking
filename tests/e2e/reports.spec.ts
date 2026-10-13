import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { signInAsTeam, sql, visibleText } from "./team";

/**
 * Profit and loss: an event's costs and the report across events. Tagged
 * @supabase because it needs the local Supabase stack running.
 */

test.describe("profit and loss @supabase", () => {
  test("an owner adds costs and sees the profit, then the report", async ({
    page,
  }, testInfo) => {
    const { eventId } = await eventWithPeople();
    // £60 paid by one person, so income is £390 (2 × £195) and received £60.
    await sql(
      `insert into public.payments (booking_id, amount_pence, received_on)
       select id, 6000, '2026-10-01' from public.bookings
       where event_id = $1 and price_pence > 0 limit 1`,
      [eventId],
    );
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}/costs`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Profit and loss" }),
    ).toBeVisible();
    await expect(visibleText(page, "No costs yet.").first()).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page
      .getByLabel("Type of cost", { exact: true })
      .selectOption("venue");
    await page.getByLabel("What for (optional)").fill("Room hire");
    await page.getByLabel("Amount", { exact: true }).fill("250");
    await page.getByLabel("Already paid").check();
    await page.getByRole("button", { name: "Add cost" }).click();
    await expect(
      visibleText(page, "Added venue and room hire: £250."),
    ).toBeVisible();

    // Profit: £390 income less £250 costs.
    await expect(
      page.getByRole("region", { name: "Summary" }).getByText("£140.00"),
    ).toBeVisible();

    // Change the amount in the list.
    const amount = page.getByRole("textbox", { name: "Amount for Room hire" });
    await amount.fill("300");
    await amount.press("Enter");
    await expect(
      visibleText(page, "Saved amount for room hire."),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Summary" }).getByText("£90.00"),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.goto("/admin/reports");
    await expect(
      page.getByRole("heading", { level: 1, name: "Profit and loss" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /People Test/ }).first(),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    const csv = await page.request.get("/admin/reports/export?year=all");
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(await csv.text()).toContain("Profit (£)");
  });

  test("door staff can't see costs or reports", async ({ page }, testInfo) => {
    const { eventId } = await eventWithPeople();
    await signInAsTeam(page, testInfo.project.name, "door", "/admin/reports");
    await expect(
      page.getByRole("heading", { name: "You can't use this page" }),
    ).toBeVisible();
    await page.goto(`/admin/events/${eventId}/costs`);
    await expect(
      page.getByRole("heading", { name: "You can't use this page" }),
    ).toBeVisible();
    const csv = await page.request.get("/admin/reports/export");
    expect(csv.status()).toBe(403);
  });
});
