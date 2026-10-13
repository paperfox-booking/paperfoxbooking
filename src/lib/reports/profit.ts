/**
 * Profit and loss for an event, worked out from its bookings, payments and
 * costs. All amounts are whole pence.
 *
 * - Income is what everyone booked owes in total, plus money kept from
 *   cancelled bookings (deposits aren't refundable).
 * - Profit is income less costs. It's an estimate until everyone has paid
 *   and every cost is in.
 * - Cash so far is money received less costs already paid.
 */

export const COST_CATEGORIES = [
  "venue",
  "food",
  "goody_bags",
  "class_kits",
  "staff",
  "prizes",
  "printing",
  "travel",
  "other",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export const COST_CATEGORY_LABELS: Record<CostCategory, string> = {
  venue: "Venue and room hire",
  food: "Food and drink",
  goody_bags: "Goody bags",
  class_kits: "Class kits",
  staff: "Staff and helpers",
  prizes: "Prizes and gifts",
  printing: "Printing and post",
  travel: "Travel",
  other: "Other",
};

export function isCostCategory(value: unknown): value is CostCategory {
  return (
    typeof value === "string" &&
    (COST_CATEGORIES as readonly string[]).includes(value)
  );
}

export interface ProfitInput {
  capacity: number;
  bookings: readonly {
    pricePence: number;
    paidPence: number;
    cancelled: boolean;
  }[];
  costs: readonly {
    amountPence: number;
    paid: boolean;
    category: string;
  }[];
}

export interface Profit {
  placesSold: number;
  placesLeft: number;
  salesPence: number;
  keptFromCancelledPence: number;
  incomePence: number;
  receivedPence: number;
  owedPence: number;
  costsPence: number;
  costsPaidPence: number;
  costsUnpaidPence: number;
  profitPence: number;
  /** Profit as a percentage of income, to one decimal place. */
  marginPercent: number | null;
  cashPence: number;
  costsByCategory: { category: CostCategory; amountPence: number }[];
}

export function profitFor({ capacity, bookings, costs }: ProfitInput): Profit {
  const active = bookings.filter((booking) => !booking.cancelled);
  const cancelled = bookings.filter((booking) => booking.cancelled);
  const sum = (values: number[]) =>
    values.reduce((total, value) => total + value, 0);

  const salesPence = sum(active.map((booking) => booking.pricePence));
  const keptFromCancelledPence = sum(
    cancelled.map((booking) => booking.paidPence),
  );
  const incomePence = salesPence + keptFromCancelledPence;
  const receivedPence = sum(bookings.map((booking) => booking.paidPence));
  const owedPence = sum(
    active.map((booking) =>
      Math.max(booking.pricePence - booking.paidPence, 0),
    ),
  );
  const costsPence = sum(costs.map((cost) => cost.amountPence));
  const costsPaidPence = sum(
    costs.filter((cost) => cost.paid).map((cost) => cost.amountPence),
  );
  const profitPence = incomePence - costsPence;

  const byCategory = new Map<CostCategory, number>();
  for (const cost of costs) {
    const category = isCostCategory(cost.category) ? cost.category : "other";
    byCategory.set(
      category,
      (byCategory.get(category) ?? 0) + cost.amountPence,
    );
  }

  return {
    placesSold: active.length,
    placesLeft: Math.max(capacity - active.length, 0),
    salesPence,
    keptFromCancelledPence,
    incomePence,
    receivedPence,
    owedPence,
    costsPence,
    costsPaidPence,
    costsUnpaidPence: costsPence - costsPaidPence,
    profitPence,
    marginPercent:
      incomePence > 0
        ? Math.round((profitPence / incomePence) * 1000) / 10
        : null,
    cashPence: receivedPence - costsPaidPence,
    costsByCategory: COST_CATEGORIES.filter((category) =>
      byCategory.has(category),
    ).map((category) => ({ category, amountPence: byCategory.get(category)! })),
  };
}

/** Adds several events' figures together, for a totals row. */
export function addProfits(
  profits: readonly Profit[],
): Omit<Profit, "costsByCategory" | "placesLeft"> {
  const total = (pick: (profit: Profit) => number) =>
    profits.reduce((sum, profit) => sum + pick(profit), 0);
  const incomePence = total((profit) => profit.incomePence);
  const profitPence = total((profit) => profit.profitPence);
  return {
    placesSold: total((profit) => profit.placesSold),
    salesPence: total((profit) => profit.salesPence),
    keptFromCancelledPence: total((profit) => profit.keptFromCancelledPence),
    incomePence,
    receivedPence: total((profit) => profit.receivedPence),
    owedPence: total((profit) => profit.owedPence),
    costsPence: total((profit) => profit.costsPence),
    costsPaidPence: total((profit) => profit.costsPaidPence),
    costsUnpaidPence: total((profit) => profit.costsUnpaidPence),
    profitPence,
    marginPercent:
      incomePence > 0
        ? Math.round((profitPence / incomePence) * 1000) / 10
        : null,
    cashPence: total((profit) => profit.cashPence),
  };
}
