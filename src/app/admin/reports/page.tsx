import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/form";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDate } from "@/lib/dates";
import { formatPence } from "@/lib/money";
import { listEventProfits } from "@/lib/reports/admin";
import { addProfits } from "@/lib/reports/profit";
import { cn } from "@/lib/utils";
import { eventYear, yearsOf } from "./years";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage(props: PageProps<"/admin/reports">) {
  return (
    <>
      <h1 className="text-5xl">Profit and loss</h1>
      <p className="mt-2 max-w-3xl">
        Income, costs and profit for each event. Income is what everyone booked
        owes, plus money kept from cancellations. Profit is an estimate until
        everyone has paid and every cost is in.
      </p>
      <Suspense fallback={<p className="mt-4">Loading the report…</p>}>
        <Report searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Report({
  searchParams,
}: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const access = await requireStaff("/admin/reports", "reports.view");
  if (!access.allowed) return <NotAllowed access={access} />;

  const [events, { year }] = await Promise.all([
    listEventProfits(),
    searchParams,
  ]);
  const years = yearsOf(events);
  const chosen =
    typeof year === "string" && years.includes(year) ? year : "all";
  const shown =
    chosen === "all"
      ? events
      : events.filter((event) => eventYear(event) === chosen);
  const totals = addProfits(shown.map((event) => event.profit));

  return (
    <div className="mt-6 space-y-6">
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div>
          <Label htmlFor="year">Year</Label>
          <Select id="year" name="year" defaultValue={chosen} className="w-40">
            <option value="all">All years</option>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Show
        </Button>
        <Button asChild variant="secondary">
          <a href={`/admin/reports/export?year=${chosen}`} download>
            Download as a spreadsheet (CSV)
          </a>
        </Button>
      </form>

      {shown.length === 0 ? (
        <Card>
          <p>There aren&apos;t any events yet.</p>
        </Card>
      ) : (
        <div
          role="region"
          aria-label="Profit and loss by event"
          tabIndex={0}
          className="relative max-w-full overflow-x-auto rounded-2xl border border-cream bg-white"
        >
          <table className="min-w-max border-collapse text-left">
            <caption className="sr-only">Profit and loss by event</caption>
            <thead className="bg-cream-light">
              <tr>
                {[
                  "Event",
                  "Starts",
                  "Places",
                  "Income",
                  "Received",
                  "Still owed",
                  "Costs",
                  "Profit",
                  "Margin",
                ].map((heading, index) => (
                  <th
                    key={heading}
                    scope="col"
                    className={cn(
                      "px-3 py-3 font-bold whitespace-nowrap",
                      index > 1 && "text-right",
                    )}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((event) => (
                <tr key={event.id} className="border-t border-cream">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <Link href={`/admin/events/${event.id}/costs`}>
                      {event.title}
                    </Link>
                  </th>
                  <td className="px-3 py-2">{formatUkDate(event.startsAt)}</td>
                  <Money>
                    {event.profit.placesSold} of {event.capacity}
                  </Money>
                  <Money>{formatPence(event.profit.incomePence)}</Money>
                  <Money>{formatPence(event.profit.receivedPence)}</Money>
                  <Money>{formatPence(event.profit.owedPence)}</Money>
                  <Money>{formatPence(event.profit.costsPence)}</Money>
                  <Money negative={event.profit.profitPence < 0}>
                    {formatPence(event.profit.profitPence)}
                  </Money>
                  <Money>
                    {event.profit.marginPercent === null
                      ? "–"
                      : `${event.profit.marginPercent}%`}
                  </Money>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-cream bg-cream-light font-bold">
              <tr>
                <th scope="row" className="px-3 py-3 text-left">
                  Total
                </th>
                <td className="px-3 py-3" />
                <Money>{totals.placesSold}</Money>
                <Money>{formatPence(totals.incomePence)}</Money>
                <Money>{formatPence(totals.receivedPence)}</Money>
                <Money>{formatPence(totals.owedPence)}</Money>
                <Money>{formatPence(totals.costsPence)}</Money>
                <Money negative={totals.profitPence < 0}>
                  {formatPence(totals.profitPence)}
                </Money>
                <Money>
                  {totals.marginPercent === null
                    ? "–"
                    : `${totals.marginPercent}%`}
                </Money>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function Money({
  children,
  negative,
}: {
  children: React.ReactNode;
  negative?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-3 py-2 text-right whitespace-nowrap",
        negative && "font-bold text-danger",
      )}
    >
      {children}
    </td>
  );
}
