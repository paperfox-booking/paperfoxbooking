import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { listRooms } from "@/lib/bookings/admin";
import { getEvent } from "@/lib/events/admin";
import { isUuid } from "@/lib/validation/ids";
import { removeRoomAction, saveRoomAction } from "../../actions";
import { RoomForm } from "./room-form";

export const metadata: Metadata = { title: "Rooms" };

export default function RoomsPage(
  props: PageProps<"/admin/events/[eventId]/rooms">,
) {
  return (
    <Suspense fallback={<p>Loading the rooms…</p>}>
      <Rooms params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Rooms({
  params,
  searchParams,
}: Pick<
  PageProps<"/admin/events/[eventId]/rooms">,
  "params" | "searchParams"
>) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/rooms`,
    "events.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const [event, rooms, { notice }] = await Promise.all([
    getEvent(eventId),
    listRooms(eventId),
    searchParams,
  ]);
  if (!event) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p>
          <Link href={`/admin/events/${event.id}/people`}>
            Back to people booked
          </Link>
        </p>
        <h1 className="mt-2 text-5xl">Rooms</h1>
        <p className="mt-1">
          The rooms at {event.title}. Each person can be put in a room on the
          people booked list. A room&apos;s places are a guide: the limit that
          counts is the event&apos;s {event.capacity} places.
        </p>
        <PageNotice
          notice={notice}
          messages={{
            saved: { text: "Saved." },
            removed: { text: "The room has been removed." },
          }}
        />
      </div>

      {rooms.map((room) => (
        <Card key={room.id}>
          <h2 className="mb-3 text-3xl">{room.name}</h2>
          <RoomForm
            idPrefix={`room-${room.id}`}
            action={saveRoomAction.bind(null, event.id, room.id)}
            removeAction={removeRoomAction.bind(null, event.id, room.id)}
            defaults={{
              name: room.name,
              capacity: room.capacity === null ? "" : String(room.capacity),
              notes: room.notes,
            }}
          />
        </Card>
      ))}

      <Card>
        <h2 className="mb-3 text-3xl">Add a room</h2>
        <RoomForm
          idPrefix="new-room"
          action={saveRoomAction.bind(null, event.id, null)}
          defaults={{ name: "", capacity: "", notes: "" }}
          sortOrder={rooms.length}
        />
      </Card>
    </div>
  );
}
