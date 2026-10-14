import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { signInAsTeam, sql, visibleText } from "./team";

/**
 * Recording bank transfers from a statement. Tagged @supabase because it
 * needs the local Supabase stack running. Everyone here is made up.
 */

test.describe("bank statements @supabase", () => {
  test("an owner uploads a statement, checks the matches and records them", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    const rows = await sql<{ full_name: string; reference: string }>(
      `select c.full_name, b.reference from public.bookings b
       join public.customers c on c.id = b.customer_id where b.event_id = $1`,
      [eventId],
    );
    const reference = (name: string) =>
      rows.find((row) => row.full_name === name)!.reference;
    const suffix = people.zoe.split(" ").at(-1)!;
    const statement = [
      "Date,Type,Description,Paid out,Paid in,Balance",
      `02/04/2026,FPI,${reference(people.bea)} THANK YOU,,60.00,1060.00`,
      `03/04/2026,FPI,ZOE ${suffix.toUpperCase()} MARCH,,60.00,1120.00`,
      "03/04/2026,DD,ELECTRIC CO,45.00,,1075.00",
      "04/04/2026,FPI,REFUND FROM SHOP,,12.50,1087.50",
    ].join("\n");

    await signInAsTeam(page, testInfo.project.name, "owner", "/admin/bank");
    await expect(
      page.getByRole("heading", { level: 1, name: "Bank statement" }),
    ).toBeVisible();
    await page.getByLabel("Bank statement (CSV file)").setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(statement),
    });

    await expect(
      visibleText(page, /3 payments in on the statement/),
    ).toBeVisible();
    // The reference and the name both match; the shop refund doesn't.
    await expect(page.getByLabel("Booking").nth(0)).toHaveValue(/.+/);
    await expect(page.getByLabel("Booking").nth(1)).toHaveValue(/.+/);
    await expect(page.getByLabel("Booking").nth(2)).toHaveValue("");
    await expect(
      visibleText(page, "2 payments ticked, £120 in total."),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page.getByRole("button", { name: "Record 2 payments" }).click();
    await expect(visibleText(page, "Recorded 2 payments.")).toBeVisible();
    await expect(
      visibleText(page, new RegExp(`Recorded for ${people.bea}`)),
    ).toBeVisible();

    const payments = await sql<{ amount_pence: number; note: string }>(
      `select p.amount_pence, p.note from public.payments p
       join public.bookings b on b.id = p.booking_id where b.event_id = $1
       order by p.note`,
      [eventId],
    );
    expect(payments).toHaveLength(2);
    expect(payments[0]?.note).toMatch(/^Bank statement: FPI PF-/);

    // The same statement again: both are flagged as already recorded.
    await page.reload();
    await page.getByLabel("Bank statement (CSV file)").setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(statement),
    });
    await expect(
      visibleText(page, /already has a payment of £60 on/),
    ).toHaveCount(2);
    await expect(
      visibleText(page, "0 payments ticked, £0 in total."),
    ).toBeVisible();
  });

  test("explains a file that isn't a statement", async ({ page }, testInfo) => {
    await signInAsTeam(page, testInfo.project.name, "admin", "/admin/bank");
    await page.getByLabel("Bank statement (CSV file)").setInputFiles({
      name: "people.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Name,Email\nJo,jo@example.test"),
    });
    await expect(
      visibleText(page, /doesn't look like a bank statement/),
    ).toBeVisible();
  });

  test("doesn't tick a transfer that was already typed in with the Pay box", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    const [bea] = await sql<{ id: string; reference: string }>(
      `select b.id, b.reference from public.bookings b
       join public.customers c on c.id = b.customer_id
       where b.event_id = $1 and c.full_name = $2`,
      [eventId, people.bea],
    );
    // Typed in today; the bank says it arrived two days ago.
    await sql(
      `insert into public.payments (booking_id, amount_pence, method, received_on)
       values ($1, 6000, 'bank_transfer', current_date)`,
      [bea!.id],
    );
    const [earlier] = await sql<{ day: string }>(
      "select to_char(current_date - 2, 'DD/MM/YYYY') as day",
    );
    await signInAsTeam(page, testInfo.project.name, "owner", "/admin/bank");
    await page.getByLabel("Bank statement (CSV file)").setInputFiles({
      name: "statement.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        `Date,Description,Amount\n${earlier!.day},${bea!.reference} DEPOSIT,60.00`,
      ),
    });
    await expect(
      visibleText(page, /already has a payment of £60 on/),
    ).toBeVisible();
    await expect(page.getByLabel("Record")).not.toBeChecked();
    await expect(
      visibleText(page, "0 payments ticked, £0 in total."),
    ).toBeVisible();
  });
});
