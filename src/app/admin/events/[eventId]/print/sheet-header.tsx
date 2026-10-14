import Link from "next/link";
import type { ReactNode } from "react";
import { PrintButton } from "@/components/admin/print-button";
import { formatUkDateRange } from "@/lib/dates";

/** The top of a printable sheet: back link and print button on screen only. */
export function SheetHeader({
  eventId,
  title,
  eventTitle,
  startsAt,
  endsAt,
  children,
}: {
  eventId: string;
  title: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-3">
      <p className="print:hidden">
        <Link href={`/admin/events/${eventId}/print`}>Back to printing</Link>
      </p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-5xl print:text-3xl">{title}</h1>
          <p className="text-lg print:text-base">
            {eventTitle}, {formatUkDateRange(startsAt, endsAt)}
          </p>
        </div>
        <PrintButton />
      </div>
      {children}
    </div>
  );
}
