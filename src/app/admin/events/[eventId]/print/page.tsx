import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Card } from "@/components/ui/card";
import { formatUkDateRange } from "@/lib/dates";
import { loadSheet } from "./load";

export const metadata: Metadata = { title: "Printing" };

const SHEETS = [
  {
    href: "catering",
    title: "Catering sheet",
    text: "Numbers on each option and everyone's dietary needs, to send to the hotel. Also downloads as a spreadsheet.",
  },
  {
    href: "print/register",
    title: "Register",
    text: "Everyone booked, the team first, with a box to tick as they arrive and what they still owe.",
  },
  {
    href: "print/badges",
    title: "Name badges",
    text: "Eight to an A4 sheet, with first names large.",
  },
  {
    href: "print/rooms",
    title: "Room lists",
    text: "Who's in each room, one room to a page, for the doors.",
  },
  {
    href: "print/emergency",
    title: "Emergency contacts",
    text: "Mobiles, emergency contacts and health needs. Private: keep it safe and destroy it after the event.",
  },
];

export default function PrintPage(
  props: PageProps<"/admin/events/[eventId]/print">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Print params={props.params} />
    </Suspense>
  );
}

async function Print({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/print">, "params">) {
  const { eventId } = await params;
  const result = await loadSheet(eventId, `/admin/events/${eventId}/print`);
  if (!result.allowed) return <NotAllowed access={result.access} />;
  const { event, people } = result.sheet;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <p>
          <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
        </p>
        <h1 className="mt-2 text-5xl">Printing</h1>
        <p className="mt-1 text-lg">
          {event.title}, {formatUkDateRange(event.starts_at, event.ends_at)}.{" "}
          {people.length} people booked. Each sheet opens ready to print, or to
          save as a PDF from the print window.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {SHEETS.map((sheet) => (
          <li key={sheet.href}>
            <Card className="h-full">
              <h2 className="text-3xl">
                <Link href={`/admin/events/${event.id}/${sheet.href}`}>
                  {sheet.title}
                </Link>
              </h2>
              <p className="mt-1">{sheet.text}</p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
