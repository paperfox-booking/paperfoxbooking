/**
 * Payments and refunds by date, for checking against the bank statement (and
 * Stripe later). Safe to use in the browser and on the server.
 */

export interface PaymentReportRow {
  id: string;
  /** Money in, or money paid back (whose amount is negative). */
  kind: "payment" | "refund";
  /** "YYYY-MM-DD": the day it arrived, or was paid back. */
  receivedOn: string;
  amountPence: number;
  method: string;
  note: string;
  bookingId: string;
  reference: string;
  fullName: string;
  eventTitle: string;
}

export interface PaymentSummary {
  /** Money in, less refunds. */
  totalPence: number;
  /** Payments only. */
  count: number;
  /** Money in, before refunds. */
  receivedPence: number;
  /** Refunds, as a positive amount. */
  refundedPence: number;
  refundCount: number;
  /** Payments only, by how they were paid. */
  byMethod: { method: string; totalPence: number; count: number }[];
  byDay: { date: string; totalPence: number; rows: PaymentReportRow[] }[];
}

export function summarisePayments(
  rows: readonly PaymentReportRow[],
): PaymentSummary {
  const methods = new Map<string, { totalPence: number; count: number }>();
  const days = new Map<string, PaymentReportRow[]>();
  let receivedPence = 0;
  let refundedPence = 0;
  let refundCount = 0;
  for (const row of rows) {
    days.set(row.receivedOn, [...(days.get(row.receivedOn) ?? []), row]);
    if (row.kind === "refund") {
      refundedPence -= row.amountPence;
      refundCount += 1;
      continue;
    }
    receivedPence += row.amountPence;
    const method = methods.get(row.method) ?? { totalPence: 0, count: 0 };
    method.totalPence += row.amountPence;
    method.count += 1;
    methods.set(row.method, method);
  }
  return {
    totalPence: receivedPence - refundedPence,
    count: rows.length - refundCount,
    receivedPence,
    refundedPence,
    refundCount,
    byMethod: [...methods.entries()]
      .map(([method, totals]) => ({ method, ...totals }))
      .sort((a, b) => b.totalPence - a.totalPence),
    byDay: [...days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayRows]) => ({
        date,
        totalPence: dayRows.reduce((sum, row) => sum + row.amountPence, 0),
        rows: [...dayRows].sort((a, b) =>
          a.fullName.localeCompare(b.fullName, "en-GB"),
        ),
      })),
  };
}

/** The first and last day of the UK month a date is in. */
export function monthAround(date: string): { from: string; to: string } {
  const [year, month] = date.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(last).padStart(2, "0")}`,
  };
}
