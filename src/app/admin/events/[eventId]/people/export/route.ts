import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { listEventPeople, listRooms } from "@/lib/bookings/admin";
import { bookingMoney } from "@/lib/bookings/money";
import { toCsv } from "@/lib/csv";
import { formatUkDate, ukToday } from "@/lib/dates";
import { getEvent } from "@/lib/events/admin";
import { penceToPoundsInput } from "@/lib/money";
import { EMAIL_TEMPLATE_LABELS } from "@/lib/validation/bookings";
import { isUuid } from "@/lib/validation/ids";

/**
 * Everyone booked on an event as a CSV file, for printing or Excel. Money
 * columns are only included for people who may see payments.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/events/[eventId]/people/export">,
) {
  const { eventId } = await context.params;
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "bookings.view")) {
    return new Response("Please sign in with a team account.", {
      status: 403,
    });
  }
  if (!isUuid(eventId)) return new Response("Not found", { status: 404 });

  const [event, people, rooms] = await Promise.all([
    getEvent(eventId),
    listEventPeople(eventId),
    listRooms(eventId),
  ]);
  if (!event) return new Response("Not found", { status: 404 });

  const money = can(user.staffRole, "payments.view");
  const today = ukToday();
  const optionName = new Map(
    event.options.map((option) => [option.id, option.name]),
  );
  const roomName = new Map(rooms.map((room) => [room.id, room.name]));

  const header = [
    "Reference",
    "Name",
    "Team",
    "Email",
    "Option",
    "Room",
    "Dietary and health",
    ...(money
      ? ["Total due (£)", "Received (£)", "Balance (£)", "Overdue"]
      : []),
    "Mobile",
    "Emergency contact",
    "Notes",
    ...(money ? ["Payment notes", "Last email", "Last email sent"] : []),
    "Cancelled",
  ];
  const rows = people.map((person) => {
    const owed = bookingMoney(
      {
        pricePence: person.pricePence,
        depositPence: person.depositPence,
        paidPence: person.paidPence,
        cancelled: person.cancelled,
        balanceDueOn: event.balance_due_on,
      },
      today,
    );
    return [
      person.reference,
      person.fullName,
      person.isTeam,
      person.email,
      optionName.get(person.optionId) ?? "",
      roomName.get(person.roomId) ?? "",
      person.dietaryHealth,
      ...(money
        ? [
            penceToPoundsInput(person.pricePence),
            penceToPoundsInput(person.paidPence),
            penceToPoundsInput(owed.balancePence),
            owed.overdue,
          ]
        : []),
      person.phone,
      person.emergencyContact,
      person.notes,
      ...(money
        ? [
            person.paymentNotes,
            person.lastEmail
              ? EMAIL_TEMPLATE_LABELS[person.lastEmail.template]
              : "",
            person.lastEmail?.sentOn
              ? formatUkDate(person.lastEmail.sentOn)
              : "",
          ]
        : []),
      person.cancelled,
    ];
  });

  return new Response(toCsv([header, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-people.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
