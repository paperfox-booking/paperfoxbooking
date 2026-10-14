import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import {
  createAccountWithPassword,
  sql,
  teamSignIn,
  visibleText,
} from "./team";

/**
 * A customer's own account: their bookings, what they owe, how to pay and
 * their documents. Customers really sign in with an emailed code; here a
 * made-up customer is given a password, so this test doesn't need email.
 * Tagged @supabase because it needs the local Supabase stack running.
 */

test.describe("a customer's account @supabase", () => {
  test("shows their booking, how to pay and their own PDFs only", async ({
    page,
  }, testInfo) => {
    await sql(
      "update public.settings set bank_sort_code = '12-34-56', bank_account_number = '12345678'",
    );
    const { eventId, people } = await eventWithPeople();
    const [bea] = await sql<{
      booking_id: string;
      customer_id: string;
      email: string;
      reference: string;
    }>(
      `select b.id as booking_id, c.id as customer_id, c.email, b.reference
       from public.bookings b join public.customers c on c.id = b.customer_id
       where b.event_id = $1 and c.full_name = $2`,
      [eventId, people.bea],
    );
    const [zoe] = await sql<{ id: string }>(
      `select b.id from public.bookings b join public.customers c on c.id = b.customer_id
       where b.event_id = $1 and c.full_name = $2`,
      [eventId, people.zoe],
    );
    await createAccountWithPassword(bea!.email, "a customer password");
    await sql(
      "update public.customers set user_id = (select id from auth.users where email = $1) where id = $2",
      [bea!.email, bea!.customer_id],
    );
    await sql(
      `insert into public.payments (booking_id, amount_pence, method, received_on)
       values ($1, 6000, 'bank_transfer', current_date)`,
      [bea!.booking_id],
    );

    await page.goto("/sign-in/team?next=%2Faccount");
    await teamSignIn(page, bea!.email, "a customer password");
    await expect(page).toHaveURL(/\/account$/);
    await expect(
      page.getByRole("heading", { level: 2, name: "My bookings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: /^People Test/ }),
    ).toBeVisible();
    await expect(visibleText(page, bea!.reference).first()).toBeVisible();
    await expect(visibleText(page, /^£135 by /)).toBeVisible();
    await expect(visibleText(page, /Sort code: 12-34-56/)).toBeVisible();
    // Her deposit's paid, so her confirmation is ready.
    await expect(
      page.getByRole("link", { name: /Your confirmation \(PDF\)/ }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const mine = await page.request.get(
      `/account/bookings/${bea!.booking_id}/documents/confirmation`,
    );
    expect(mine.status()).toBe(200);
    expect(mine.headers()["content-type"]).toBe("application/pdf");

    // Someone else's booking isn't hers to download.
    const theirs = await page.request.get(
      `/account/bookings/${zoe!.id}/documents/booking-details`,
    );
    expect(theirs.status()).toBe(404);

    // Her statement of payments, but not anyone else's.
    await expect(
      page.getByRole("link", { name: /^Statement of payments \(PDF\)/ }),
    ).toBeVisible();
    const statement = await page.request.get(
      `/account/bookings/${bea!.booking_id}/statement`,
    );
    expect(statement.status()).toBe(200);
    expect(statement.headers()["content-type"]).toBe("application/pdf");
    const otherStatement = await page.request.get(
      `/account/bookings/${zoe!.id}/statement`,
    );
    expect(otherStatement.status()).toBe(404);
    void testInfo;
  });
});
