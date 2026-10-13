import Link from "next/link";
import { Card } from "@/components/ui/card";
import { business } from "@/lib/business";
import { formatUkDateRange } from "@/lib/dates";
import { getUpcomingEvents } from "@/lib/events/public";
import { lowestPrice } from "@/lib/events/rules";
import { formatPrice } from "@/lib/money";
import { AvailabilityBadge } from "./availability";

/** The upcoming events on the home page. Cached, so it loads instantly. */
export async function UpcomingEvents() {
  const events = await getUpcomingEvents();

  if (events.length === 0) {
    return (
      <Card className="mt-4">
        <p className="text-lg font-bold">
          There aren&apos;t any events open for booking here yet.
        </p>
        <p className="mt-2">
          Email us at <a href={`mailto:${business.email}`}>{business.email}</a>{" "}
          to book or ask about a place.
        </p>
      </Card>
    );
  }

  return (
    <ul className="mt-4 grid gap-4 md:grid-cols-2">
      {events.map((event) => {
        const from = lowestPrice(event.options);
        return (
          <li key={event.id}>
            <Card className="flex h-full flex-col gap-2">
              <AvailabilityBadge
                availability={event.availability}
                className="self-start"
              />
              <h3 className="text-3xl">
                <Link
                  href={`/events/${event.slug}`}
                  className="text-ink no-underline hover:underline"
                >
                  {event.title}
                </Link>
              </h3>
              <p className="font-bold">
                {formatUkDateRange(event.startsAt, event.endsAt)}
              </p>
              {event.venue ? <p>{event.venue.name}</p> : null}
              {event.summary ? <p>{event.summary}</p> : null}
              {from !== null ? (
                <p className="text-lg">
                  From <strong>{formatPrice(from)}</strong>
                </p>
              ) : null}
              <p className="mt-auto pt-2">
                <Link href={`/events/${event.slug}`}>
                  See details and prices
                  <span className="sr-only"> for {event.title}</span>
                </Link>
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
