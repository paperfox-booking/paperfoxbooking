import { describe, expect, it } from "vitest";
import {
  readBookingSheet,
  SheetLayoutError,
  type Cell,
  type SheetOption,
} from "./booking-sheet";

const options: SheetOption[] = [
  {
    id: "weekend",
    name: "Weekend (4pm start)",
    pricePence: 19500,
    startTime: "16:00",
  },
  {
    id: "kick",
    name: "Friday Kick Starter (9am start)",
    pricePence: 24500,
    startTime: "09:00",
  },
];

// Made-up people in the same layout as Paper Fox's March 2027 spreadsheet.
const header: Cell[] = [
  "Name - 19th - 21st March \r\nMain Room Max 78 (prefer 74)",
  "Email",
  "Friday Cropping",
  "Room 2",
  "Dietary/Health",
  "Total Due",
  "Money Received",
  "Balance Due",
  "Mobile",
  "Emergency Contact",
  "Notes",
  "Booking Sent",
];

function row(values: Partial<Record<number, Cell>>): Cell[] {
  return Array.from({ length: 12 }, (_, index) => values[index] ?? null);
}

const today = "2026-10-14";

describe("readBookingSheet", () => {
  it("reads a typical row", () => {
    const report = readBookingSheet(
      [
        header,
        row({
          0: "Ada Example",
          1: " Ada@Example.test ",
          2: "9am",
          4: "Vegetarian",
          5: 245,
          6: 85,
          7: 160,
          8: "07700  900123 ",
          9: "Bob Example (husband) 07700 900456",
          10: "Sit with Cy",
          11: "22/03 - B2",
        }),
      ],
      options,
      today,
    );
    expect(report.people).toEqual([
      {
        rowNumber: 2,
        fullName: "Ada Example",
        isTeam: false,
        email: "ada@example.test",
        optionId: "kick",
        optionName: "Friday Kick Starter (9am start)",
        room: "Main room",
        dietaryHealth: "Vegetarian",
        pricePence: 24500,
        priceNote: "",
        receivedPence: 8500,
        phone: "07700 900123",
        emergencyContact: "Bob Example (husband) 07700 900456",
        notes: "Sit with Cy",
        lastEmail: { template: "B2", sentOn: "2026-03-22", note: "" },
        warnings: [],
      },
    ]);
    expect(report.rooms).toEqual([{ name: "Main room", capacity: 78 }]);
  });

  it("puts team rows marked AA first-class, without the AA", () => {
    const [person] = readBookingSheet(
      [header, row({ 0: " AA Team Helper", 2: "N/A", 5: 0, 6: 0, 7: 0 })],
      options,
      today,
    ).people;
    expect(person).toMatchObject({
      fullName: "Team Helper",
      isTeam: true,
      optionId: null,
      pricePence: 0,
      warnings: [],
    });
  });

  it("tidies room names and lists every room", () => {
    const report = readBookingSheet(
      [
        header,
        row({ 0: "A", 2: "4pm", 3: "2ND ROOM B", 5: 195, 6: 60, 7: 135 }),
        row({ 0: "B", 2: "4PM", 3: "WELSH", 5: 195, 6: 60, 7: 135 }),
        row({ 0: "C", 2: "4pm", 3: " ", 5: 195, 6: 60, 7: 135 }),
      ],
      options,
      today,
    );
    expect(report.people.map((person) => person.room)).toEqual([
      "2nd Room B",
      "Welsh",
      "Main room",
    ]);
    expect(report.rooms.map((room) => room.name)).toEqual([
      "Main room",
      "2nd Room B",
      "Welsh",
    ]);
  });

  it("chooses the option from the price when the start time is unclear", () => {
    const report = readBookingSheet(
      [
        header,
        row({ 0: "A", 2: "TBA", 5: 245, 6: 85, 7: 160 }),
        row({ 0: "B", 5: 195, 6: 60, 7: 135 }),
        row({ 0: "C", 2: "YES", 5: 300, 6: 60, 7: 240 }),
      ],
      options,
      today,
    );
    const [a, b, c] = report.people;
    expect(a).toMatchObject({ optionId: "kick" });
    expect(a!.warnings).toEqual([
      'The start time was "TBA", so Friday Kick Starter (9am start) was chosen from the price.',
    ]);
    expect(b!.warnings).toEqual([
      "No start time was given, so Weekend (4pm start) was chosen from the price.",
    ]);
    expect(c).toMatchObject({ optionId: null });
    expect(c!.warnings).toEqual([
      "We couldn't tell which option this is. Choose one after importing.",
    ]);
  });

  it("keeps a price that doesn't match the option, and says so", () => {
    const [person] = readBookingSheet(
      [header, row({ 0: "A", 2: "9AM", 5: 195, 6: 60, 7: 135 })],
      options,
      today,
    ).people;
    expect(person).toMatchObject({
      optionId: "kick",
      pricePence: 19500,
      priceNote: "Price brought over from the spreadsheet.",
    });
    expect(person!.warnings).toEqual([
      "Charged £195, but Friday Kick Starter (9am start) is £245. The spreadsheet's £195 is kept.",
    ]);
  });

  it("works out the balance itself, and flags rows where the sheet was wrong", () => {
    const report = readBookingSheet(
      [
        header,
        row({ 0: "No formula", 2: "4pm", 5: 195, 6: 60 }),
        row({ 0: "Typed nought", 2: "9am", 5: 245, 6: 85, 7: 0 }),
        row({ 0: "Paid in full", 2: "4pm", 5: 195, 6: 195 }),
      ],
      options,
      today,
    );
    expect(report.people.map((person) => person.warnings)).toEqual([
      [
        "The spreadsheet had no balance for this row. The system works it out as £135.",
      ],
      [
        "The spreadsheet's balance was £0, but £245 less £85 paid leaves £160. The system uses £160.",
      ],
      [],
    ]);
  });

  it("checks the totals row, then stops", () => {
    const report = readBookingSheet(
      [
        header,
        row({ 0: "A", 2: "4pm", 5: 195, 6: 60, 7: 135 }),
        row({ 0: "B", 2: "9am", 5: 245, 6: 85 }),
        row({ 4: "Totals", 5: 440, 6: 145, 7: 135 }),
        row({}),
        row({ 0: "Waiting list for each event" }),
        row({ 0: "Someone Waiting" }),
      ],
      options,
      today,
    );
    expect(report.people).toHaveLength(2);
    expect(report.totals).toEqual({
      duePence: 44000,
      receivedPence: 14500,
      owedPence: 29500,
    });
    expect(report.notes).toEqual([
      "The spreadsheet's Balance Due total is £135, but the rows add up to £295. The system uses each row's own figures.",
    ]);
    expect(report.skipped.map((skip) => skip.rowNumber)).toEqual([6, 7]);
    expect(report.skipped[0]!.reason).toMatch(/Below the totals/);
  });

  it("flags two people in one row, bad emails and repeated emails", () => {
    const report = readBookingSheet(
      [
        header,
        row({ 0: "Jo & Sam", 1: "jo@example", 2: "4pm", 5: 195, 6: 0, 7: 195 }),
        row({
          0: "Kim",
          1: "kim@example.test",
          2: "4pm",
          5: 195,
          6: 0,
          7: 195,
        }),
        row({
          0: "Lee",
          1: "KIM@example.test",
          2: "4pm",
          5: 195,
          6: 0,
          7: 195,
        }),
      ],
      options,
      today,
    );
    const [jo, kim, lee] = report.people;
    expect(jo!.warnings).toEqual([
      "This row has two names. It's imported as one place: if it's two places, add the second person afterwards.",
      '"jo@example" doesn\'t look like an email address, so it was left out.',
    ]);
    expect(jo!.email).toBeNull();
    expect(kim!.email).toBe("kim@example.test");
    expect(lee!.email).toBeNull();
    expect(lee!.warnings).toEqual([
      "Same email as row 3. Each person needs their own email address, so this one was left out.",
    ]);
  });

  it("reads which email was sent last, working out the year", () => {
    const report = readBookingSheet(
      [
        header,
        row({ 0: "A", 2: "4pm", 5: 195, 6: 195, 7: 0, 11: "29/03 - b3" }),
        row({
          0: "B",
          2: "4pm",
          5: 195,
          6: 195,
          7: 0,
          11: "01/10 - Thkd for Pmt",
        }),
        row({ 0: "C", 2: "4pm", 5: 195, 6: 60, 7: 135, 11: "20/11 - B1" }),
        row({ 0: "D", 2: "4pm", 5: 195, 6: 60, 7: 135, 11: "Phoned" }),
      ],
      options,
      today,
    );
    expect(report.people.map((person) => person.lastEmail)).toEqual([
      { template: "B3", sentOn: "2026-03-29", note: "" },
      { template: "thanks", sentOn: "2026-10-01", note: "" },
      // 20 November hasn't happened yet this year, so it was last year's.
      { template: "B1", sentOn: "2025-11-20", note: "" },
      { template: "other", sentOn: null, note: "Phoned" },
    ]);
  });

  it("explains when it can't find the headings", () => {
    expect(() =>
      readBookingSheet([["Just some text"], ["More"]], options, today),
    ).toThrow(SheetLayoutError);
  });
});
