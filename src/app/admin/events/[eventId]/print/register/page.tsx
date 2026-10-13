import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { can } from "@/lib/auth/permissions";
import { bookingMoney } from "@/lib/bookings/money";
import { formatUkFriendlyTime, ukToday } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import { loadSheet } from "../load";
import { SheetHeader } from "../sheet-header";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage(
  props: PageProps<"/admin/events/[eventId]/print/register">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Register params={props.params} />
    </Suspense>
  );
}

async function Register({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/print/register">, "params">) {
  const { eventId } = await params;
  const result = await loadSheet(
    eventId,
    `/admin/events/${eventId}/print/register`,
  );
  if (!result.allowed) return <NotAllowed access={result.access} />;
  const { event, options, people } = result.sheet;
  const money = can(result.access.user.staffRole, "payments.view");
  const today = ukToday();
  const start = new Map(
    options.map((option) => [
      option.id,
      option.startsAt ? formatUkFriendlyTime(option.startsAt) : option.name,
    ]),
  );

  return (
    <div>
      <SheetHeader
        eventId={event.id}
        title="Register"
        eventTitle={event.title}
        startsAt={event.starts_at}
        endsAt={event.ends_at}
      >
        <p>
          {people.length} people. Tick each person as they arrive.
          {money
            ? " To pay shows anything still owed, to collect on the day."
            : null}
        </p>
      </SheetHeader>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Everyone booked</caption>
        <thead>
          <tr className="border-b-2 border-ink">
            <th scope="col" className="w-12 py-1 pr-2">
              Here
            </th>
            <th scope="col" className="py-1 pr-2">
              Name
            </th>
            <th scope="col" className="py-1 pr-2">
              Starts
            </th>
            <th scope="col" className="py-1 pr-2">
              Room
            </th>
            <th scope="col" className="py-1 pr-2">
              Dietary and health
            </th>
            {money ? (
              <th scope="col" className="py-1 text-right">
                To pay
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {people.map((person) => {
            const owed = bookingMoney(
              {
                pricePence: person.pricePence,
                depositPence: person.depositPence,
                paidPence: person.paidPence,
                cancelled: false,
                balanceDueOn: event.balance_due_on,
              },
              today,
            ).balancePence;
            return (
              <tr
                key={person.bookingId}
                className="break-inside-avoid border-b border-stone"
              >
                <td className="py-2 pr-2">
                  <span
                    aria-hidden="true"
                    className="inline-block size-6 border-2 border-ink"
                  />
                </td>
                <th scope="row" className="py-2 pr-2 text-left font-bold">
                  {person.fullName}
                  {person.isTeam ? " (team)" : null}
                </th>
                <td className="py-2 pr-2">
                  {person.optionId ? (start.get(person.optionId) ?? "") : ""}
                </td>
                <td className="py-2 pr-2">{person.roomName}</td>
                <td className="py-2 pr-2">{person.dietaryHealth}</td>
                {money ? (
                  <td className="py-2 text-right">
                    {owed > 0 ? formatPrice(owed) : ""}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
