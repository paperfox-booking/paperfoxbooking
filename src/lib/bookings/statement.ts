import { PAYMENT_METHOD_LABELS } from "@/lib/validation/bookings";

/**
 * The lines of a booking's statement: every payment and refund that hasn't
 * been removed, oldest first. Notes are left out, as they can hold bank
 * statement wording. Safe to use in the browser and on the server.
 */

export interface StatementLine {
  /** "YYYY-MM-DD", or null for money brought over from the spreadsheet. */
  date: string | null;
  description: string;
  /** Below zero for a refund. */
  amountPence: number;
}

interface Row {
  amount_pence: number;
  method: string;
  deleted_at: string | null;
  created_at: string;
}

function method(value: string): string {
  return (PAYMENT_METHOD_LABELS[value] ?? "other").toLowerCase();
}

export function statementLines(
  payments: readonly (Row & { received_on: string | null })[],
  refunds: readonly (Row & { refunded_on: string })[],
): StatementLine[] {
  const lines = [
    ...payments
      .filter((payment) => !payment.deleted_at)
      .map((payment) => ({
        date: payment.received_on,
        description:
          payment.received_on === null
            ? "Paid before the booking system started"
            : `Payment by ${method(payment.method)}`,
        amountPence: payment.amount_pence,
        order: payment.created_at,
      })),
    ...refunds
      .filter((refund) => !refund.deleted_at)
      .map((refund) => ({
        date: refund.refunded_on,
        description: `Refund by ${method(refund.method)}`,
        amountPence: -refund.amount_pence,
        order: refund.created_at,
      })),
  ];
  return lines
    .sort(
      (a, b) =>
        // Undated money from the spreadsheet comes first.
        Number(a.date !== null) - Number(b.date !== null) ||
        (a.date ?? "").localeCompare(b.date ?? "") ||
        a.order.localeCompare(b.order),
    )
    .map(({ date, description, amountPence }) => ({
      date,
      description,
      amountPence,
    }));
}
