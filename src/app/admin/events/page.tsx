import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDateRange } from "@/lib/dates";
import { listEventsByTime, type AdminEventSummary } from "@/lib/events/admin";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage(props: PageProps<"/admin/events">) {
  return (
    <>
      <h1 className="text-5xl">Events</h1>
      <Suspense fallback={<p className="mt-4">Loading events…</p>}>
        <Events searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Events({
  searchParams,
}: Pick<PageProps<"/admin/events">, "searchParams">) {
  const access = await requireStaff("/admin/events");
  if (!access.allowed) return <NotAllowed access={access} />;

  const [{ upcoming, past }, { notice }] = await Promise.all([
    listEventsByTime(),
    searchParams,
  ]);
  const canManage = can(access.user.staffRole, "events.manage");

  return (
    <div className="mt-4 space-y-8">
      <PageNotice
        notice={notice}
        messages={{ deleted: { text: "The draft event has been deleted." } }}
      />

      {canManage ? (
        <Button asChild>
          <Link href="/admin/events/new">Add an event</Link>
        </Button>
      ) : null}

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="text-3xl">
          Upcoming
        </h2>
        {upcoming.length ? (
          <EventList events={upcoming} />
        ) : (
          <Card className="mt-3">
            <p className="font-bold">There aren&apos;t any upcoming events.</p>
            <p className="mt-1">
              {canManage
                ? "Add one, or open a past event and copy it to make the next one."
                : "When the team adds one, it will appear here."}
            </p>
          </Card>
        )}
      </section>

      {past.length ? (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="text-3xl">
            Past
          </h2>
          <EventList events={past} />
        </section>
      ) : null}
    </div>
  );
}

function EventList({ events }: { events: AdminEventSummary[] }) {
  return (
    <ul className="mt-3 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {events.map((event) => (
        <li key={event.id}>
          <Card className="h-full">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-2xl">
                <Link
                  href={`/admin/events/${event.id}`}
                  className="text-ink no-underline hover:underline"
                >
                  {event.title}
                </Link>
              </h3>
              <StatusBadge status={event.status} />
            </div>
            <p className="mt-1">
              {formatUkDateRange(event.startsAt, event.endsAt)}
            </p>
            <p className="text-stone">
              {event.venueName} · {event.capacity} places ·{" "}
              {event.optionCount === 1
                ? "1 option"
                : `${event.optionCount} options`}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
