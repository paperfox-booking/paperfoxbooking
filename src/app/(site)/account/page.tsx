import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Card, Notice } from "@/components/ui/card";
import {
  listMyBookings,
  loadCustomerSettings,
  type MyBooking,
} from "@/lib/account/bookings";
import { requireUser } from "@/lib/auth/session";
import { PAYMENT_STATE_LABELS } from "@/lib/bookings/money";
import {
  daysBetween,
  formatUkDate,
  formatUkDateRange,
  formatUkLongDate,
  toUkDateInput,
  ukToday,
} from "@/lib/dates";
import { bankDetails } from "@/lib/email/values";
import type { EmailSettings } from "@/lib/email/values";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/bookings";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-5xl">My account</h1>
      <Suspense fallback={<p className="mt-4">Loading your account…</p>}>
        <AccountDetails />
      </Suspense>
    </div>
  );
}

async function AccountDetails() {
  const user = await requireUser("/account");
  const [bookings, settings] = await Promise.all([
    listMyBookings(user.id),
    loadCustomerSettings(),
  ]);
  const today = ukToday();
  const upcoming = bookings.filter(
    (booking) => daysBetween(today, toUkDateInput(booking.event.endsAt)) >= 0,
  );
  const past = bookings
    .filter((booking) => !upcoming.includes(booking))
    .reverse();

  return (
    <div className="mt-4 space-y-6">
      <p>
        Signed in as <strong>{user.fullName ?? user.email}</strong>
        {user.fullName ? ` (${user.email})` : null}
      </p>

      {user.staffRole ? (
        <Card className="border-teal bg-cream-light">
          <p className="font-bold">You&apos;re on the Paper Fox team.</p>
          <p className="mt-1">
            <Link href="/admin">Go to the admin area</Link>
          </p>
        </Card>
      ) : null}

      <section aria-labelledby="bookings-heading" className="space-y-4">
        <h2 id="bookings-heading" className="text-3xl">
          My bookings
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <p>
              You don&apos;t have any upcoming bookings.{" "}
              <Link href="/">See what&apos;s on</Link>.
            </p>
            <p className="mt-2 text-stone">
              Booked already, but nothing&apos;s here? We match bookings by
              email address, so check you signed in with the one you booked
              with, or email {settings?.contactEmail ?? "us"}.
            </p>
          </Card>
        ) : (
          upcoming.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              settings={settings}
              today={today}
            />
          ))
        )}
      </section>

      {past.length ? (
        <section aria-labelledby="past-heading" className="space-y-2">
          <h2 id="past-heading" className="text-3xl">
            Past events
          </h2>
          <ul className="space-y-2">
            {past.map((booking) => (
              <li
                key={booking.id}
                className="rounded-lg border border-cream bg-white p-3"
              >
                <strong>{booking.event.title}</strong>,{" "}
                {formatUkDateRange(
                  booking.event.startsAt,
                  booking.event.endsAt,
                )}
                {booking.cancelled ? " (cancelled)" : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SignOutButton />
    </div>
  );
}

function BookingCard({
  booking,
  settings,
  today,
}: {
  booking: MyBooking;
  settings: EmailSettings | null;
  today: string;
}) {
  const { money } = booking;
  const owes = !booking.cancelled && money.balancePence > 0;
  const secured =
    money.state === "deposit_paid" ||
    money.state === "paid" ||
    money.state === "free";
  const bank = settings ? bankDetails(settings, booking.reference) : "";
  const docs = `/account/bookings/${booking.id}/documents`;
  const dueOn = formatUkLongDate(`${booking.event.balanceDueOn}T12:00:00Z`);
  const lateBooking = daysBetween(booking.event.balanceDueOn, today) > 0;

  return (
    <Card className="space-y-3">
      <div>
        <h3 className="text-3xl">{booking.event.title}</h3>
        <p>
          {formatUkDateRange(booking.event.startsAt, booking.event.endsAt)}
          {booking.event.venueName ? `, ${booking.event.venueName}` : null}
        </p>
        <p className="text-stone">
          Booking reference <strong>{booking.reference}</strong>
          {booking.optionName ? `. ${booking.optionName}` : null}
        </p>
      </div>

      {booking.cancelled ? (
        <Notice tone="error">
          This booking has been cancelled.
          {booking.refunds.map((refund, index) => (
            <span key={index} className="block">
              We refunded {formatPrice(refund.amountPence)} on{" "}
              {formatUkDate(`${refund.refundedOn}T12:00:00Z`)}.
            </span>
          ))}
          {booking.payments.length ? (
            <a
              href={`/account/bookings/${booking.id}/statement`}
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              See your statement of payments (PDF)
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
        </Notice>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="font-bold">Total</dt>
            <dd>{formatPrice(booking.pricePence)}</dd>
            <dt className="font-bold">Paid</dt>
            <dd>{formatPrice(booking.paidPence)}</dd>
            <dt className="font-bold">Still to pay</dt>
            <dd className={cn(money.overdue && "font-bold text-danger")}>
              {formatPrice(Math.max(money.balancePence, 0))}
              {owes
                ? money.overdue
                  ? ` (it was due by ${dueOn})`
                  : ` by ${dueOn}`
                : null}
            </dd>
            <dt className="font-bold">Status</dt>
            <dd>{PAYMENT_STATE_LABELS[money.state]}</dd>
          </dl>

          {owes ? (
            <div className="rounded-lg bg-cream-light p-4">
              <h4 className="font-bold">How to pay</h4>
              {!secured && money.depositOwedPence > 0 && !lateBooking ? (
                <p>
                  Your place is secured once your deposit of{" "}
                  {formatPrice(money.depositOwedPence)} arrives.
                </p>
              ) : null}
              {bank ? (
                <>
                  <p>Pay by bank transfer to:</p>
                  <p className="font-bold whitespace-pre-line">{bank}</p>
                  <p className="mt-1 text-stone">
                    Please use your booking reference, {booking.reference}, so
                    we can match your payment. We&apos;ll email you when it
                    arrives.
                  </p>
                </>
              ) : (
                <p>
                  Please email {settings?.contactEmail ?? "us"} for our bank
                  details.
                </p>
              )}
            </div>
          ) : null}

          {booking.payments.length ? (
            <details>
              <summary className="cursor-pointer font-bold">
                Payments received
              </summary>
              <ul className="mt-2 space-y-1">
                {booking.payments.map((payment, index) => (
                  <li key={index}>
                    {formatPrice(payment.amountPence)}
                    {payment.receivedOn
                      ? ` on ${formatUkDate(`${payment.receivedOn}T12:00:00Z`)}`
                      : null}
                    ,{" "}
                    {(
                      PAYMENT_METHOD_LABELS[payment.method] ?? payment.method
                    ).toLowerCase()}
                  </li>
                ))}
                {booking.refunds.map((refund, index) => (
                  <li key={`refund-${index}`}>
                    {formatPrice(refund.amountPence)} refunded on{" "}
                    {formatUkDate(`${refund.refundedOn}T12:00:00Z`)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {secured && booking.event.facebookGroupUrl ? (
            <p>
              Join the{" "}
              <a href={booking.event.facebookGroupUrl}>
                event&apos;s private Facebook group
              </a>
              .
            </p>
          ) : null}

          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {secured ? (
              <li>
                <a
                  href={`${docs}/confirmation`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Your confirmation (PDF)
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </li>
            ) : null}
            <li>
              <a
                href={`${docs}/booking-details`}
                target="_blank"
                rel="noreferrer"
              >
                Booking details (PDF)
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a href={`${docs}/terms`} target="_blank" rel="noreferrer">
                Terms and conditions (PDF)
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
            <li>
              <a
                href={`/account/bookings/${booking.id}/statement`}
                target="_blank"
                rel="noreferrer"
              >
                Statement of payments (PDF)
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </>
      )}
    </Card>
  );
}
