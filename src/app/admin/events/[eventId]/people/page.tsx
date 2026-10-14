import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import {
  listEventPeople,
  listKnownPeople,
  listRooms,
} from "@/lib/bookings/admin";
import { formatUkDateRange, formatUkLongDate, ukToday } from "@/lib/dates";
import { getEvent } from "@/lib/events/admin";
import { isUuid } from "@/lib/validation/ids";
import { PeopleGrid } from "./people-grid";

export const metadata: Metadata = { title: "People booked" };

export default function PeoplePage(
  props: PageProps<"/admin/events/[eventId]/people">,
) {
  return (
    <Suspense fallback={<p>Loading everyone booked…</p>}>
      <People params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function People({
  params,
  searchParams,
}: Pick<
  PageProps<"/admin/events/[eventId]/people">,
  "params" | "searchParams"
>) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/people`,
    "bookings.view",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const role = access.user.staffRole;
  const canEdit = can(role, "bookings.manage");
  const canSeeMoney = can(role, "payments.view");
  const [event, rows, rooms, knownPeople, query] = await Promise.all([
    getEvent(eventId),
    listEventPeople(eventId),
    listRooms(eventId),
    canEdit ? listKnownPeople() : Promise.resolve([]),
    searchParams,
  ]);
  if (!event) notFound();

  return (
    <div className="space-y-6">
      <div>
        <p>
          <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
        </p>
        <h1 className="mt-2 text-5xl">People booked</h1>
        <p className="mt-1 text-lg">
          {event.title}, {formatUkDateRange(event.starts_at, event.ends_at)}.
          {canSeeMoney
            ? ` Balance due by ${formatUkLongDate(event.balance_due_on)}.`
            : null}
        </p>
        <PageNotice
          notice={query.notice}
          messages={{
            imported: {
              text: `Imported ${typeof query.count === "string" ? query.count : ""} people. Check the rows the preview flagged, then you're ready to go.`,
            },
          }}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <a href={`/admin/events/${event.id}/people/export`} download>
            Download as a spreadsheet (CSV)
          </a>
        </Button>
        {canEdit ? (
          <Button asChild variant="secondary">
            <Link href={`/admin/events/${event.id}/rooms`}>Rooms</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary">
          <Link href={`/admin/events/${event.id}/print`}>
            Printing and catering
          </Link>
        </Button>
        {canEdit && rows.every((row) => row.cancelled) ? (
          <Button asChild variant="secondary">
            <Link href={`/admin/events/${event.id}/import`}>
              Import a spreadsheet
            </Link>
          </Button>
        ) : null}
      </div>

      <PeopleGrid
        eventId={event.id}
        initialRows={rows}
        options={event.options.map(({ id, name }) => ({ id, name }))}
        rooms={rooms.map(({ id, name, capacity }) => ({ id, name, capacity }))}
        knownPeople={knownPeople.map(({ fullName, email }) => ({
          fullName,
          email,
        }))}
        canEdit={canEdit}
        canSeeMoney={canSeeMoney}
        balanceDueOn={event.balance_due_on}
        capacity={event.capacity}
        today={ukToday()}
      />
    </div>
  );
}
