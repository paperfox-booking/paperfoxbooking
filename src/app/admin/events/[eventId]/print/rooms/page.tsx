import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { peopleByRoom } from "@/lib/bookings/sheets";
import { loadSheet } from "../load";
import { SheetHeader } from "../sheet-header";

export const metadata: Metadata = { title: "Room lists" };

export default function RoomListsPage(
  props: PageProps<"/admin/events/[eventId]/print/rooms">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <RoomLists params={props.params} />
    </Suspense>
  );
}

async function RoomLists({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/print/rooms">, "params">) {
  const { eventId } = await params;
  const result = await loadSheet(
    eventId,
    `/admin/events/${eventId}/print/rooms`,
  );
  if (!result.allowed) return <NotAllowed access={result.access} />;
  const { event, people, rooms } = result.sheet;
  const groups = peopleByRoom(people, rooms);

  return (
    <div>
      <div className="print:hidden">
        <SheetHeader
          eventId={event.id}
          title="Room lists"
          eventTitle={event.title}
          startsAt={event.starts_at}
          endsAt={event.ends_at}
        >
          <p>Each room prints on its own page.</p>
        </SheetHeader>
      </div>
      {groups.map((group) => (
        <section
          key={group.room?.id ?? "none"}
          aria-label={group.room?.name ?? "Not in a room yet"}
          className="mb-10 break-after-page"
        >
          <h2 className="text-5xl">
            {group.room?.name ?? "Not in a room yet"}
          </h2>
          <p className="text-lg">
            {event.title}: {group.people.length}{" "}
            {group.people.length === 1 ? "person" : "people"}
            {group.room?.capacity ? ` (room for ${group.room.capacity})` : null}
          </p>
          <ol className="mt-4 columns-1 gap-8 text-xl sm:columns-2 print:columns-2">
            {group.people.map((person) => (
              <li key={person.bookingId} className="break-inside-avoid py-1">
                {person.fullName}
                {person.isTeam ? " (team)" : null}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
