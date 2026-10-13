import type { ReactNode } from "react";
import { formatPence } from "@/lib/money";
import type { Profit } from "@/lib/reports/profit";
import { cn } from "@/lib/utils";

/** The headline figures for an event's profit and loss. */
export function ProfitSummary({ profit }: { profit: Profit }) {
  return (
    <section
      aria-label="Summary"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      <Figure title="Income" value={formatPence(profit.incomePence)}>
        {profit.placesSold} places sold. {formatPence(profit.receivedPence)}{" "}
        received, {formatPence(profit.owedPence)} still owed.
      </Figure>
      <Figure title="Costs" value={formatPence(profit.costsPence)}>
        {formatPence(profit.costsPaidPence)} paid,{" "}
        {formatPence(profit.costsUnpaidPence)} still to pay.
      </Figure>
      <Figure
        title="Profit"
        value={formatPence(profit.profitPence)}
        negative={profit.profitPence < 0}
      >
        {profit.marginPercent === null
          ? "No income yet."
          : `${profit.marginPercent}% of income.`}
      </Figure>
      <Figure
        title="Cash so far"
        value={formatPence(profit.cashPence)}
        negative={profit.cashPence < 0}
      >
        Money received less costs paid.
      </Figure>
    </section>
  );
}

function Figure({
  title,
  value,
  negative,
  children,
}: {
  title: string;
  value: string;
  negative?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-cream bg-white p-4">
      <h2 className="text-2xl">{title}</h2>
      <p className={cn("text-3xl font-bold", negative && "text-danger")}>
        {value}
      </p>
      <p className="mt-1 text-stone">{children}</p>
    </div>
  );
}
