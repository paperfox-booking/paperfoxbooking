import { describe, expect, it } from "vitest";
import { matchStatement, type MatchBooking } from "./match";
import {
  StatementError,
  parseCsv,
  parseStatementAmount,
  parseStatementDate,
  readStatement,
} from "./statement";

describe("parseCsv", () => {
  it("handles quotes, commas and new lines inside quotes", () => {
    expect(parseCsv('a,"b, c","d ""e"""\r\n\n1,"2\n3",4\n\n')).toEqual([
      ["a", "b, c", 'd "e"'],
      [""],
      ["1", "2\n3", "4"],
    ]);
  });
});

describe("statement dates and amounts", () => {
  it("reads UK bank dates", () => {
    expect(parseStatementDate("02/04/2026")).toBe("2026-04-02");
    expect(parseStatementDate("2-4-26")).toBe("2026-04-02");
    expect(parseStatementDate("2026-04-02")).toBe("2026-04-02");
    expect(parseStatementDate("02 Apr 2026")).toBe("2026-04-02");
    expect(parseStatementDate("31/02/2026")).toBeNull();
    expect(parseStatementDate("Opening balance")).toBeNull();
  });

  it("reads amounts in pence, with signs", () => {
    expect(parseStatementAmount("£1,234.5")).toBe(123450);
    expect(parseStatementAmount("60")).toBe(6000);
    expect(parseStatementAmount("-60.00")).toBe(-6000);
    expect(parseStatementAmount("(60.00)")).toBe(-6000);
    expect(parseStatementAmount("60.00 CR")).toBe(6000);
    expect(parseStatementAmount("60.00DR")).toBe(-6000);
    expect(parseStatementAmount("")).toBeNull();
    expect(parseStatementAmount("sixty")).toBeNull();
  });
});

describe("readStatement", () => {
  it("keeps money paid in, from a statement with paid in and paid out columns", () => {
    const csv = [
      "Account,12345678",
      "",
      "Date,Type,Description,Paid out,Paid in,Balance",
      "02/04/2026,FPI,J SMITH MARCH27,,60.00,1060.00",
      "03/04/2026,DD,ELECTRIC CO,45.00,,1015.00",
      '04/04/2026,FPI,"PF-2027-0002, BEA",,"1,000.00",2015.00',
    ].join("\n");
    expect(readStatement(csv)).toEqual([
      {
        row: 4,
        date: "2026-04-02",
        description: "FPI J SMITH MARCH27",
        amountPence: 6000,
      },
      {
        row: 6,
        date: "2026-04-04",
        description: "FPI PF-2027-0002, BEA",
        amountPence: 100000,
      },
    ]);
  });

  it("works with one signed amount column", () => {
    const csv =
      "Date,Description,Amount\n2026-04-02,Z CRAFTER,85\n2026-04-03,SHOP,-12.50";
    expect(readStatement(csv)).toEqual([
      {
        row: 2,
        date: "2026-04-02",
        description: "Z CRAFTER",
        amountPence: 8500,
      },
    ]);
  });

  it("explains a file that isn't a statement", () => {
    expect(() => readStatement("Name,Email\nJo,jo@example.test")).toThrow(
      StatementError,
    );
  });
});

function booking(
  reference: string,
  fullName: string,
  partial: Partial<MatchBooking> = {},
): MatchBooking {
  return {
    bookingId: reference,
    reference,
    fullName,
    eventTitle: "Crop Weekend March 2027",
    depositOwedPence: 6000,
    balancePence: 19500,
    payments: [],
    ...partial,
  };
}

const bookings = [
  booking("PF-2027-0001", "Jo Smith"),
  booking("PF-2027-0002", "Bea Scrapper"),
  booking("PF-2027-0003", "Ann Smith"),
  booking("PF-2027-0004", "Mary O'Brien-Jones"),
];

function line(description: string, amountPence = 6000, date = "2026-04-02") {
  return { row: 2, date, description, amountPence };
}

describe("matchStatement", () => {
  it("is sure of a booking reference, however it's written", () => {
    const [first, second] = matchStatement(
      [line("PF 2027 0002 thanks"), line("pf20270003")],
      bookings,
    );
    expect(first?.suggested).toBe("PF-2027-0002");
    expect(first?.candidates[0]?.why).toBe("Reference PF-2027-0002");
    expect(second?.suggested).toBe("PF-2027-0003");
  });

  it("matches names, preferring the first name over an initial", () => {
    const [jo] = matchStatement([line("JO SMITH MARCH27")], bookings);
    expect(jo?.suggested).toBe("PF-2027-0001");
    expect(jo?.candidates.map((candidate) => candidate.bookingId)).toEqual([
      "PF-2027-0001",
      "PF-2027-0003",
    ]);
  });

  it("doesn't guess between two people with the same surname and no first name", () => {
    const [match] = matchStatement([line("SMITH MARCH")], bookings);
    expect(match?.suggested).toBeNull();
    expect(match?.candidates).toHaveLength(2);
  });

  it("uses the amount owed to choose by initial and surname", () => {
    const [match] = matchStatement(
      [line("J SMITH", 6000)],
      [booking("PF-2027-0001", "Jo Smith")],
    );
    expect(match?.candidates[0]).toMatchObject({
      score: 70,
      why: "Matches surname, initial, amount owed",
    });
    expect(match?.suggested).toBe("PF-2027-0001");
  });

  it("matches double-barrelled and apostrophe surnames", () => {
    const [match] = matchStatement([line("M OBRIEN JONES")], bookings);
    expect(match?.candidates[0]?.bookingId).toBe("PF-2027-0004");
  });

  it("spots a payment that's already been recorded", () => {
    const [match] = matchStatement(
      [line("PF-2027-0001")],
      [
        booking("PF-2027-0001", "Jo Smith", {
          payments: [{ amountPence: 6000, receivedOn: "2026-04-02" }],
        }),
      ],
    );
    expect(match?.alreadyRecorded).toBe(true);
  });

  it("leaves lines it can't match for staff to choose", () => {
    const [match] = matchStatement([line("ELECTRIC CO REFUND")], bookings);
    expect(match).toMatchObject({ candidates: [], suggested: null });
  });
});
