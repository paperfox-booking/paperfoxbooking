import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";
import { eventWithPeople } from "./data";
import { waitForEmail } from "./mailbox";
import { signInAsTeam, sql, visibleText } from "./team";

/**
 * Settings, the email wording, and sending emails to the local test mailbox.
 * Tagged @supabase because it needs the local Supabase stack (and Mailpit)
 * running. Everyone here is made up.
 */

function emailOf(name: string): string {
  return `${name.replace(/\s+/g, ".").toLowerCase()}@example.test`;
}

test.describe("emails @supabase", () => {
  test.beforeAll(async () => {
    // The emails need bank details. Test mode must be off, so emails go to
    // each person's own (made-up) address in the test mailbox.
    await sql(
      `update public.settings set bank_sort_code = '12-34-56', bank_account_number = '12345678',
         email_test_address = '', send_payment_emails = true`,
    );
  });

  test("an owner changes the settings", async ({ page }, testInfo) => {
    await signInAsTeam(page, testInfo.project.name, "owner", "/admin/settings");
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    await page.getByLabel("Sort code").fill("123");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(
      visibleText(page, "Enter the 6 digit sort code, like 12-34-56"),
    ).toBeVisible();

    await page.getByLabel("Sort code").fill("12 34 56");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(visibleText(page, "Settings saved.")).toBeVisible();
    await expect(page.getByLabel("Sort code")).toHaveValue("12-34-56");
  });

  test("admins can't open the settings, and door staff can't open emails", async ({
    page,
    browser,
  }, testInfo) => {
    await signInAsTeam(page, testInfo.project.name, "admin", "/admin/settings");
    await expect(visibleText(page, "You can't use this page")).toBeVisible();

    const door = await browser.newPage();
    await signInAsTeam(door, testInfo.project.name, "door", "/admin/emails");
    await expect(visibleText(door, "You can't use this page")).toBeVisible();
    await door.close();
  });

  test("an admin changes an email's wording and sees the preview", async ({
    page,
  }, testInfo) => {
    // Each screen size changes a different email, as they run side by side,
    // and neither is one the other tests check the wording of.
    const [key, name] =
      testInfo.project.name === "phone"
        ? ["B3", "B3: paid in full"]
        : ["thanks", "Thanks for your payment"];
    const [original] = await sql<{ body: string }>(
      "select body from public.email_templates where key = $1",
      [key],
    );
    await eventWithPeople();
    try {
      await signInAsTeam(page, testInfo.project.name, "admin", "/admin/emails");
      await expect(
        page.getByRole("heading", { level: 1, name: "Emails" }),
      ).toBeVisible();
      await expectNoAccessibilityProblems(page);

      await page.getByRole("link", { name }).click();
      const body = page.getByLabel("What it says");
      await body.fill(`${original!.body}\n\nSee you soon, {{frist_name}}!`);
      await page.getByRole("button", { name: "Save and preview" }).click();
      await expect(
        visibleText(page, "Saved. The preview shows the change."),
      ).toBeVisible();
      await expect(
        visibleText(page, /\{\{frist_name\}\} isn't a placeholder/),
      ).toBeVisible();
      await expect(
        page.frameLocator("iframe").getByText(/See you soon/),
      ).toBeVisible();
      await expectNoAccessibilityProblems(page);
    } finally {
      await sql("update public.email_templates set body = $2 where key = $1", [
        key,
        original!.body,
      ]);
    }
  });

  test("recording payments sends B2, then B3", async ({ page }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/events/${eventId}/people`,
    );
    const started = new Date();
    const pay = page.getByRole("textbox", {
      name: `Payment received today from ${people.zoe}`,
    });
    await pay.fill("60");
    await pay.press("Enter");
    await expect(
      visibleText(
        page,
        new RegExp(`B2: deposit received emailed to ${emailOf(people.zoe)}`),
      ),
    ).toBeVisible();
    const b2 = await waitForEmail(
      emailOf(people.zoe),
      /thank you for your payment/,
      started,
    );
    expect(b2.Text).toContain("Hello Zoe");
    expect(b2.Text).toContain("You have paid £60 of £195");
    expect(b2.Attachments.map((file) => file.FileName)).toEqual([
      expect.stringMatching(/^Confirmation - People Test/),
    ]);

    await pay.fill("135");
    await pay.press("Enter");
    await expect(
      visibleText(page, /B3: paid in full emailed to/),
    ).toBeVisible();
    await waitForEmail(
      emailOf(people.zoe),
      /thank you for your full payment/,
      started,
    );
  });

  test("an owner previews and sends B1 from a booking's page", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    const [booking] = await sql<{ id: string }>(
      `select b.id from public.bookings b join public.customers c on c.id = b.customer_id
       where b.event_id = $1 and c.full_name = $2`,
      [eventId, people.bea],
    );
    await signInAsTeam(
      page,
      testInfo.project.name,
      "owner",
      `/admin/bookings/${booking!.id}`,
    );
    await page.getByLabel("Email to send").selectOption("B1");
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(
      page.frameLocator("iframe").getByText(/Account number: 12345678/),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /^Booking details - People Test/ }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    // The attachment opens as a PDF.
    const pdf = await page.request.get(
      `/admin/bookings/${booking!.id}/documents/booking-details`,
    );
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const started = new Date();
    await page
      .getByRole("button", { name: "Send B1: booking received" })
      .click();
    await expect(visibleText(page, "Email sent.")).toBeVisible();
    const b1 = await waitForEmail(
      emailOf(people.bea),
      /we've received your booking/,
      started,
    );
    expect(b1.Text).toContain("Reference: PF-");
    expect(b1.Attachments.map((file) => file.FileName).sort()).toEqual([
      expect.stringMatching(/^Booking details - /),
      "Paper Fox terms and conditions.pdf",
    ]);
    await expect(
      page
        .getByRole("region", { name: "Emails sent" })
        .getByText(/Sent by the system/),
    ).toBeVisible();
  });

  test("an admin emails everyone who owes money on an event", async ({
    page,
  }, testInfo) => {
    const { eventId, people } = await eventWithPeople();
    await signInAsTeam(
      page,
      testInfo.project.name,
      "admin",
      `/admin/events/${eventId}/email`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Email people" }),
    ).toBeVisible();
    await page
      .getByLabel("Email", { exact: true })
      .selectOption("balance_reminder");
    await page.getByLabel(/^Everyone who still owes money/).check();
    // The team's free place owes nothing, so two people.
    await expect(
      visibleText(page, "2 people will get this email."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Preview the email" }).click();
    await expect(
      page.frameLocator("iframe").getByText(/your balance of £195/),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);

    const started = new Date();
    await page.getByLabel("I've checked the preview").check();
    await page.getByRole("button", { name: "Send to 2 people" }).click();
    await expect(visibleText(page, "Finished: 2 of 2 sent.")).toBeVisible();
    for (const name of [people.bea, people.zoe]) {
      await waitForEmail(emailOf(name), /your balance is due by/, started);
    }
  });
});
