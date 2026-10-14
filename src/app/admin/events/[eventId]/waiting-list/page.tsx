import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Card, Notice } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { listRooms } from "@/lib/bookings/admin";
import { listWaitlist, type WaitlistEntry } from "@/lib/bookings/waitlist";
import {
  daysBetween,
  formatUkDate,
  formatUkDateRange,
  ukToday,
} from "@/lib/dates";
import { countBooked, getEvent } from "@/lib/events/admin";
import { isUuid } from "@/lib/validation/ids";
import { WAITLIST_STATUS_LABELS } from "@/lib/validation/waitlist";
import { AddToWaitlistForm, BookForm, OfferForm, StatusButtons } from "./forms";

export const metadata: Metadata = { title: "Waiting list" };

const NOTICES = {
  added: { text: "Added to the end of the waiting list." },
  offered: {
    text: "Marked as offered a place. Let them know, and book them in once they accept.",
  },
};

export default function WaitingListPage(
  props: PageProps<"/admin/events/[eventId]/waiting-list">,
) {
  return (
    <Suspense fallback={<p>Loading the waiting list…</p>}>
      <WaitingList params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function WaitingList({
  params,
  searchParams,
}: Pick<
  PageProps<"/admin/events/[eventId]/waiting-list">,
  "params" | "searchParams"
>) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/waiting-list`,
    "bookings.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();
  const [event, entries, rooms, booked, { notice }] = await Promise.all([
    getEvent(eventId),
    listWaitlist(eventId),
    listRooms(eventId),
    countBooked(eventId),
    searchParams,
  ]);
  if (!event) notFound();

  const options = event.options
    .filter((option) => !option.deleted_at)
    .map((option) => ({ id: option.id, name: option.name }));
  const optionName = new Map(options.map((option) => [option.id, option.name]));
  const roomChoices = rooms.map((room) => ({ id: room.id, name: room.name }));
  const active = entries.filter(
    (entry) => entry.status === "waiting" || entry.status === "offered",
  );
  const earlier = entries.filter((entry) => !active.includes(entry)).reverse();
  const free = event.capacity - booked;
  const today = ukToday();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p>
          <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
        </p>
        <h1 className="mt-2 text-5xl">Waiting list</h1>
        <p className="mt-1 text-lg">
          {event.title}, {formatUkDateRange(event.starts_at, event.ends_at)}.{" "}
          <strong>
            {booked} of {event.capacity}
          </strong>{" "}
          places booked
          {free > 0
            ? `, so ${free} ${free === 1 ? "place is" : "places are"} free.`
            : ": it's full."}
        </p>
        <PageNotice notice={notice} messages={NOTICES} />
      </div>

      <section aria-labelledby="waiting-heading" className="space-y-3">
        <h2 id="waiting-heading" className="text-3xl">
          Waiting ({active.length})
        </h2>
        {active.length === 0 ? (
          <Card>
            <p>Nobody is waiting. Add people below when the event is full.</p>
          </Card>
        ) : (
          <ol className="space-y-3">
            {active.map((entry, index) => (
              <li key={entry.id}>
                <Entry
                  entry={entry}
                  position={index + 1}
                  eventId={event.id}
                  options={options}
                  rooms={roomChoices}
                  optionName={optionName}
                  today={today}
                  full={free <= 0}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      <Card>
        <h2 className="mb-3 text-3xl">Add someone</h2>
        <AddToWaitlistForm eventId={event.id} options={options} />
      </Card>

      {earlier.length ? (
        <section aria-labelledby="earlier-heading" className="space-y-2">
          <h2 id="earlier-heading" className="text-3xl">
            No longer waiting
          </h2>
          <ul className="space-y-2">
            {earlier.map((entry) => (
              <li
                key={entry.id}
                className="rounded-lg border border-cream bg-white p-3"
              >
                <strong>{entry.fullName}</strong>:{" "}
                {WAITLIST_STATUS_LABELS[entry.status].toLowerCase()}
                {entry.bookingId ? (
                  <>
                    {" "}
                    (
                    <Link href={`/admin/bookings/${entry.bookingId}`}>
                      open their booking
                    </Link>
                    )
                  </>
                ) : null}
                . Joined {formatUkDate(entry.joinedAt)}.
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Entry({
  entry,
  position,
  eventId,
  options,
  rooms,
  optionName,
  today,
  full,
}: {
  entry: WaitlistEntry;
  position: number;
  eventId: string;
  options: { id: string; name: string }[];
  rooms: { id: string; name: string }[];
  optionName: Map<string, string>;
  today: string;
  full: boolean;
}) {
  const offered = entry.status === "offered";
  const expired =
    offered &&
    entry.offerExpiresOn !== null &&
    daysBetween(entry.offerExpiresOn, today) > 0;
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-2xl">
          {position}. {entry.fullName}
        </h3>
        <p className="text-stone">Joined {formatUkDate(entry.joinedAt)}</p>
      </div>
      <p className="break-words">
        {[entry.email, entry.phone].filter(Boolean).join(" · ") ||
          "No contact details"}
        {entry.optionId
          ? `. Would like: ${optionName.get(entry.optionId) ?? "an option that's been removed"}`
          : ""}
      </p>
      {entry.notes ? <p>{entry.notes}</p> : null}
      {offered ? (
        <Notice tone={expired ? "error" : "info"}>
          Offered a place on {formatUkDate(entry.offeredAt!)}, until{" "}
          {formatUkDate(`${entry.offerExpiresOn!}T12:00:00Z`)}.
          {expired
            ? " That's passed: offer it to the next person, or give them longer."
            : ""}
        </Notice>
      ) : null}
      {full && !offered ? (
        <p className="text-stone">
          The event is full, so cancel a booking first to free a place.
        </p>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        <details className="rounded-2xl border border-cream p-3">
          <summary className="cursor-pointer font-bold">
            {offered ? "Give them longer" : "Offer a place"}
            <span className="sr-only"> to {entry.fullName}</span>
          </summary>
          <div className="mt-3">
            <OfferForm
              eventId={eventId}
              entryId={entry.id}
              name={entry.fullName}
            />
          </div>
        </details>
        <details className="rounded-2xl border border-cream p-3">
          <summary className="cursor-pointer font-bold">
            Book them in<span className="sr-only">: {entry.fullName}</span>
          </summary>
          <div className="mt-3">
            <BookForm
              eventId={eventId}
              entryId={entry.id}
              name={entry.fullName}
              options={options}
              rooms={rooms}
              wantedOptionId={entry.optionId}
            />
          </div>
        </details>
      </div>
      <StatusButtons
        eventId={eventId}
        entryId={entry.id}
        name={entry.fullName}
        offered={offered}
      />
    </Card>
  );
}
