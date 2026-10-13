import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getEventSheet } from "@/lib/bookings/admin";
import { cateringNumbers } from "@/lib/bookings/sheets";
import { toCsv } from "@/lib/csv";
import { isUuid } from "@/lib/validation/ids";

/** The catering sheet as a CSV file, for sending to the hotel. */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/events/[eventId]/catering/export">,
) {
  const { eventId } = await context.params;
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "bookings.view")) {
    return new Response("Please sign in with a team account.", { status: 403 });
  }
  if (!isUuid(eventId)) return new Response("Not found", { status: 404 });
  const sheet = await getEventSheet(eventId);
  if (!sheet) return new Response("Not found", { status: 404 });

  const numbers = cateringNumbers(sheet.people, sheet.options);
  const csv = toCsv([
    ["Numbers"],
    ["Option", "People"],
    ...numbers.byOption.map((option) => [option.name, option.count]),
    ["Total", numbers.total],
    [],
    ["Dietary needs"],
    ["Name", "Option", "Room", "Needs"],
    ...numbers.withNeeds.map((person) => [
      person.fullName,
      person.optionName,
      person.roomName,
      person.dietaryHealth,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${sheet.event.slug}-catering.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
