import { expect, test, type Page } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { signInAsTeam, sql, uniqueSuffix, visibleText } from "./team";

/**
 * The team setting up events, and visitors seeing them. Tagged @supabase
 * because they need the local Supabase stack running.
 */

/** Adds a draft event with the usual two options, straight into the database. */
async function createDraftEvent(title: string): Promise<string> {
  const [event] = await sql<{ id: string }>(
    `insert into public.events
       (title, venue_id, starts_at, ends_at, balance_due_on, capacity, summary)
     select $1, id, '2031-03-14T09:00:00Z', '2031-03-16T17:00:00Z', '2031-01-31', 110,
            'Our spring crop weekend'
     from public.venues where name = 'Holiday Inn Coventry'
     returning id`,
    [title],
  );
  await sql(
    `insert into public.ticket_types (event_id, name, price_pence, deposit_pence, starts_at, sort_order)
     values ($1, 'Weekend (4pm start)', 19500, 6000, '2031-03-14T16:00:00Z', 1),
            ($1, 'Friday Kick Starter (9am start)', 24500, 8500, '2031-03-14T09:00:00Z', 2)`,
    [event!.id],
  );
  return event!.id;
}

async function fillDate(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).fill(value);
}

test.describe("setting up events @supabase", () => {
  test("an owner adds an event with the usual options, publishes it, and it's on the website", async ({
    page,
  }, testInfo) => {
    const title = `Crop Weekend ${uniqueSuffix()} March 2031`;
    await signInAsTeam(page, testInfo.project.name, "owner", "/admin/events");

    await page.getByRole("link", { name: "Add an event" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Add an event" }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page.getByLabel("Event name").fill(title);
    await page
      .getByLabel("Summary (optional)")
      .fill("Three days of crafting with friends.");
    await fillDate(page, "Start date", "2031-03-14");
    // Picking the start fills in the end and balance due dates.
    await expect(page.getByLabel("End date", { exact: true })).toHaveValue(
      "2031-03-16",
    );
    await expect(page.getByLabel("Balance due by")).toHaveValue("2031-01-31");
    await expect(page.getByLabel("Places")).toHaveValue("110");
    await page.getByRole("button", { name: "Add event" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(visibleText(page, "Saved.")).toBeVisible();
    await expect(visibleText(page, "Draft", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Weekend (4pm start)" }),
    ).toBeVisible();
    await expect(
      visibleText(page, "£60 deposit, then £135 by Friday 31 January 2031."),
    ).toBeVisible();
    await expect(
      visibleText(page, "£85 deposit, then £160 by Friday 31 January 2031."),
    ).toBeVisible();
    await expect(visibleText(page, "6 weeks before")).toBeVisible();
    await expectNoAccessibilityProblems(page);

    // Drafts aren't on the website yet.
    const slug = title.toLowerCase().replace(/\s+/g, "-");
    const draft = await page.request.get(`/events/${slug}`);
    expect(await draft.text()).not.toContain("Three days of crafting");

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(
      visibleText(page, "Published. It's now on the website."),
    ).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${slug}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expect(
      visibleText(page, "Friday 14 to Sunday 16 March 2031").first(),
    ).toBeVisible();
    await expect(visibleText(page, "Booking open")).toBeVisible();
    await expect(
      visibleText(
        page,
        "Book with a £60 deposit, then pay the remaining £135 by Friday 31 January 2031.",
      ),
    ).toBeVisible();
    await expect(
      visibleText(page, "Starts 9am on Friday 14 March 2031"),
    ).toBeVisible();
    await expect(
      visibleText(page, "Holiday Inn Coventry").first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How to book" }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("the event form explains what needs changing and keeps what was typed", async ({
    page,
  }, testInfo) => {
    await signInAsTeam(
      page,
      testInfo.project.name,
      "admin",
      "/admin/events/new",
    );

    await page.getByLabel("Event name").fill("Half-finished event");
    await fillDate(page, "Start date", "2031-06-13");
    await fillDate(page, "End date", "2031-06-12");
    await page.getByLabel("Places").fill("lots");
    await page.getByRole("button", { name: "Add event" }).click();

    await expect(
      visibleText(page, "Some details need changing."),
    ).toBeVisible();
    await expect(
      visibleText(page, "Enter a whole number, like 110"),
    ).toBeVisible();
    await expect(page.getByLabel("Places")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByLabel("Event name")).toHaveValue(
      "Half-finished event",
    );

    await page.getByLabel("Places").fill("110");
    await page.getByRole("button", { name: "Add event" }).click();
    await expect(
      visibleText(
        page,
        "The event must end after it starts. Check the end date.",
      ),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });

  test("an admin copies last year's event to make next year's", async ({
    page,
  }, testInfo) => {
    const suffix = uniqueSuffix();
    const eventId = await createDraftEvent(`Copy Test ${suffix} March 2031`);
    await signInAsTeam(
      page,
      testInfo.project.name,
      "admin",
      `/admin/events/${eventId}`,
    );

    await page.getByRole("link", { name: "Copy this event" }).click();
    await expect(page.getByLabel("Name for the new event")).toHaveValue(
      `Copy Test ${suffix} March 2032`,
    );
    await expect(page.getByLabel("Date the new event starts")).toHaveValue(
      "2032-03-12",
    );
    await expectNoAccessibilityProblems(page);
    await page.getByRole("button", { name: "Copy event" }).click();

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: `Copy Test ${suffix} March 2032`,
      }),
    ).toBeVisible();
    await expect(visibleText(page, "This is the new copy.")).toBeVisible();
    await expect(
      visibleText(page, "Friday 12 to Sunday 14 March 2032").first(),
    ).toBeVisible();
    await expect(
      visibleText(page, "Starts 4pm on Friday 12 March 2032"),
    ).toBeVisible();
    await expect(
      visibleText(page, "£60 deposit, then £135 by Friday 30 January 2032."),
    ).toBeVisible();
  });

  test("an admin changes an option's price and deposit", async ({
    page,
  }, testInfo) => {
    const eventId = await createDraftEvent(`Option Test ${uniqueSuffix()}`);
    await signInAsTeam(
      page,
      testInfo.project.name,
      "admin",
      `/admin/events/${eventId}`,
    );

    await page
      .getByRole("link", { name: "Change Friday Kick Starter (9am start)" })
      .click();
    await expect(page.getByLabel("Full price")).toHaveValue("245");
    await expect(page.getByLabel("Deposit (optional)")).toHaveValue("85");
    await expectNoAccessibilityProblems(page);

    await page.getByLabel("Deposit (optional)").fill("250");
    await page.getByRole("button", { name: "Save option" }).click();
    await expect(
      visibleText(page, "The deposit must be less than the full price."),
    ).toBeVisible();

    await page.getByLabel("Full price").fill("250.50");
    await page.getByLabel("Deposit (optional)").fill("90");
    await page.getByRole("button", { name: "Save option" }).click();
    await expect(visibleText(page, "The option has been saved.")).toBeVisible();
    await expect(
      visibleText(page, "£90 deposit, then £160.50 by Friday 31 January 2031."),
    ).toBeVisible();
  });

  test("door staff can see events but not change them", async ({
    page,
  }, testInfo) => {
    const title = `Door Test ${uniqueSuffix()}`;
    const eventId = await createDraftEvent(title);
    await signInAsTeam(page, testInfo.project.name, "door", "/admin/events");

    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add an event" })).toHaveCount(
      0,
    );
    await page.goto(`/admin/events/${eventId}`);
    await expect(
      page.getByRole("link", { name: "Change details" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Publish" })).toHaveCount(0);

    await page.goto("/admin/events/new");
    await expect(
      page.getByRole("heading", { name: "You can't use this page" }),
    ).toBeVisible();
  });
});
