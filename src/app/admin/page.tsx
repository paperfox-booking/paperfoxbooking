import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { StatusBadge } from "@/components/admin/status-badge";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS, can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import {
  daysBetween,
  formatUkDateRange,
  formatUkLongDate,
  toUkDateInput,
  ukToday,
} from "@/lib/dates";
import type { EventStatus } from "@/lib/events/rules";
import { formatPrice } from "@/lib/money";
import { listEventProfits } from "@/lib/reports/admin";

export default function AdminDashboardPage() {
  return (
    <>
      <h1 className="text-5xl">Dashboard</h1>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  const access = await requireStaff("/admin");
  if (!access.allowed) return <NotAllowed access={access} />;

  const { user } = access;
  const canSeeMoney = can(user.staffRole, "payments.view");
  const today = ukToday();
  const upcoming = (await listEventProfits()).filter(
    (event) => daysBetween(today, toUkDateInput(event.endsAt)) >= 0,
  );

  return (
    <div className="mt-4 space-y-8">
      <p>
        Hello {user.fullName ?? user.email}. You&apos;re signed in as{" "}
        <strong>{ROLE_LABELS[user.staffRole].toLowerCase()}</strong>.
      </p>

      <section aria-labelledby="upcoming-heading" className="space-y-3">
        <h2 id="upcoming-heading" className="text-3xl">
          Upcoming events
        </h2>
        {upcoming.length === 0 ? (
          <Card>
            <p className="font-bold">There aren&apos;t any upcoming events.</p>
            <p className="mt-1">
              <Link href="/admin/events">Go to events</Link> to add one or copy
              last year&apos;s.
            </p>
          </Card>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {upcoming.map((event) => {
              const pastDue = daysBetween(event.balanceDueOn, today) > 0;
              return (
                <li key={event.id}>
                  <Card className="h-full space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-3xl">
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="text-ink no-underline hover:underline"
                        >
                          {event.title}
                        </Link>
                      </h3>
                      <StatusBadge status={event.status as EventStatus} />
                    </div>
                    <p>{formatUkDateRange(event.startsAt, event.endsAt)}</p>
                    <p className="text-lg">
                      <strong>
                        {event.profit.placesSold} of {event.capacity}
                      </strong>{" "}
                      places booked
                    </p>
                    {canSeeMoney ? (
                      <>
                        <p>
                          Received{" "}
                          <strong>
                            {formatPrice(event.profit.receivedPence)}
                          </strong>
                          , still owed{" "}
                          <strong>{formatPrice(event.profit.owedPence)}</strong>
                        </p>
                        {event.profit.owedPence > 0 ? (
                          <p
                            className={
                              pastDue ? "font-bold text-danger" : undefined
                            }
                          >
                            {pastDue
                              ? `Overdue: the balance was due by ${formatUkLongDate(event.balanceDueOn)}.`
                              : `Balance due by ${formatUkLongDate(event.balanceDueOn)}.`}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                      <Link href={`/admin/events/${event.id}/people`}>
                        People booked
                        <span className="sr-only"> on {event.title}</span>
                      </Link>
                      {canSeeMoney ? (
                        <Link href={`/admin/events/${event.id}/costs`}>
                          Profit and loss
                          <span className="sr-only"> for {event.title}</span>
                        </Link>
                      ) : null}
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card>
        <h2 className="text-3xl">Coming next</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Your B1, B2 and B3 emails sent from here, with balance reminders and
            chasers. These need the Resend email set-up in docs/setup.md first.
          </li>
          <li>Online booking with a deposit, and the waiting list.</li>
        </ul>
      </Card>

      <SignOutButton />
    </div>
  );
}
