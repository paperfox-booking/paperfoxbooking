import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatUkDate,
  formatUkDateRange,
  formatUkDateTime,
  formatUkFriendlyTime,
  formatUkLongDate,
  formatUkTime,
  isIsoDate,
  toUkDateInput,
  toUkTimeInput,
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

describe("form values", () => {
  it("gives the UK date and time of a moment", () => {
    expect(toUkDateInput("2027-06-30T23:30:00Z")).toBe("2027-07-01");
    expect(toUkTimeInput("2027-06-30T23:30:00Z")).toBe("00:30");
    expect(toUkTimeInput("2027-03-19T16:00:00Z")).toBe("16:00");
  });
});

describe("calendar dates", () => {
  it("adds and counts days, across months, years and leap days", () => {
    expect(addDays("2027-03-19", -42)).toBe("2027-02-05");
    expect(addDays("2027-12-31", 1)).toBe("2028-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2027-03-19", "2028-03-17")).toBe(364);
    expect(daysBetween("2027-06-18", "2027-03-19")).toBe(-91);
  });

  it("isn't thrown by the clocks changing", () => {
    // The clocks go forward on 28 March 2027.
    expect(addDays("2027-03-27", 1)).toBe("2027-03-28");
    expect(daysBetween("2027-03-27", "2027-03-29")).toBe(2);
  });

  it("knows real dates from impossible ones", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate("19/03/2027")).toBe(false);
    expect(() => addDays("2027-13-01", 1)).toThrow(RangeError);
  });
});

describe("formatUkDateRange", () => {
  it("writes a weekend in one month", () => {
    expect(
      formatUkDateRange("2027-03-19T09:00:00Z", "2027-03-21T17:00:00Z"),
    ).toBe("Friday 19 to Sunday 21 March 2027");
  });

  it("writes a weekend across two months", () => {
    expect(
      formatUkDateRange("2027-10-29T16:00:00Z", "2027-11-01T17:00:00Z"),
    ).toBe("Friday 29 October to Monday 1 November 2027");
  });

  it("writes a weekend across two years", () => {
    expect(
      formatUkDateRange("2027-12-31T09:00:00Z", "2028-01-02T17:00:00Z"),
    ).toBe("Friday 31 December 2027 to Sunday 2 January 2028");
  });

  it("writes a single day once", () => {
    expect(
      formatUkDateRange("2027-03-20T09:00:00Z", "2027-03-20T17:00:00Z"),
    ).toBe("Saturday 20 March 2027");
  });
});

describe("formatUkFriendlyTime", () => {
  it("writes times the way people say them", () => {
    expect(formatUkFriendlyTime("2027-03-19T16:00:00Z")).toBe("4pm");
    expect(formatUkFriendlyTime("2027-06-18T08:00:00Z")).toBe("9am");
    expect(formatUkFriendlyTime("2027-03-19T12:30:00Z")).toBe("12:30pm");
  });
});
