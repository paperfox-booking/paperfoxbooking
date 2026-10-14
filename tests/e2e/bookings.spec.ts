import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { signInAsTeam, sql, visibleText } from "./team";

/**
 * A booking's own page, and the People list. Tagged @supabase because they
 * need the local Supabase stack running. Everyone here is made up.
 */

/** Opens a collapsed section on screen by its summary. */
function openDetails(page: import("@playwright/test").Page, summary: string) {
  return page
    .locator("summary", { hasText: summary })
    .filter({ visible: true })
    .first()
    .click();
}

function noSidewaysScroll(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

test.describe("a booking's own page @supabase", () => {
  test("an owner records and removes payments, changes the price and cancels", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}/people`,
    );
    await page
      .getByRole("link", { name: new RegExp(`for ${people.zoe}$`) })
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: people.zoe }),
    ).toBeVisible();
    await expect(visibleText(page, "Nothing paid yet")).toBeVisible();
    await expectNoAccessibilityProblems(page);
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);

    // Record £60 cash.
    await expect(page.getByLabel("Amount received")).toHaveValue("60");
    await page.getByLabel("How it was paid").selectOption("cash");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(visibleText(page, "Payment recorded.")).toBeVisible();
    await expect(visibleText(page, "Deposit paid")).toBeVisible();
    // Paying the deposit sends B2 by itself.
    await expect(
      visibleText(page, "B2: deposit received has been emailed to them."),
    ).toBeVisible();

    // Record another £60 by mistake, then remove it.
    await page.getByLabel("Amount received").fill("60");
    await page.getByRole("button", { name: "Record payment" }).click();
    await expect(
      page
        .locator("summary", { hasText: "the payment of £60" })
        .filter({ visible: true }),
    ).toHaveCount(2);
    // Next.js keeps the page as it was before the payment, hidden, so only
    // look at what's on screen.
    const removal = page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: "the payment of £60" }),
        visible: true,
      })
      .last();
    await removal.locator("summary").click();
    await removal.getByLabel("Why it's being removed").fill("Recorded twice");
    await removal
      .getByRole("button", { name: "Remove the payment of £60" })
      .click();
    await expect(visibleText(page, /Payment removed\./)).toBeVisible();
    await expect(
      visibleText(page, "Removed: Recorded twice", { exact: true }),
    ).toBeVisible();

    // Change the price, with a reason.
    await openDetails(page, "Change the price");
    await page.getByLabel("Total due").fill("180");
    await page
      .getByLabel("Why the price is different")
      .fill("Loyalty discount");
    await page.getByRole("button", { name: "Change the price" }).click();
    await expect(visibleText(page, "Price changed.")).toBeVisible();
    await expect(visibleText(page, "£180 (Loyalty discount)")).toBeVisible();

    // The history says what happened, in plain English.
    await expect(
      visibleText(page, "Total due changed from £195 to £180."),
    ).toBeVisible();
    await expect(
      visibleText(page, "Payment of £60 removed: Recorded twice."),
    ).toBeVisible();

    // Record an email sent outside the system.
    await openDetails(page, "Record an email sent outside the system");
    await page.getByLabel("Which email").selectOption("B2");
    await page.getByRole("button", { name: "Record email" }).click();
    await expect(visibleText(page, "Email recorded.")).toBeVisible();
    await expect(
      visibleText(page, /^Sent outside the system, recorded by/),
    ).toBeVisible();

    // Cancel, then reinstate.
    await openDetails(page, "Cancel this booking");
    await page.getByRole("button", { name: "Cancel the booking" }).click();
    await expect(
      visibleText(page, "Say why the booking is being cancelled"),
    ).toBeVisible();
    await page
      .getByLabel("Why it's being cancelled")
      .fill("Can't come any more");
    await page.getByLabel("Yes, cancel this booking").check();
    await page.getByRole("button", { name: "Cancel the booking" }).click();
    await expect(
      visibleText(
        page,
        "The booking has been cancelled and the place freed up.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reinstate this booking" }).click();
    await expect(
      visibleText(page, "The booking has been reinstated."),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });
});

test.describe("refunds @supabase", () => {
  test("an owner cancels a booking and records a refund, with the terms as a guide", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    const [booking] = await sql<{ id: string }>(
      `select b.id from public.bookings b join public.customers c on c.id = b.customer_id
        where b.event_id = $1 and c.full_name = $2`,
      [eventId, people.bea],
    );
    for (const amount of [6000, 13500]) {
      await sql(
        "insert into public.payments (booking_id, amount_pence, received_on) values ($1, $2, '2026-09-01')",
        [booking!.id, amount],
      );
    }
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/bookings/${booking!.id}`,
    );
    await expect(visibleText(page, "Paid in full")).toBeVisible();

    await openDetails(page, "Cancel this booking");
    await page
      .getByLabel("Why it's being cancelled")
      .fill("Can't come any more");
    await page.getByLabel("Yes, cancel this booking").check();
    await page.getByRole("button", { name: "Cancel the booking" }).click();
    await expect(
      visibleText(
        page,
        "The booking has been cancelled and the place freed up.",
      ),
    ).toBeVisible();

    // The refund form is open once cancelled, with what they've paid, how
    // long before the event it is, and what the terms say.
    await expect(
      visibleText(page, /^They've paid £195, and the deposit is £60\./),
    ).toBeVisible();
    await expect(
      visibleText(
        page,
        /They cancelled on .+ weeks.* before the event starts\./,
      ),
    ).toBeVisible();
    await openDetails(page, "What the terms say about cancelling");
    await expect(
      visibleText(page, /a £60 administration fee will be retained/),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);

    // More than they paid isn't allowed.
    const refund = page.getByLabel("Amount refunded");
    await refund.fill("200");
    await page.getByLabel("Why", { exact: true }).fill("Cancelled early");
    await page.getByRole("button", { name: "Record refund" }).click();
    await expect(
      visibleText(
        page,
        "That's more than they've paid. The most you can refund is £195",
      ),
    ).toBeVisible();

    await page.getByLabel("Amount refunded").fill("135");
    await page
      .getByLabel("Why", { exact: true })
      .fill("Cancelled more than 6 weeks before, £60 fee kept");
    await page.getByRole("button", { name: "Record refund" }).click();
    await expect(
      visibleText(page, "Refund recorded.", { exact: false }),
    ).toBeVisible();
    await expect(
      visibleText(page, "£195 received, less £135 refunded: £60"),
    ).toBeVisible();
    await expect(
      visibleText(page, /^Refund of £135 recorded \(bank transfer, paid back/),
    ).toBeVisible();

    // A refund recorded by mistake can be removed, and stays in the history.
    const removal = page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: "the refund of £135" }),
        visible: true,
      })
      .last();
    await removal.locator("summary").click();
    await removal.getByLabel("Why it's being removed").fill("Wrong booking");
    await removal
      .getByRole("button", { name: "Remove the refund of £135" })
      .click();
    await expect(visibleText(page, /Refund removed\./)).toBeVisible();
    await expect(
      visibleText(page, "Refund of £135 removed: Wrong booking."),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });
});

test.describe("the People list @supabase", () => {
  test("an owner updates someone's details in the list and on their profile", async ({
    page,
  }, testInfo) => {
    const { people } = await eventWithPeople();
    await signInAsTeam(page, testInfo.project.name, "owner", "/admin/people");
    await page.getByLabel("Find someone").fill(people.bea);
    await expect(visibleText(page, "Showing 1 of")).toBeVisible();
    await expectNoAccessibilityProblems(page);
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);

    const notes = page.getByRole("textbox", {
      name: `Notes for ${people.bea}`,
    });
    await notes.fill("Likes the window seat");
    await notes.press("Enter");
    await expect(
      visibleText(page, `Saved notes for ${people.bea}.`),
    ).toBeVisible();

    await page.getByRole("link", { name: `Profile for ${people.bea}` }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: people.bea }),
    ).toBeVisible();
    await expect(page.getByLabel("Notes about them (optional)")).toHaveValue(
      "Likes the window seat",
    );
    await expect(
      visibleText(page, /Nothing paid yet\. Paid £0 of £195/),
    ).toBeVisible();
    await page.getByLabel("Mobile (optional)").fill("07700 900999");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(visibleText(page, "Saved.")).toBeVisible();
    await expect(page.getByLabel("Mobile (optional)")).toHaveValue(
      "07700 900999",
    );
    await expectNoAccessibilityProblems(page);
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
  });
});
