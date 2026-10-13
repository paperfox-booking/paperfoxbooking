import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import {
  AvailabilityBadge,
  availabilityText,
} from "@/components/site/availability";
import { Card } from "@/components/ui/card";
import { business } from "@/lib/business";
import {
  formatUkDateRange,
  formatUkFriendlyTime,
  formatUkLongDate,
} from "@/lib/dates";
import {
  getPublicEvent,
  getUpcomingEventSlugs,
  type PublicEvent,
  type PublicOption,
} from "@/lib/events/public";
import { balanceAfterDeposit, lowestPrice } from "@/lib/events/rules";
import { formatPrice } from "@/lib/money";

/**
 * A public event page. Upcoming events are built ahead of time; any other
 * address is looked up the first time someone visits, then cached.
 */
export async function generateStaticParams() {
  const slugs = await getUpcomingEventSlugs();
  // Next.js needs at least one to check the page builds; this one is a 404.
  return slugs.length
    ? slugs.map((slug) => ({ slug }))
    : [{ slug: "no-events-yet" }];
}

export async function generateMetadata(
  props: PageProps<"/events/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const event = await getPublicEvent(slug);
  if (!event) return { title: "Event not found" };
  const when = formatUkDateRange(event.startsAt, event.endsAt);
  const description =
    event.summary ||
    `${when}${event.venue ? ` at ${event.venue.name}` : ""}. Paper Fox crafting weekend.`;
  return {
    title: event.title,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: {
      title: event.title,
      description,
      url: `/events/${event.slug}`,
    },
  };
}

export default function EventPage(props: PageProps<"/events/[slug]">) {
  return (
    <Suspense
      fallback={<p className="mx-auto max-w-5xl px-4 py-10">Loading…</p>}
    >
      <EventDetails params={props.params} />
    </Suspense>
  );
}

async function EventDetails({
  params,
}: Pick<PageProps<"/events/[slug]">, "params">) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  const from = lowestPrice(event.options);

  return (
    <article>
      <header className="bg-cream-light">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
          <p>
            <Link href="/#events">All events</Link>
          </p>
          <h1 className="mt-3 text-5xl sm:text-6xl">{event.title}</h1>
          <p className="mt-3 text-xl font-bold">
            {formatUkDateRange(event.startsAt, event.endsAt)}
          </p>
          {event.venue ? <p className="text-lg">{event.venue.name}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <AvailabilityBadge availability={event.availability} />
            {from !== null ? (
              <span className="text-lg">
                From <strong>{formatPrice(from)}</strong>
              </span>
            ) : null}
          </div>
          {event.summary ? (
            <p className="mt-4 max-w-2xl text-lg">{event.summary}</p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-10">
          {event.description ? (
            <section aria-label="About the weekend" className="space-y-4">
              {event.description
                .split(/\r?\n\s*\r?\n/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
            </section>
          ) : null}

          {event.included.length ? (
            <Section title="What everyone gets">
              <ul className="list-disc space-y-1 pl-5">
                {event.included.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section title="Prices">
            <ul className="space-y-4">
              {event.options.map((option) => (
                <li key={option.id}>
                  <OptionCard option={option} event={event} />
                </li>
              ))}
            </ul>
            <PaymentTerms event={event} />
          </Section>

          <HowToBook event={event} />

          {event.hotelInfo ? (
            <Section title="Staying over">
              <p className="whitespace-pre-line">{event.hotelInfo}</p>
            </Section>
          ) : null}
        </div>

        <aside className="space-y-6" aria-label="Venue">
          {event.venue ? (
            <Card>
              <h2 className="text-3xl">Venue</h2>
              <p className="mt-2 font-bold">{event.venue.name}</p>
              <address className="not-italic">
                {event.venue.addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
                {event.venue.postcode ? (
                  <span className="block">{event.venue.postcode}</span>
                ) : null}
              </address>
              {event.venue.phone ? (
                <p className="mt-2">
                  <a href={`tel:${event.venue.phone.replace(/\s+/g, "")}`}>
                    {event.venue.phone}
                  </a>
                </p>
              ) : null}
              {event.venue.mapUrl ? (
                <p className="mt-2">
                  <a href={event.venue.mapUrl}>
                    See it on a map
                    <span className="sr-only"> (opens Google Maps)</span>
                  </a>
                </p>
              ) : null}
              {event.venue.parking ? (
                <>
                  <h3 className="mt-4 text-2xl">Parking</h3>
                  <p className="whitespace-pre-line">{event.venue.parking}</p>
                </>
              ) : null}
              {event.venue.accessInfo ? (
                <>
                  <h3 className="mt-4 text-2xl">Access</h3>
                  <p className="whitespace-pre-line">
                    {event.venue.accessInfo}
                  </p>
                </>
              ) : null}
            </Card>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, "-");
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-4xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function OptionCard({
  option,
  event,
}: {
  option: PublicOption;
  event: PublicEvent;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-3xl">{option.name}</h3>
        <p className="text-2xl font-bold">{formatPrice(option.pricePence)}</p>
      </div>
      {option.startsAt ? (
        <p className="font-bold">
          Starts {formatUkFriendlyTime(option.startsAt)} on{" "}
          {formatUkLongDate(option.startsAt)}
        </p>
      ) : null}
      {option.description ? <p className="mt-1">{option.description}</p> : null}
      <p className="mt-2">
        {option.depositPence !== null && event.depositsOpen
          ? `Book with a ${formatPrice(option.depositPence)} deposit, then pay the remaining ${formatPrice(balanceAfterDeposit(option))} by ${formatUkLongDate(event.balanceDueOn)}.`
          : `Pay the full ${formatPrice(option.pricePence)} when you book.`}
      </p>
      {!option.onSale ? (
        <p className="mt-2 font-bold">Not available to book at the moment.</p>
      ) : null}
    </Card>
  );
}

function PaymentTerms({ event }: { event: PublicEvent }) {
  const hasDeposit = event.options.some(
    (option) => option.depositPence !== null,
  );
  return (
    <div className="space-y-2">
      <p>
        We take payment by bank transfer. We&apos;ll send the details when you
        book.
      </p>
      {hasDeposit ? (
        <>
          <p>
            The balance is due by{" "}
            <strong>{formatUkLongDate(event.balanceDueOn)}</strong>. If you book
            on or after that date, please pay in full when you book.
          </p>
          <p>Deposits can&apos;t be refunded or transferred.</p>
        </>
      ) : null}
      <p>We&apos;ll send our full terms and conditions when you book.</p>
    </div>
  );
}

function HowToBook({ event }: { event: PublicEvent }) {
  const subject = encodeURIComponent(`Booking: ${event.title}`);
  const mail = `mailto:${business.email}?subject=${subject}`;
  const { kind } = event.availability;

  let message: ReactNode;
  if (kind === "cancelled") {
    message = <p>Sorry, this event has been cancelled.</p>;
  } else if (kind === "finished") {
    message = (
      <p>
        This event has finished.{" "}
        <Link href="/#events">See upcoming events</Link>.
      </p>
    );
  } else if (kind === "sold_out") {
    message = (
      <p>
        This event is sold out. Email us at <a href={mail}>{business.email}</a>{" "}
        to join the waiting list, and we&apos;ll be in touch if a place comes
        up.
      </p>
    );
  } else {
    message = (
      <>
        {kind !== "open" ? (
          <p className="font-bold">{availabilityText(event.availability)}.</p>
        ) : null}
        <p>
          Online booking is coming soon. Until then, email us at{" "}
          <a href={mail}>{business.email}</a> or call{" "}
          <a href={business.phoneHref}>{business.phone}</a>, and say which
          option you&apos;d like.
        </p>
      </>
    );
  }

  return (
    <Section title="How to book">
      <Card className="space-y-2 border-teal bg-cream-light">{message}</Card>
    </Section>
  );
}
