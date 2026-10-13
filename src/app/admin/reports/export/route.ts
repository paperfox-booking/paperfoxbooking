import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { formatUkDate } from "@/lib/dates";
import { penceToPoundsInput } from "@/lib/money";
import { listEventProfits } from "@/lib/reports/admin";
import { eventYear } from "../years";

/** The profit and loss report as a CSV file, for Excel or the accountant. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "reports.view")) {
    return new Response("Please sign in as an owner or admin.", {
      status: 403,
    });
  }
  const year = new URL(request.url).searchParams.get("year") ?? "all";
  const events = (await listEventProfits()).filter(
    (event) => year === "all" || eventYear(event) === year,
  );
  const pounds = (pence: number) => penceToPoundsInput(pence);
  const rows = events.map((event) => [
    event.title,
    formatUkDate(event.startsAt),
    event.profit.placesSold,
    event.capacity,
    pounds(event.profit.salesPence),
    pounds(event.profit.keptFromCancelledPence),
    pounds(event.profit.incomePence),
    pounds(event.profit.receivedPence),
    pounds(event.profit.owedPence),
    pounds(event.profit.costsPence),
    pounds(event.profit.costsPaidPence),
    pounds(event.profit.profitPence),
    event.profit.marginPercent === null ? "" : event.profit.marginPercent,
  ]);
  const csv = toCsv([
    [
      "Event",
      "Starts",
      "Places sold",
      "Places",
      "Bookings (£)",
      "Kept from cancellations (£)",
      "Income (£)",
      "Received (£)",
      "Still owed (£)",
      "Costs (£)",
      "Costs paid (£)",
      "Profit (£)",
      "Margin (%)",
    ],
    ...rows,
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="paper-fox-profit-and-loss-${year}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
