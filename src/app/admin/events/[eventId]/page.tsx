import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import {
  daysBetween,
  formatUkDateRange,
  formatUkDateTime,
  formatUkFriendlyTime,
  formatUkLongDate,
  toUkDateInput,
} from "@/lib/dates";
import { countBooked, getEvent, type AdminEvent } from "@/lib/events/admin";
import { balanceAfterDeposit, describeTimeBefore } from "@/lib/events/rules";
import { formatPrice } from "@/lib/money";
import { isUuid } from "@/lib/validation/ids";
import { EventStatusActions } from "./event-status-actions";

export const metadata: Metadata = { title: "Event" };

const NOTICES = {
  saved: { text: "Saved." },
  copied: {
    text: "This is the new copy. It's a draft, so only the team can see it. Check the details and options, add the Facebook group, then publish it.",
  },
  "options-not-added": {
    text: "The event was added, but the usual options couldn't be. Add them below.",
    tone: "error" as const,
  },
  published: { text: "Published. It's now on the website." },
  unpublished: { text: "Unpublished. Only the team can see it now." },
  "sold-out": { text: "Marked as sold out." },
  cancelled: { text: "The event has been cancelled." },
  "option-saved": { text: "The option has been saved." },
  "option-removed": { text: "The option has been removed." },
};

export default function EventPage(props: PageProps<"/admin/events/[eventId]">) {
  return (
    <>
      <p>
        <Link href="/admin/events">Back to events</Link>
      </p>
      <Suspense fallback={<p className="mt-4">Loading the event…</p>}>
        <EventDetails params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function EventDetails({
  params,
  searchParams,
}: Pick<PageProps<"/admin/events/[eventId]">, "params" | "searchParams">) {
  const { eventId } = await params;
  const access = await requireStaff(`/admin/events/${eventId}`);
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const [event, booked, { notice }] = await Promise.all([
    getEvent(eventId),
    countBooked(eventId),
    searchParams,
  ]);
  if (!event) notFound();
  const canManage = can(access.user.staffRole, "events.manage");
  const isPublic = event.status !== "draft";

  return (
    <div className="mt-2 max-w-6xl space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-5xl">{event.title}</h1>
          <StatusBadge status={event.status} />
        </div>
        <p className="mt-2 text-lg">
          {formatUkDateRange(event.starts_at, event.ends_at)}
          {event.venue ? ` at ${event.venue.name}` : null}
        </p>
        <PageNotice notice={notice} messages={NOTICES} />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/admin/events/${event.id}/people`}>
            People booked ({booked} of {event.capacity})
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/events/${event.id}/email`}>Email people</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/events/${event.id}/waiting-list`}>
            Waiting list
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/events/${event.id}/check-in`}>Check in</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/events/${event.id}/print`}>
            Printing and catering
          </Link>
        </Button>
        {canManage ? (
          <>
            <Button asChild variant="secondary">
              <Link href={`/admin/events/${event.id}/costs`}>
                Profit and loss
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/admin/events/${event.id}/edit`}>
                Change details
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/admin/events/${event.id}/copy`}>
                Copy this event
              </Link>
            </Button>
          </>
        ) : null}
        {isPublic ? (
          <Button asChild variant="ghost">
            <Link href={`/events/${event.slug}`}>See the public page</Link>
          </Button>
        ) : null}
      </div>

      <Options event={event} canManage={canManage} />
      <Details event={event} />

      {can(access.user.staffRole, "payments.view") ? (
        <section aria-labelledby="documents-heading" className="space-y-2">
          <h2 id="documents-heading" className="text-3xl">
            Documents for emails
          </h2>
          <p>
            Made from this event&apos;s details, and attached to emails. Check
            them after changing the details above. Each person&apos;s copy has
            their own name, reference and dates.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {(
              [
                ["booking-details", "Booking details (PDF)"],
                ["confirmation", "Confirmation (PDF)"],
                ["terms", "Terms and conditions (PDF)"],
              ] as const
            ).map(([kind, label]) => (
              <li key={kind}>
                <a
                  href={`/admin/events/${event.id}/documents/${kind}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canManage ? (
        <EventStatusActions
          eventId={event.id}
          status={event.status}
          hasOptionOnSale={event.options.some((option) => option.on_sale)}
        />
      ) : null}
    </div>
  );
}

function Options({
  event,
  canManage,
}: {
  event: AdminEvent;
  canManage: boolean;
}) {
  return (
    <section aria-labelledby="options-heading">
      <h2 id="options-heading" className="text-3xl">
        Options
      </h2>
      <p className="mt-1 max-w-2xl">
        What people choose when they book, each with its own price and deposit.
      </p>
      {event.options.length === 0 ? (
        <Notice className="mt-3">
          There aren&apos;t any options yet. Add at least one before publishing
          the event.
        </Notice>
      ) : (
        <ul className="mt-3 grid gap-4 md:grid-cols-2">
          {event.options.map((option) => (
            <li key={option.id}>
              <Card className="h-full">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-2xl">{option.name}</h3>
                  {option.on_sale ? null : (
                    <span className="rounded-full border-2 border-stone px-3 py-0.5 text-sm font-bold">
                      Not on sale
                    </span>
                  )}
                </div>
                <p className="mt-1 text-lg font-bold">
                  {formatPrice(option.price_pence)}
                </p>
                <p>
                  {option.deposit_pence === null
                    ? "Paid in full when booking."
                    : `${formatPrice(option.deposit_pence)} deposit, then ${formatPrice(balanceAfterDeposit({ pricePence: option.price_pence, depositPence: option.deposit_pence }))} by ${formatUkLongDate(event.balance_due_on)}.`}
                </p>
                {option.starts_at ? (
                  <p className="text-stone">
                    Starts {formatUkFriendlyTime(option.starts_at)} on{" "}
                    {formatUkLongDate(option.starts_at)}
                  </p>
                ) : null}
                {option.capacity ? (
                  <p className="text-stone">Up to {option.capacity} places</p>
                ) : null}
                {canManage ? (
                  <p className="mt-3">
                    <Link
                      href={`/admin/events/${event.id}/options/${option.id}`}
                    >
                      Change {option.name}
                    </Link>
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <Button asChild variant="secondary" className="mt-4">
          <Link href={`/admin/events/${event.id}/options/new`}>
            Add an option
          </Link>
        </Button>
      ) : null}
    </section>
  );
}

function Details({ event }: { event: AdminEvent }) {
  const daysBefore = daysBetween(
    event.balance_due_on,
    toUkDateInput(event.starts_at),
  );
  return (
    <section aria-labelledby="details-heading">
      <h2 id="details-heading" className="text-3xl">
        Details
      </h2>
      <Card className="mt-3">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-[minmax(0,14rem)_1fr]">
          <Row label="Places">{event.capacity}</Row>
          <Row label="Balance due by">
            {formatUkLongDate(event.balance_due_on)} (
            {describeTimeBefore(daysBefore)} before)
          </Row>
          <Row label="Place held for a deposit">
            {event.deposit_hold_days === 1
              ? "1 day"
              : `${event.deposit_hold_days} days`}
          </Row>
          <Row label="Booking opens">
            {event.booking_opens_at
              ? formatUkDateTime(event.booking_opens_at)
              : "When the event is published"}
          </Row>
          <Row label="Booking closes">
            {event.booking_closes_at
              ? formatUkDateTime(event.booking_closes_at)
              : "When the event starts"}
          </Row>
          <Row label="Facebook group">
            {event.facebook_group_url ? (
              <a href={event.facebook_group_url}>{event.facebook_group_url}</a>
            ) : (
              <strong>Not added yet</strong>
            )}
          </Row>
          <Row label="Summary">{event.summary || "None"}</Row>
          <Row label="What everyone gets">
            {event.included ? (
              <ul className="list-disc pl-5">
                {event.included
                  .split(/\r?\n/)
                  .filter((line) => line.trim())
                  .map((line) => (
                    <li key={line}>{line}</li>
                  ))}
              </ul>
            ) : (
              "None"
            )}
          </Row>
          <Row label="Hotel rooms">
            <span className="whitespace-pre-line">
              {event.hotel_info || "None"}
            </span>
          </Row>
          <Row label="Description">
            <span className="whitespace-pre-line">
              {event.description || "None"}
            </span>
          </Row>
        </dl>
      </Card>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-bold">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}
