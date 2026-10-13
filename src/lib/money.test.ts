import { describe, expect, it } from "vitest";
import {
  formatPence,
  formatPrice,
  parsePoundsToPence,
  sumPence,
} from "./money";

describe("formatPence", () => {
  it("formats whole pounds with pence", () => {
    expect(formatPence(19500)).toBe("£195.00");
  });

  it("formats pence and thousands", () => {
    expect(formatPence(123456)).toBe("£1,234.56");
    expect(formatPence(5)).toBe("£0.05");
    expect(formatPence(0)).toBe("£0.00");
  });

  it("formats negative amounts", () => {
    expect(formatPence(-6000)).toBe("-£60.00");
  });

  it("rejects amounts that aren't whole pence", () => {
    expect(() => formatPence(19.5)).toThrow(TypeError);
    expect(() => formatPence(Number.NaN)).toThrow(TypeError);
  });
});

describe("formatPrice", () => {
  it("drops .00 for whole pounds", () => {
    expect(formatPrice(24500)).toBe("£245");
  });

  it("keeps pence when there are some", () => {
    expect(formatPrice(24550)).toBe("£245.50");
  });
});

describe("parsePoundsToPence", () => {
  it.each([
    ["195", 19500],
    ["195.5", 19550],
    ["195.50", 19550],
    ["£60", 6000],
    ["£1,234.56", 123456],
    ["  85  ", 8500],
    ["0.01", 1],
    ["0", 0],
  ])("parses %j as %i pence", (input, expected) => {
    expect(parsePoundsToPence(input)).toBe(expected);
  });

  it.each(["", "abc", "1.234", "-5", "£", "12.3.4", "1e3", "£ 5x"])(
    "rejects %j",
    (input) => {
      expect(parsePoundsToPence(input)).toBeNull();
    },
  );

  it("never loses a penny to floating point", () => {
    // 0.1 + 0.2 style errors: every pence value from 0.00 to 9.99 round trips.
    for (let pence = 0; pence < 1000; pence++) {
      const typed = `${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, "0")}`;
      expect(parsePoundsToPence(typed)).toBe(pence);
    }
  });
});

describe("sumPence", () => {
  it("adds whole pence", () => {
    expect(sumPence([6000, 13500])).toBe(19500);
    expect(sumPence([])).toBe(0);
  });

  it("rejects fractional pence", () => {
    expect(() => sumPence([100, 0.5])).toThrow(TypeError);
  });
});
