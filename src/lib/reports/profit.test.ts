import { describe, expect, it } from "vitest";
import { addProfits, profitFor } from "./profit";

const march = {
  capacity: 110,
  bookings: [
    { pricePence: 19500, paidPence: 6000, cancelled: false },
    { pricePence: 24500, paidPence: 24500, cancelled: false },
    { pricePence: 0, paidPence: 0, cancelled: false },
    // Cancelled, keeping the £60 deposit.
    { pricePence: 19500, paidPence: 6000, cancelled: true },
  ],
  costs: [
    { amountPence: 450000, paid: true, category: "venue" },
    { amountPence: 120050, paid: false, category: "food" },
    { amountPence: 30000, paid: true, category: "venue" },
  ],
};

describe("profitFor", () => {
  it("works out income, costs and profit", () => {
    expect(profitFor(march)).toEqual({
      placesSold: 3,
      placesLeft: 107,
      salesPence: 44000,
      keptFromCancelledPence: 6000,
      incomePence: 50000,
      receivedPence: 36500,
      owedPence: 13500,
      costsPence: 600050,
      costsPaidPence: 480000,
      costsUnpaidPence: 120050,
      profitPence: -550050,
      marginPercent: -1100.1,
      cashPence: -443500,
      costsByCategory: [
        { category: "venue", amountPence: 480000 },
        { category: "food", amountPence: 120050 },
      ],
    });
  });

  it("copes with an event that has nothing yet", () => {
    expect(profitFor({ capacity: 110, bookings: [], costs: [] })).toMatchObject(
      {
        incomePence: 0,
        profitPence: 0,
        marginPercent: null,
        placesLeft: 110,
      },
    );
  });

  it("gives a sensible margin for a typical weekend", () => {
    const bookings = Array.from({ length: 100 }, () => ({
      pricePence: 19500,
      paidPence: 19500,
      cancelled: false,
    }));
    const result = profitFor({
      capacity: 110,
      bookings,
      costs: [{ amountPence: 1200000, paid: true, category: "venue" }],
    });
    expect(result.incomePence).toBe(1950000);
    expect(result.profitPence).toBe(750000);
    expect(result.marginPercent).toBe(38.5);
  });
});

describe("addProfits", () => {
  it("totals several events", () => {
    const one = profitFor(march);
    const total = addProfits([one, one]);
    expect(total.incomePence).toBe(100000);
    expect(total.costsPence).toBe(1200100);
    expect(total.placesSold).toBe(6);
    expect(total.marginPercent).toBe(-1100.1);
  });
});
