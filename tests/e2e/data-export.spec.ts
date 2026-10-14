import { expect, test } from "@playwright/test";
import { eventWithPeople } from "./data";
import { signInAsTeam, sql } from "./team";

/**
 * Downloading everything held about a person. Tagged @supabase because it
 * needs the local Supabase stack running. Everyone here is made up.
 */

test.describe("a person's data @supabase", () => {
  test("an owner downloads everything held about someone; door staff can't", async ({
    page,
    browser,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    const [zoe] = await sql<{ customer_id: string; booking_id: string }>(
      `select c.id as customer_id, b.id as booking_id from public.bookings b
       join public.customers c on c.id = b.customer_id
       where b.event_id = $1 and c.full_name = $2`,
      [eventId, people.zoe],
    );
    await sql(
      `insert into public.payments (booking_id, amount_pence, method, received_on)
       values ($1, 6000, 'bank_transfer', current_date)`,
      [zoe!.booking_id],
    );
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/people/${zoe!.customer_id}`,
    );
    await expect(
      page.getByRole("link", { name: /Download everything we hold/ }),
    ).toBeVisible();
    const response = await page.request.get(
      `/admin/people/${zoe!.customer_id}/export`,
    );
    expect(response.status()).toBe(200);
    const data = (await response.json()) as {
      person: { full_name: string };
      bookings: { reference: string; payments: { amount_pence: number }[] }[];
    };
    expect(data.person.full_name).toBe(people.zoe);
    expect(data.bookings).toHaveLength(1);
    expect(data.bookings[0]?.payments[0]?.amount_pence).toBe(6000);

    const door = await browser.newPage();
    await signInAsTeam(door, testInfo.project.name, "door", "/admin");
    const refused = await door.request.get(
      `/admin/people/${zoe!.customer_id}/export`,
    );
    expect(refused.status()).toBe(403);
    await door.close();
  });
});
