import { describe, expect, it } from "vitest";
import {
  monthAround,
  summarisePayments,
  type PaymentReportRow,
} from "./payments";

function row(partial: Partial<PaymentReportRow>): PaymentReportRow {
  return {
    id: Math.random().toString(36),
    kind: "payment",
    receivedOn: "2026-04-02",
    amountPence: 6000,
    method: "bank_transfer",
    note: "",
    bookingId: "b",
    reference: "PF-2027-0001",
    fullName: "Jo Smith",
    eventTitle: "Crop Weekend March 2027",
    ...partial,
  };
}

describe("summarisePayments", () => {
  it("adds up by method and by day", () => {
    const summary = summarisePayments([
      row({ amountPence: 6000, fullName: "Zoe" }),
      row({ amountPence: 8500, fullName: "Ann" }),
      row({ amountPence: 2000, method: "cash", receivedOn: "2026-04-01" }),
    ]);
    expect(summary.totalPence).toBe(16500);
    expect(summary.count).toBe(3);
    expect(summary.byMethod).toEqual([
      { method: "bank_transfer", totalPence: 14500, count: 2 },
      { method: "cash", totalPence: 2000, count: 1 },
    ]);
    expect(summary.byDay.map((day) => [day.date, day.totalPence])).toEqual([
      ["2026-04-01", 2000],
      ["2026-04-02", 14500],
    ]);
    expect(summary.byDay[1]?.rows.map((r) => r.fullName)).toEqual([
      "Ann",
      "Zoe",
    ]);
  });
});

describe("summarisePayments with refunds", () => {
  it("takes refunds off the total, but not off the methods' totals", () => {
    const summary = summarisePayments([
      row({ amountPence: 19500 }),
      row({ amountPence: 2000, method: "cash" }),
      row({ kind: "refund", amountPence: -13500, receivedOn: "2026-04-03" }),
    ]);
    expect(summary).toMatchObject({
      totalPence: 8000,
      receivedPence: 21500,
      refundedPence: 13500,
      count: 2,
      refundCount: 1,
    });
    expect(summary.byMethod).toEqual([
      { method: "bank_transfer", totalPence: 19500, count: 1 },
      { method: "cash", totalPence: 2000, count: 1 },
    ]);
    expect(summary.byDay.map((day) => [day.date, day.totalPence])).toEqual([
      ["2026-04-02", 21500],
      ["2026-04-03", -13500],
    ]);
  });
});

describe("monthAround", () => {
  it("gives the whole month, including February in a leap year", () => {
    expect(monthAround("2026-10-14")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(monthAround("2028-02-10")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });
});
