import { describe, expect, it } from "vitest";
import {
  formatUkDate,
  formatUkDateTime,
  formatUkLongDate,
  formatUkTime,
  ukDateTimeToUtc,
} from "./dates";

describe("UK date formatting", () => {
  it("uses day/month/year", () => {
    expect(formatUkDate("2027-12-31T12:00:00Z")).toBe("31/12/2027");
  });

  it("shows GMT times unchanged in winter", () => {
    // 19 March 2027 is before the clocks go forward on 28 March 2027.
    expect(formatUkTime("2027-03-19T16:00:00Z")).toBe("16:00");
  });

  it("adds an hour for British Summer Time", () => {
    expect(formatUkTime("2027-06-18T15:00:00Z")).toBe("16:00");
  });

  it("uses the UK date, not the UTC date, around midnight in summer", () => {
    // 23:30 UTC on 30 June is 00:30 on 1 July in London.
    expect(formatUkDateTime("2027-06-30T23:30:00Z")).toBe("01/07/2027 00:30");
  });

  it("writes long dates for headings", () => {
    expect(formatUkLongDate("2027-03-19T16:00:00Z")).toBe(
      "Friday 19 March 2027",
    );
  });

  it("rejects invalid dates", () => {
    expect(() => formatUkDate("not a date")).toThrow(RangeError);
  });
});

describe("ukDateTimeToUtc", () => {
  it("converts winter times (GMT)", () => {
    expect(ukDateTimeToUtc("2027-03-19", "16:00").toISOString()).toBe(
      "2027-03-19T16:00:00.000Z",
    );
  });

  it("converts summer times (BST)", () => {
    expect(ukDateTimeToUtc("2027-06-18", "09:00").toISOString()).toBe(
      "2027-06-18T08:00:00.000Z",
    );
  });

  it("handles the day the clocks go back", () => {
    // 31 October 2027: 12:00 London is back on GMT.
    expect(ukDateTimeToUtc("2027-10-31", "12:00").toISOString()).toBe(
      "2027-10-31T12:00:00.000Z",
    );
  });

  it("round trips with the formatters", () => {
    const utc = ukDateTimeToUtc("2027-09-17", "09:00");
    expect(formatUkDate(utc)).toBe("17/09/2027");
    expect(formatUkTime(utc)).toBe("09:00");
  });

  it("rejects badly formed input", () => {
    expect(() => ukDateTimeToUtc("19/03/2027", "16:00")).toThrow(RangeError);
    expect(() => ukDateTimeToUtc("2027-03-19", "4pm")).toThrow(RangeError);
  });
});
