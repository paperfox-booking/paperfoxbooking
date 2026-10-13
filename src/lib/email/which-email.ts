import type { PaymentState } from "@/lib/bookings/money";

export type PaymentEmail = "B2" | "B3" | "thanks";

/**
 * Which email to send when a payment is recorded, from the booking's payment
 * state before and after it:
 *   - paid in full now (deposit and balance together, or the balance): B3;
 *   - the deposit is now covered: B2;
 *   - any other payment, such as a part payment: a thank you;
 *   - cancelled bookings and free places: nothing.
 */
export function emailAfterPayment(
  before: PaymentState,
  after: PaymentState,
): PaymentEmail | null {
  if (after === "cancelled" || after === "free") return null;
  if (after === "paid" && before !== "paid") return "B3";
  if (
    after === "deposit_paid" &&
    (before === "unpaid" || before === "part_paid")
  ) {
    return "B2";
  }
  return "thanks";
}
