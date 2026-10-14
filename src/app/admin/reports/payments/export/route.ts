import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { formatUkDate } from "@/lib/dates";
import { penceToPoundsInput } from "@/lib/money";
import { listPaymentsBetween } from "@/lib/reports/admin";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/bookings";
import { reportDates } from "../dates";

/**
 * Payments by date as a CSV file, for checking against the bank. Refunds are
 * included, with the amount below zero.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "reports.view")) {
    return new Response("Please sign in as an owner or admin.", {
      status: 403,
    });
  }
  const params = new URL(request.url).searchParams;
  const { from, to } = reportDates(params.get("from"), params.get("to"));
  const rows = await listPaymentsBetween(from, to);
  const csv = toCsv([
    ["Date", "Amount", "How", "Name", "Reference", "Event", "Note"],
    ...rows.map((row) => [
      formatUkDate(`${row.receivedOn}T12:00:00Z`),
      penceToPoundsInput(row.amountPence),
      `${row.kind === "refund" ? "Refund: " : ""}${PAYMENT_METHOD_LABELS[row.method] ?? row.method}`,
      row.fullName,
      row.reference,
      row.eventTitle,
      row.note,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="payments ${from} to ${to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
