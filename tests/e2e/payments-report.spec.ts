import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { signInAsTeam, sql, visibleText } from "./team";

/**
 * The payments by date report. Tagged @supabase because it needs the local
 * Supabase stack running. Everyone here is made up.
 */

test.describe("payments by date @supabase", () => {
  test("an owner sees payments and refunds by day and method, and downloads them", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    // A month of its own for each screen size, as they run side by side.
    const month = testInfo.project.name === "phone" ? "2020-02" : "2020-03";
    const [zoe] = await sql<{ id: string }>(
      `select b.id from public.bookings b join public.customers c on c.id = b.customer_id
       where b.event_id = $1 and c.full_name = $2`,
      [eventId, people.zoe],
    );
    // Only this test uses these months: clear any left from an earlier run.
    await sql(
      "delete from public.payments where received_on between $1 and $2",
      [`${month}-01`, `${month}-28`],
    );
    await sql(
      "delete from public.refunds where refunded_on between $1 and $2",
      [`${month}-01`, `${month}-28`],
    );
    await sql(
      `insert into public.payments (booking_id, amount_pence, method, received_on, note) values
         ($1, 6000, 'bank_transfer', $2, 'Deposit'),
         ($1, 2000, 'cash', $3, '')`,
      [zoe!.id, `${month}-10`, `${month}-11`],
    );
    await sql(
      `insert into public.refunds (booking_id, amount_pence, refunded_on, reason)
       values ($1, 2500, $2, 'Paid too much')`,
      [zoe!.id, `${month}-12`],
    );

    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/reports/payments?from=${month}-01&to=${month}-28`,
    );
    await expect(
      page.getByRole("heading", { name: "£80.00 from 2 payments" }),
    ).toBeVisible();
    await expect(visibleText(page, /Bank transfer: £60\.00/)).toBeVisible();
    await expect(visibleText(page, /Cash: £20\.00/)).toBeVisible();
    // Refunds are money going out, so they come off the total.
    await expect(
      visibleText(page, "Less £25.00 paid back in 1 refund, so £55.00 in all."),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /: -£25\.00$/ }),
    ).toBeVisible();
    await expect(visibleText(page, "refunded by bank transfer")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /: £60\.00$/ }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    const csv = await page.request.get(
      `/admin/reports/payments/export?from=${month}-01&to=${month}-28`,
    );
    const text = await csv.text();
    expect(text).toContain(
      `10/${month.slice(5)}/2020,60,Bank transfer,${people.zoe}`,
    );
    expect(text).toContain(
      `12/${month.slice(5)}/2020,-25,Refund: Bank transfer,${people.zoe}`,
    );
  });
});
