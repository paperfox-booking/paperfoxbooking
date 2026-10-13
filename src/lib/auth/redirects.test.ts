import { describe, expect, it } from "vitest";
import { safeNextPath, signInPath } from "./redirects";

describe("safeNextPath", () => {
  it("allows paths on this site", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/account?tab=details#top")).toBe(
      "/account?tab=details#top",
    );
  });

  it("falls back when there's nothing to go back to", () => {
    expect(safeNextPath(null)).toBe("/account");
    expect(safeNextPath(undefined, "/admin")).toBe("/admin");
    expect(safeNextPath("")).toBe("/account");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "evil.example",
    "javascript:alert(1)",
  ])("refuses to send people to %j", (next) => {
    expect(safeNextPath(next)).toBe("/account");
  });
});

describe("signInPath", () => {
  it("sends customers to the emailed-code sign-in, remembering where to go back to", () => {
    expect(signInPath("/account")).toBe("/sign-in?next=%2Faccount");
  });

  it("sends the admin area to the team sign-in page", () => {
    expect(signInPath("/admin")).toBe("/sign-in/team?next=%2Fadmin");
    expect(signInPath("/admin/password")).toBe(
      "/sign-in/team?next=%2Fadmin%2Fpassword",
    );
  });

  it("doesn't treat look-alike paths as the admin area", () => {
    expect(signInPath("/administrator")).toBe("/sign-in?next=%2Fadministrator");
  });

  it("drops unsafe return paths", () => {
    expect(signInPath("https://evil.example")).toBe("/sign-in");
  });
});
