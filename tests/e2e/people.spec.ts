import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { signInAsTeam, uniqueSuffix, visibleText } from "./team";

/**
 * The spreadsheet-style list of people booked on an event. Tagged @supabase
 * because it needs the local Supabase stack running. Everyone here is made up.
 */

test.describe("people booked on an event @supabase", () => {
  test("an owner types into the list, records a payment and adds someone", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}/people`,
    );

    await expect(
      page.getByRole("heading", { level: 1, name: "People booked" }),
    ).toBeVisible();
    await expect(visibleText(page, "3 of 110")).toBeVisible();

    // The team first, then everyone else by name.
    const names = await page
      .getByRole("textbox", { name: /^Name for / })
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
    expect(names).toEqual([people.team, people.bea, people.zoe]);
    await expectNoAccessibilityProblems(page);
    // The list scrolls sideways inside its box; the page itself never does.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Type a mobile number and press Enter: it saves.
    const mobile = page.getByRole("textbox", {
      name: `Mobile for ${people.zoe}`,
    });
    await mobile.fill("07700 900123");
    await mobile.press("Enter");
    await expect(
      visibleText(page, `Saved mobile for ${people.zoe}.`),
    ).toBeVisible();

    // A bad email is explained and not saved.
    const email = page.getByRole("textbox", {
      name: `Email for ${people.bea}`,
    });
    await email.fill("not an email");
    await email.press("Tab");
    await expect(
      visibleText(page, /Enter an email address in the right format/).first(),
    ).toBeVisible();
    await expect(email).toHaveAttribute("aria-invalid", "true");

    // Record a £60 deposit.
    await page
      .getByRole("button", { name: `Add payment for ${people.zoe}` })
      .click();
    const dialog = page.getByRole("dialog", {
      name: `Record a payment from ${people.zoe}`,
    });
    await expect(dialog.getByLabel("Amount received")).toHaveValue("60");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(
      visibleText(
        page,
        `Payment recorded for ${people.zoe}. They've now paid £60.`,
      ),
    ).toBeVisible();

    // The quickest way: type a bank transfer into Pay and press Enter.
    const pay = page.getByRole("textbox", {
      name: `Payment received today from ${people.bea}`,
    });
    await pay.fill("75");
    await pay.press("Enter");
    await expect(
      visibleText(
        page,
        `Recorded £75 from ${people.bea}. They've now paid £75.`,
      ),
    ).toBeVisible();
    await expect(pay).toHaveValue("");

    // Add someone new.
    const newcomer = `Cy Newcomer ${uniqueSuffix()}`;
    await page.getByLabel("Name", { exact: true }).fill(newcomer);
    await page.getByRole("button", { name: "Add to this event" }).click();
    await expect(
      visibleText(page, new RegExp(`Added ${newcomer}`)),
    ).toBeVisible();
    await expect(visibleText(page, "4 of 110")).toBeVisible();

    // Everything was saved: it's all still there after reloading.
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: `Mobile for ${people.zoe}` }),
    ).toHaveValue("07700 900123");
    await expect(
      page.getByRole("textbox", { name: `Name for ${newcomer}` }),
    ).toBeVisible();
    await expect(visibleText(page, "Received: £135")).toBeVisible();

    const csv = await page.request.get(
      `/admin/events/${eventId}/people/export`,
    );
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const text = await csv.text();
    expect(text).toContain("Reference,Name,Team,Email");
    expect(text).toContain(people.zoe);
  });

  test("door staff see who's booked, but not money, and can't change anything", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "door",
      `/admin/events/${eventId}/people`,
    );

    await expect(visibleText(page, people.zoe, { exact: true })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Total due" }),
    ).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: /^Name for / })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Add to this event" }),
    ).toHaveCount(0);
    await expectNoAccessibilityProblems(page);

    const csv = await page.request.get(
      `/admin/events/${eventId}/people/export`,
    );
    expect(await csv.text()).not.toContain("Total due");
  });
});
