import { daysBetween } from "@/lib/dates";

/**
 * What a booking has paid and still owes, worked out from its payments every
 * time (never typed in), so the figures can't drift apart the way a
 * spreadsheet's can. All amounts are whole pence.
 */

export type PaymentState =
  "cancelled" | "free" | "paid" | "deposit_paid" | "part_paid" | "unpaid";

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  cancelled: "Cancelled",
  free: "Free place",
  paid: "Paid in full",
  deposit_paid: "Deposit paid",
  part_paid: "Part paid",
  unpaid: "Nothing paid yet",
};

export interface BookingMoneyInput {
  pricePence: number;
  depositPence: number | null;
  paidPence: number;
  cancelled: boolean;
  /** The event's balance due date, "YYYY-MM-DD". */
  balanceDueOn: string;
}

export interface BookingMoney {
  state: PaymentState;
  /** Still to pay. Negative means they've paid too much. */
  balancePence: number;
  /** Still to pay towards the deposit (or the full price, if no deposit). */
  depositOwedPence: number;
  /** Money is owed and the balance due date has passed. */
  overdue: boolean;
}

export function bookingMoney(
  booking: BookingMoneyInput,
  today: string,
): BookingMoney {
  const { pricePence, depositPence, paidPence, cancelled } = booking;
  const balancePence = pricePence - paidPence;
  const depositTarget = depositPence ?? pricePence;

  let state: PaymentState;
  if (cancelled) state = "cancelled";
  else if (pricePence === 0) state = "free";
  else if (paidPence >= pricePence) state = "paid";
  else if (depositPence !== null && paidPence >= depositPence) {
    state = "deposit_paid";
  } else if (paidPence > 0) state = "part_paid";
  else state = "unpaid";

  return {
    state,
    balancePence,
    depositOwedPence: Math.max(depositTarget - paidPence, 0),
    overdue:
      !cancelled &&
      balancePence > 0 &&
      daysBetween(booking.balanceDueOn, today) > 0,
  };
}

/** Adds up the payments that haven't been removed. */
export function sumPayments(
  payments: readonly { amount_pence: number; deleted_at: string | null }[],
): number {
  return payments.reduce(
    (total, payment) =>
      payment.deleted_at ? total : total + payment.amount_pence,
    0,
  );
}
