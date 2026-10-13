import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { requireStaff } from "@/lib/auth/session";
import { listVenues } from "@/lib/events/admin";
import { newEventFormValues } from "@/lib/events/form-values";
import { saveEventAction } from "../actions";
import { EventForm } from "../event-form";

export const metadata: Metadata = { title: "Add an event" };

export default function NewEventPage() {
  return (
    <>
      <p>
        <Link href="/admin/events">Back to events</Link>
      </p>
      <h1 className="mt-2 text-5xl">Add an event</h1>
      <p className="mt-2 max-w-2xl">
        Making next year&apos;s version of an event? It&apos;s quicker to open
        last year&apos;s and choose <strong>Copy this event</strong>.
      </p>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <NewEvent />
      </Suspense>
    </>
  );
}

async function NewEvent() {
  const access = await requireStaff("/admin/events/new", "events.manage");
  if (!access.allowed) return <NotAllowed access={access} />;

  const venues = await listVenues();
  return (
    <EventForm
      action={saveEventAction.bind(null, null)}
      defaults={newEventFormValues(venues[0]?.id ?? "")}
      venues={venues.map(({ id, name }) => ({ id, name }))}
      isNew
    />
  );
}
