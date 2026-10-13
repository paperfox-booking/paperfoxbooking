import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Card } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { getDirectoryPerson, listPersonBookings } from "@/lib/bookings/admin";
import { PAYMENT_STATE_LABELS, bookingMoney } from "@/lib/bookings/money";
import { formatUkDate, ukToday } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { isUuid } from "@/lib/validation/ids";
import { PersonForm } from "./person-form";

export const metadata: Metadata = { title: "Person" };

export default function PersonPage(
  props: PageProps<"/admin/people/[customerId]">,
) {
  return (
    <>
      <p>
        <Link href="/admin/people">Back to people</Link>
      </p>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <Person params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Person({
  params,
  searchParams,
}: Pick<PageProps<"/admin/people/[customerId]">, "params" | "searchParams">) {
  const { customerId } = await params;
  const access = await requireStaff(
    `/admin/people/${customerId}`,
    "bookings.view",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(customerId)) notFound();

  const [person, bookings, { notice }] = await Promise.all([
    getDirectoryPerson(customerId),
    listPersonBookings(customerId),
    searchParams,
  ]);
  if (!person) notFound();
  const role = access.user.staffRole;
  const canEdit = can(role, "bookings.manage");
  const canSeeMoney = can(role, "payments.view");
  const today = ukToday();

  return (
    <div className="mt-2 max-w-5xl space-y-8">
      <div>
        <h1 className="text-5xl">{person.fullName}</h1>
        {person.isTeam ? (
          <p className="font-bold">On the Paper Fox team</p>
        ) : null}
        <PageNotice notice={notice} messages={{ saved: { text: "Saved." } }} />
      </div>

      <section aria-labelledby="bookings-heading" className="space-y-3">
        <h2 id="bookings-heading" className="text-3xl">
          Bookings
        </h2>
        {bookings.length === 0 ? (
          <p>No bookings yet.</p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {bookings.map((booking) => {
              const money = bookingMoney(
                {
                  pricePence: booking.pricePence,
                  depositPence: booking.depositPence,
                  paidPence: booking.paidPence,
                  cancelled: booking.cancelled,
                  balanceDueOn: booking.balanceDueOn,
                },
                today,
              );
              return (
                <li key={booking.bookingId}>
                  <Card className="h-full">
                    <h3 className="text-2xl">
                      <Link href={`/admin/bookings/${booking.bookingId}`}>
                        {booking.eventTitle}
                      </Link>
                    </h3>
                    <p className="text-stone">
                      {booking.reference}, {formatUkDate(booking.eventStartsAt)}
                    </p>
                    {canSeeMoney ? (
                      <p className="mt-1">
                        {PAYMENT_STATE_LABELS[money.state]}. Paid{" "}
                        {formatPrice(booking.paidPence)} of{" "}
                        {formatPrice(booking.pricePence)}
                        {money.balancePence > 0
                          ? `, ${formatPrice(money.balancePence)} to pay`
                          : null}
                        {money.overdue ? " (overdue)" : null}.
                      </p>
                    ) : booking.cancelled ? (
                      <p className="mt-1">Cancelled.</p>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="details-heading" className="space-y-3">
        <h2 id="details-heading" className="text-3xl">
          Details
        </h2>
        <Card>
          {canEdit ? (
            <PersonForm
              customerId={person.id}
              defaults={{
                fullName: person.fullName,
                email: person.email,
                phone: person.phone,
                emergencyContact: person.emergencyContact,
                dietaryHealth: person.dietaryHealth,
                notes: person.notes,
                isTeam: person.isTeam ? "on" : "",
              }}
            />
          ) : (
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
              <dt className="font-bold">Email</dt>
              <dd>{person.email || "None"}</dd>
              <dt className="font-bold">Mobile</dt>
              <dd>{person.phone || "None"}</dd>
              <dt className="font-bold">Emergency contact</dt>
              <dd>{person.emergencyContact || "None"}</dd>
              <dt className="font-bold">Dietary and health</dt>
              <dd>{person.dietaryHealth || "None"}</dd>
              <dt className="font-bold">Notes</dt>
              <dd>{person.notes || "None"}</dd>
            </dl>
          )}
        </Card>
      </section>
    </div>
  );
}
