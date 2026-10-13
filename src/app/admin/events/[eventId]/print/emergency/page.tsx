import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Notice } from "@/components/ui/card";
import { loadSheet } from "../load";
import { SheetHeader } from "../sheet-header";

export const metadata: Metadata = { title: "Emergency contacts" };

export default function EmergencyPage(
  props: PageProps<"/admin/events/[eventId]/print/emergency">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Emergency params={props.params} />
    </Suspense>
  );
}

async function Emergency({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/print/emergency">, "params">) {
  const { eventId } = await params;
  const result = await loadSheet(
    eventId,
    `/admin/events/${eventId}/print/emergency`,
  );
  if (!result.allowed) return <NotAllowed access={result.access} />;
  const { event, people } = result.sheet;

  return (
    <div>
      <SheetHeader
        eventId={event.id}
        title="Emergency contacts"
        eventTitle={event.title}
        startsAt={event.starts_at}
        endsAt={event.ends_at}
      >
        <Notice>
          Private: this includes health information. Keep it safe during the
          event and shred it afterwards.
        </Notice>
      </SheetHeader>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">
          Mobiles, emergency contacts and health needs
        </caption>
        <thead>
          <tr className="border-b-2 border-ink">
            <th scope="col" className="py-1 pr-2">
              Name
            </th>
            <th scope="col" className="py-1 pr-2">
              Room
            </th>
            <th scope="col" className="py-1 pr-2">
              Mobile
            </th>
            <th scope="col" className="py-1 pr-2">
              Emergency contact
            </th>
            <th scope="col" className="py-1">
              Dietary and health
            </th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr
              key={person.bookingId}
              className="break-inside-avoid border-b border-stone"
            >
              <th scope="row" className="py-1 pr-2 text-left font-bold">
                {person.fullName}
              </th>
              <td className="py-1 pr-2">{person.roomName}</td>
              <td className="py-1 pr-2 whitespace-nowrap">{person.phone}</td>
              <td className="py-1 pr-2">
                {person.emergencyContact || "Not given"}
              </td>
              <td className="py-1">{person.dietaryHealth}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
