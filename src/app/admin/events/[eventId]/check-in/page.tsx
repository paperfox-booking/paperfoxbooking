import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { getEventSheet } from "@/lib/bookings/admin";
import { bookingMoney } from "@/lib/bookings/money";
import { formatUkDateRange, formatUkFriendlyTime, ukToday } from "@/lib/dates";
import { isUuid } from "@/lib/validation/ids";
import { CheckInList } from "./check-in-list";

export const metadata: Metadata = { title: "Check in" };

export default function CheckInPage(
  props: PageProps<"/admin/events/[eventId]/check-in">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CheckIn params={props.params} />
    </Suspense>
  );
}

async function CheckIn({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/check-in">, "params">) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/check-in`,
    "checkin.use",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();
  const sheet = await getEventSheet(eventId);
  if (!sheet) notFound();
  const { event, options, people } = sheet;
  const money = can(access.user.staffRole, "payments.view");
  const today = ukToday();
  const start = new Map(
    options.map((option) => [
      option.id,
      option.startsAt
        ? `${formatUkFriendlyTime(option.startsAt)} start`
        : option.name,
    ]),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p>
        <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
      </p>
      <div>
        <h1 className="text-5xl">Check in</h1>
        <p className="text-lg">
          {event.title}, {formatUkDateRange(event.starts_at, event.ends_at)}
        </p>
      </div>
      <CheckInList
        people={people.map((person) => ({
          bookingId: person.bookingId,
          fullName: person.fullName,
          isTeam: person.isTeam,
          start: person.optionId ? (start.get(person.optionId) ?? "") : "",
          roomName: person.roomName,
          dietaryHealth: person.dietaryHealth,
          owedPence: money
            ? Math.max(
                bookingMoney(
                  {
                    pricePence: person.pricePence,
                    depositPence: person.depositPence,
                    paidPence: person.paidPence,
                    cancelled: false,
                    balanceDueOn: event.balance_due_on,
                  },
                  today,
                ).balancePence,
                0,
              )
            : null,
          checkedInAt: person.checkedInAt,
        }))}
      />
    </div>
  );
}
