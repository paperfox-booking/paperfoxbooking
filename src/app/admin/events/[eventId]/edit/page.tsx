import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { requireStaff } from "@/lib/auth/session";
import { getEvent, listVenues } from "@/lib/events/admin";
import { eventFormValues } from "@/lib/events/form-values";
import { isUuid } from "@/lib/validation/ids";
import { saveEventAction } from "../../actions";
import { EventForm } from "../../event-form";

export const metadata: Metadata = { title: "Change event details" };

export default function EditEventPage(
  props: PageProps<"/admin/events/[eventId]/edit">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EditEvent params={props.params} />
    </Suspense>
  );
}

async function EditEvent({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/edit">, "params">) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/edit`,
    "events.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const [event, venues] = await Promise.all([getEvent(eventId), listVenues()]);
  if (!event) notFound();

  // Keep the event's venue in the list even if it has since been removed.
  const venueChoices = venues.map(({ id, name }) => ({ id, name }));
  if (
    event.venue &&
    !venueChoices.some((venue) => venue.id === event.venue_id)
  ) {
    venueChoices.unshift({ id: event.venue.id, name: event.venue.name });
  }

  return (
    <>
      <p>
        <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
      </p>
      <h1 className="mt-2 text-5xl">Change event details</h1>
      <EventForm
        action={saveEventAction.bind(null, event.id)}
        defaults={eventFormValues(event)}
        venues={venueChoices}
        isNew={false}
      />
    </>
  );
}
