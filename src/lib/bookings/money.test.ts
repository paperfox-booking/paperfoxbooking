import { describe, expect, it } from "vitest";
import { bookingMoney, sumPayments } from "./money";

const weekend = {
  pricePence: 19500,
  depositPence: 6000,
  paidPence: 0,
  cancelled: false,
  balanceDueOn: "2027-01-26",
};
const today = "2026-10-14";

describe("bookingMoney", () => {
  it("knows nothing has been paid", () => {
    expect(bookingMoney(weekend, today)).toEqual({
      state: "unpaid",
      balancePence: 19500,
      depositOwedPence: 6000,
      overdue: false,
    });
  });

  it("counts part of a deposit", () => {
    expect(bookingMoney({ ...weekend, paidPence: 2000 }, today)).toMatchObject({
      state: "part_paid",
      balancePence: 17500,
      depositOwedPence: 4000,
    });
  });

  it("knows when the deposit is paid, including in parts", () => {
    expect(bookingMoney({ ...weekend, paidPence: 6000 }, today)).toMatchObject({
      state: "deposit_paid",
      balancePence: 13500,
      depositOwedPence: 0,
    });
    // Payments of £65 and £100, as on the March 2027 spreadsheet.
    expect(bookingMoney({ ...weekend, paidPence: 16500 }, today)).toMatchObject(
      {
        state: "deposit_paid",
        balancePence: 3000,
      },
    );
  });

  it("knows when it's paid in full, or overpaid", () => {
    expect(bookingMoney({ ...weekend, paidPence: 19500 }, today)).toMatchObject(
      {
        state: "paid",
        balancePence: 0,
      },
    );
    expect(bookingMoney({ ...weekend, paidPence: 20000 }, today)).toMatchObject(
      {
        state: "paid",
        balancePence: -500,
      },
    );
  });

  it("treats a £0 place as free", () => {
    expect(
      bookingMoney({ ...weekend, pricePence: 0, depositPence: null }, today),
    ).toMatchObject({ state: "free", balancePence: 0, overdue: false });
  });

  it("asks for the full price when there's no deposit", () => {
    expect(
      bookingMoney({ ...weekend, depositPence: null, paidPence: 6000 }, today),
    ).toMatchObject({ state: "part_paid", depositOwedPence: 13500 });
  });

  it("is overdue only after the balance due date", () => {
    const owing = { ...weekend, paidPence: 6000 };
    expect(bookingMoney(owing, "2027-01-26").overdue).toBe(false);
    expect(bookingMoney(owing, "2027-01-27").overdue).toBe(true);
    expect(
      bookingMoney({ ...owing, paidPence: 19500 }, "2027-01-27").overdue,
    ).toBe(false);
  });

  it("ignores money on cancelled bookings for chasing", () => {
    expect(
      bookingMoney({ ...weekend, cancelled: true }, "2027-02-01"),
    ).toMatchObject({ state: "cancelled", overdue: false });
  });
});

describe("sumPayments", () => {
  it("adds up payments, leaving out removed ones", () => {
    expect(
      sumPayments([
        { amount_pence: 6000, deleted_at: null },
        { amount_pence: 6000, deleted_at: "2026-10-01T10:00:00Z" },
        { amount_pence: 13500, deleted_at: null },
      ]),
    ).toBe(19500);
  });
});
