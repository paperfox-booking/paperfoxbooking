import { expect, test } from "@playwright/test";
import { expectNoAccessibilityProblems } from "./accessibility";

test.describe("public pages", () => {
  test("home page shows Paper Fox and what's coming", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Crafting weekends" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Upcoming events" }),
    ).toBeVisible();
    await expect(page.getByText("hello@paper-fox.co.uk").first()).toBeVisible();
    await expect(page.getByText("company number 13717760")).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });

  test("keyboard users can skip straight to the content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to main content" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("pages fit a 375px phone screen without sideways scrolling", async ({
    page,
  }) => {
    for (const path of ["/", "/sign-in", "/sign-in/team"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("unknown pages say so and link home", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });

  test("security headers are sent", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("the site can be installed on a phone's home screen", async ({
    request,
  }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.short_name).toBe("Paper Fox");
    expect(manifest.display).toBe("standalone");
  });
});

test.describe("sign-in page", () => {
  test("asks for an email address, with a label and no password", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
    await expectNoAccessibilityProblems(page);
  });

  test("explains what's wrong with a mistyped email", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill("jo.smith");
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText(/in the right format/)).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expectNoAccessibilityProblems(page);
  });

  test.describe("before the page's scripts have loaded", () => {
    test.use({ javaScriptEnabled: false });

    test("still checks the email and explains the problem", async ({
      page,
    }) => {
      await page.goto("/sign-in");
      await page.getByLabel("Email address").fill("jo.smith");
      await page.getByRole("button", { name: "Email me a code" }).click();
      await expect(page.getByText(/in the right format/)).toBeVisible();
    });
  });

  test("asks for an email when it's left empty", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Email me a code" }).click();
    await expect(page.getByText("Enter your email address")).toBeVisible();
  });
});

test.describe("private areas", () => {
  test("My account asks people to sign in first", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
    await expect(page.getByLabel("Email address")).toBeVisible();
  });

  test("the admin area sends people to the team sign-in page", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\/team\?next=%2Fadmin$/);
    await page.goto("/admin/password");
    await expect(page).toHaveURL(/\/sign-in\/team\?next=%2Fadmin%2Fpassword$/);
  });
});

test.describe("team sign-in page", () => {
  test("asks for an email and password, with labels", async ({ page }) => {
    await page.goto("/sign-in/team");
    await expect(
      page.getByRole("heading", { level: 1, name: "Team sign in" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
    await expectNoAccessibilityProblems(page);
  });

  test("explains what's missing", async ({ page }) => {
    await page.goto("/sign-in/team");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email address")).toBeVisible();
    await expect(page.getByText("Enter your password")).toBeVisible();
    await expectNoAccessibilityProblems(page);
  });

  test("is linked from the footer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Team sign in" }).click();
    await expect(page).toHaveURL(/\/sign-in\/team$/);
  });
});
