import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { ProfitSummary } from "@/components/admin/profit-summary";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDateRange } from "@/lib/dates";
import { getEvent } from "@/lib/events/admin";
import { formatPence } from "@/lib/money";
import { getEventProfit, listCosts } from "@/lib/reports/admin";
import { COST_CATEGORY_LABELS } from "@/lib/reports/profit";
import { isUuid } from "@/lib/validation/ids";
import { CostsGrid } from "./costs-grid";

export const metadata: Metadata = { title: "Profit and loss" };

export default function EventProfitPage(
  props: PageProps<"/admin/events/[eventId]/costs">,
) {
  return (
    <Suspense fallback={<p>Loading the figures…</p>}>
      <EventProfit params={props.params} />
    </Suspense>
  );
}

async function EventProfit({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/costs">, "params">) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/costs`,
    "events.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const [event, report, costs] = await Promise.all([
    getEvent(eventId),
    getEventProfit(eventId),
    listCosts(eventId),
  ]);
  if (!event || !report) notFound();
  const { profit } = report;
  const optionName = new Map(
    event.options.map((option) => [option.id, option.name]),
  );

  return (
    <div className="space-y-8">
      <div>
        <p>
          <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
        </p>
        <h1 className="mt-2 text-5xl">Profit and loss</h1>
        <p className="mt-1 text-lg">
          {event.title}, {formatUkDateRange(event.starts_at, event.ends_at)}.
          The figures update as people pay and costs are added.
        </p>
      </div>

      <ProfitSummary profit={profit} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-3xl">Income</h2>
          <table className="mt-2 w-full text-left">
            <caption className="sr-only">Income by option</caption>
            <tbody>
              {report.byOption.map((option) => (
                <tr
                  key={option.optionId ?? "none"}
                  className="border-b border-cream"
                >
                  <th scope="row" className="py-2 pr-2 font-normal">
                    {option.optionId
                      ? (optionName.get(option.optionId) ?? "Removed option")
                      : "No option (team places)"}
                    : {option.count}
                  </th>
                  <td className="py-2 text-right">
                    {formatPence(option.salesPence)}
                  </td>
                </tr>
              ))}
              {profit.keptFromCancelledPence ? (
                <tr className="border-b border-cream">
                  <th scope="row" className="py-2 pr-2 font-normal">
                    Kept from cancelled bookings
                  </th>
                  <td className="py-2 text-right">
                    {formatPence(profit.keptFromCancelledPence)}
                  </td>
                </tr>
              ) : null}
              <tr className="font-bold">
                <th scope="row" className="py-2 pr-2">
                  Total income
                </th>
                <td className="py-2 text-right">
                  {formatPence(profit.incomePence)}
                </td>
              </tr>
            </tbody>
          </table>
          {report.freePlaces ? (
            <p className="mt-2 text-stone">
              Includes {report.freePlaces} free{" "}
              {report.freePlaces === 1 ? "place" : "places"} for the team.
            </p>
          ) : null}
        </Card>
        <Card>
          <h2 className="text-3xl">Costs by type</h2>
          {profit.costsByCategory.length ? (
            <table className="mt-2 w-full text-left">
              <caption className="sr-only">Costs by type</caption>
              <tbody>
                {profit.costsByCategory.map((entry) => (
                  <tr key={entry.category} className="border-b border-cream">
                    <th scope="row" className="py-2 pr-2 font-normal">
                      {COST_CATEGORY_LABELS[entry.category]}
                    </th>
                    <td className="py-2 text-right">
                      {formatPence(entry.amountPence)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <th scope="row" className="py-2 pr-2">
                    Total costs
                  </th>
                  <td className="py-2 text-right">
                    {formatPence(profit.costsPence)}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="mt-2">No costs yet.</p>
          )}
        </Card>
      </div>

      <section aria-labelledby="costs-heading" className="space-y-3">
        <h2 id="costs-heading" className="text-3xl">
          Costs
        </h2>
        <p>
          Type into the boxes to change a cost: it saves when you move on. Tick
          Paid once a cost has been paid.
        </p>
        <CostsGrid eventId={event.id} initialCosts={costs} />
      </section>
    </div>
  );
}
