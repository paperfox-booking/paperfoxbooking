import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { TextField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDate, formatUkLongDate } from "@/lib/dates";
import { formatPence } from "@/lib/money";
import { listPaymentsBetween } from "@/lib/reports/admin";
import { summarisePayments } from "@/lib/reports/payments";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/bookings";
import { reportDates } from "./dates";

export const metadata: Metadata = { title: "Payments by date" };

export default function PaymentsReportPage(
  props: PageProps<"/admin/reports/payments">,
) {
  return (
    <>
      <p>
        <Link href="/admin/reports">Back to profit and loss</Link>
      </p>
      <h1 className="mt-2 text-5xl">Payments by date</h1>
      <p className="mt-2 max-w-3xl">
        Every payment recorded, by the date it arrived, to check against the
        bank statement. Removed payments aren&apos;t included. Payments brought
        across from a spreadsheet as a total, with no date, aren&apos;t either.
      </p>
      <Suspense fallback={<p className="mt-4">Loading the report…</p>}>
        <Report searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Report({
  searchParams,
}: Pick<PageProps<"/admin/reports/payments">, "searchParams">) {
  const access = await requireStaff("/admin/reports/payments", "reports.view");
  if (!access.allowed) return <NotAllowed access={access} />;
  const params = await searchParams;
  const { from, to } = reportDates(params.from, params.to);
  const summary = summarisePayments(await listPaymentsBetween(from, to));
  const day = (date: string) => formatUkLongDate(`${date}T12:00:00Z`);

  return (
    <div className="mt-6 space-y-6">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <TextField
          name="from"
          type="date"
          label="From"
          defaultValue={from}
          className="max-w-48"
        />
        <TextField
          name="to"
          type="date"
          label="To"
          defaultValue={to}
          className="max-w-48"
        />
        <Button type="submit" variant="secondary">
          Show
        </Button>
        <Button asChild variant="ghost">
          <a
            href={`/admin/reports/payments/export?from=${from}&to=${to}`}
            download
          >
            Download as a spreadsheet (CSV)
          </a>
        </Button>
      </form>

      <Card>
        <h2 className="text-3xl">
          {formatPence(summary.totalPence)} from {summary.count}{" "}
          {summary.count === 1 ? "payment" : "payments"}
        </h2>
        <p className="mt-1">
          {formatUkDate(`${from}T12:00:00Z`)} to{" "}
          {formatUkDate(`${to}T12:00:00Z`)}
        </p>
        {summary.byMethod.length ? (
          <ul className="mt-2 space-y-1">
            {summary.byMethod.map((method) => (
              <li key={method.method}>
                {PAYMENT_METHOD_LABELS[method.method] ?? method.method}:{" "}
                <strong>{formatPence(method.totalPence)}</strong> (
                {method.count})
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {summary.byDay.length === 0 ? (
        <p>No payments arrived between these dates.</p>
      ) : (
        summary.byDay.map((group) => (
          <section
            key={group.date}
            aria-labelledby={`day-${group.date}`}
            className="space-y-2"
          >
            <h2 id={`day-${group.date}`} className="text-2xl">
              {day(group.date)}: {formatPence(group.totalPence)}
            </h2>
            <ul className="divide-y divide-cream rounded-2xl border border-cream bg-white">
              {group.rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap justify-between gap-x-4 gap-y-1 p-3"
                >
                  <span>
                    <Link href={`/admin/bookings/${row.bookingId}`}>
                      {row.fullName}
                    </Link>{" "}
                    <span className="text-stone">
                      {row.reference}, {row.eventTitle}
                    </span>
                    {row.note ? (
                      <span className="block text-sm text-stone">
                        {row.note}
                      </span>
                    ) : null}
                  </span>
                  <span>
                    <strong>{formatPence(row.amountPence)}</strong>{" "}
                    {(
                      PAYMENT_METHOD_LABELS[row.method] ?? row.method
                    ).toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
