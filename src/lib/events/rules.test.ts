import { describe, expect, it } from "vitest";
import {
  availability,
  balanceAfterDeposit,
  defaultBalanceDueOn,
  lowestPrice,
  paymentPlan,
  suggestedCopyStart,
  suggestedCopyTitle,
} from "./rules";

const weekend = { pricePence: 19500, depositPence: 6000 };
const kickStarter = { pricePence: 24500, depositPence: 8500 };

describe("defaultBalanceDueOn", () => {
  it("is 6 weeks before the event starts", () => {
    // Friday 19 March 2027 → Friday 5 February 2027.
    expect(defaultBalanceDueOn("2027-03-19T09:00:00Z")).toBe("2027-02-05");
  });

  it("uses the UK date the event starts on", () => {
    // 00:30 on 1 July in London is still 30 June in UTC.
    expect(defaultBalanceDueOn("2027-06-30T23:30:00Z")).toBe("2027-05-20");
  });
});

describe("paymentPlan", () => {
  it("takes the deposit now and the rest by the due date", () => {
    expect(paymentPlan(weekend, "2027-01-26", "2026-03-30")).toEqual({
      kind: "deposit",
      payNowPence: 6000,
      balancePence: 13500,
      balanceDueOn: "2027-01-26",
    });
    expect(paymentPlan(kickStarter, "2027-01-26", "2027-01-25")).toEqual({
      kind: "deposit",
      payNowPence: 8500,
      balancePence: 16000,
      balanceDueOn: "2027-01-26",
    });
  });

  it("asks for the full price when booking on or after the due date", () => {
    for (const bookedOn of ["2027-01-26", "2027-03-01"]) {
      expect(paymentPlan(weekend, "2027-01-26", bookedOn)).toEqual({
        kind: "full",
        payNowPence: 19500,
        reason: "balance_already_due",
      });
    }
  });

  it("asks for the full price when there's no deposit", () => {
    expect(
      paymentPlan(
        { pricePence: 4500, depositPence: null },
        "2027-01-26",
        "2026-05-01",
      ),
    ).toEqual({ kind: "full", payNowPence: 4500, reason: "no_deposit" });
  });
});

describe("balanceAfterDeposit", () => {
  it("is the price less the deposit", () => {
    expect(balanceAfterDeposit(weekend)).toBe(13500);
    expect(balanceAfterDeposit(kickStarter)).toBe(16000);
    expect(balanceAfterDeposit({ pricePence: 4500, depositPence: null })).toBe(
      0,
    );
  });
});

describe("lowestPrice", () => {
  it("finds the starting price", () => {
    expect(lowestPrice([kickStarter, weekend])).toBe(19500);
    expect(lowestPrice([])).toBeNull();
  });
});

describe("copying suggestions", () => {
  it("suggests the same weekday a year on", () => {
    expect(suggestedCopyStart("2027-03-19T09:00:00Z")).toBe("2028-03-17");
  });

  it("moves the month and year in the title on", () => {
    expect(
      suggestedCopyTitle(
        "Coventry Crop Weekend March 2027",
        "2027-03-19T09:00:00Z",
        "2027-06-18",
      ),
    ).toBe("Coventry Crop Weekend June 2027");
    expect(
      suggestedCopyTitle(
        "Paper Fox Escape: November 2027",
        "2027-11-12T09:00:00Z",
        "2028-03-17",
      ),
    ).toBe("Paper Fox Escape: March 2028");
  });

  it("leaves titles without a month or year alone", () => {
    expect(
      suggestedCopyTitle("Spring crop", "2027-03-19T09:00:00Z", "2028-03-17"),
    ).toBe("Spring crop");
  });
});

describe("availability", () => {
  const event = {
    status: "published" as const,
    endsAt: "2027-03-21T17:00:00Z",
    bookingOpensAt: "2026-03-30T09:00:00Z",
    bookingClosesAt: "2027-03-12T23:59:00Z",
  };

  it("is open between booking opening and closing", () => {
    expect(availability(event, new Date("2026-06-01T12:00:00Z"))).toEqual({
      kind: "open",
    });
  });

  it("says when booking opens", () => {
    expect(availability(event, new Date("2026-03-01T12:00:00Z"))).toEqual({
      kind: "not_open_yet",
      opensAt: "2026-03-30T09:00:00Z",
    });
  });

  it("closes when booking closes, and finishes when the event ends", () => {
    expect(availability(event, new Date("2027-03-15T12:00:00Z")).kind).toBe(
      "closed",
    );
    expect(availability(event, new Date("2027-03-22T12:00:00Z")).kind).toBe(
      "finished",
    );
  });

  it("respects sold out and cancelled", () => {
    const now = new Date("2026-06-01T12:00:00Z");
    expect(availability({ ...event, status: "sold_out" }, now).kind).toBe(
      "sold_out",
    );
    expect(availability({ ...event, status: "cancelled" }, now).kind).toBe(
      "cancelled",
    );
  });
});
