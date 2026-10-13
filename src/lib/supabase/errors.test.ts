import { describe, expect, it } from "vitest";
import { friendlyDatabaseError } from "./errors";

describe("friendlyDatabaseError", () => {
  it("shows the database's own plain English rules as they are", () => {
    expect(
      friendlyDatabaseError({
        code: "P0001",
        message: "Only draft events can be deleted.",
      }),
    ).toBe("Only draft events can be deleted.");
  });

  it("explains a missing permission", () => {
    expect(friendlyDatabaseError({ code: "42501", message: "x" })).toMatch(
      /don't have permission/,
    );
  });

  it("never shows technical messages", () => {
    expect(
      friendlyDatabaseError({
        code: "23514",
        message: 'new row violates check constraint "events_capacity_range"',
      }),
    ).toBe("Something went wrong saving that. Please try again in a minute.");
    expect(friendlyDatabaseError(null, "Couldn't save.")).toBe(
      "Couldn't save.",
    );
  });
});
