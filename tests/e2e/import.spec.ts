import path from "node:path";
import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { signInAsTeam, sql, uniqueSuffix, visibleText } from "./team";

/**
 * Importing a booking spreadsheet. tests/fixtures/sample-bookings.xlsx has
 * made-up people in the same layout as Paper Fox's real sheets. Tagged
 * @supabase because it needs the local Supabase stack running.
 */

const sample = path.join(process.cwd(), "tests/fixtures/sample-bookings.xlsx");

async function emptyEvent(): Promise<string> {
  const [event] = await sql<{ id: string }>(
    `insert into public.events (title, venue_id, starts_at, ends_at, balance_due_on, capacity)
     select $1, id, '2031-03-14T09:00:00Z', '2031-03-16T17:00:00Z', '2031-01-31', 110
     from public.venues where name = 'Holiday Inn Coventry'
     returning id`,
    [`Import Test ${uniqueSuffix()}`],
  );
  await sql(
    `insert into public.ticket_types (event_id, name, price_pence, deposit_pence, starts_at, sort_order)
     values ($1, 'Weekend (4pm start)', 19500, 6000, '2031-03-14T16:00:00Z', 1),
            ($1, 'Friday Kick Starter (9am start)', 24500, 8500, '2031-03-14T09:00:00Z', 2)`,
    [event!.id],
  );
  return event!.id;
}

test.describe("importing a spreadsheet @supabase", () => {
  test("an owner checks the preview, then imports everyone in one go", async ({
    page,
  }, testInfo) => {
    // The sample's people may already be on file from an earlier run (or
    // the phone and desktop runs at the same time): the import reuses them.
    await sql(
      `insert into public.customers (full_name, email)
       select * from unnest($1::text[], $2::text[])
       on conflict (email) where email is not null and deleted_at is null do nothing`,
      [
        [
          "Alex Example",
          "Blair Sample",
          "Casey Demo",
          "Drew Trial",
          "Emery Mock",
        ],
        [
          "alex.example@example.test",
          "blair.sample@example.test",
          "casey.demo@example.test",
          "drew.trial@example.test",
          "emery.mock@example.test",
        ],
      ],
    );
    const eventId = await emptyEvent();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}/import`,
    );
    await expectNoAccessibilityProblems(page);

    await page.getByLabel("Spreadsheet file").setInputFiles(sample);
    await page.getByRole("button", { name: "Check the spreadsheet" }).click();

    await expect(
      page.getByRole("heading", { name: "2. Check what will be imported" }),
    ).toBeVisible();
    await expect(
      visibleText(page, /8\s+people, including 2 on the team/),
    ).toBeVisible();
    await expect(
      visibleText(
        page,
        "The spreadsheet's Balance Due total is £295, but the rows add up to £785. The system uses each row's own figures.",
      ),
    ).toBeVisible();
    await expect(
      visibleText(
        page,
        "Charged £195, but Friday Kick Starter (9am start) is £245. The spreadsheet's £195 is kept.",
      ),
    ).toBeVisible();
    await expect(visibleText(page, /Row 13: Below the totals/)).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page.getByRole("button", { name: "Import 8 people" }).click();
    await expect(page).toHaveURL(
      new RegExp(`/admin/events/${eventId}/people\\?notice=imported`),
    );
    await expect(visibleText(page, /Imported 8 people\./)).toBeVisible();
    await expect(visibleText(page, "8 of 110")).toBeVisible();
    await expect(visibleText(page, "Received: £485")).toBeVisible();

    // The team comes first.
    await expect(
      page.getByRole("textbox", { name: /^Name for / }).first(),
    ).toHaveValue("Robin Helper");

    // A second import into the same event isn't allowed.
    await page.goto(`/admin/events/${eventId}/import`);
    await expect(
      visibleText(page, /already has 8 people booked/),
    ).toBeVisible();
  });
});
