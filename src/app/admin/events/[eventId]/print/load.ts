import "server-only";
import { notFound } from "next/navigation";
import { requireStaff, type StaffAccess } from "@/lib/auth/session";
import { getEventSheet, type EventSheet } from "@/lib/bookings/admin";
import { isUuid } from "@/lib/validation/ids";

/** Checks the person may see who's booked, then loads the event's sheet. */
export async function loadSheet(
  eventId: string,
  path: string,
): Promise<
  | { allowed: false; access: Extract<StaffAccess, { allowed: false }> }
  | {
      allowed: true;
      access: Extract<StaffAccess, { allowed: true }>;
      sheet: EventSheet;
    }
> {
  const access = await requireStaff(path, "bookings.view");
  if (!access.allowed) return { allowed: false, access };
  if (!isUuid(eventId)) notFound();
  const sheet = await getEventSheet(eventId);
  if (!sheet) notFound();
  return { allowed: true, access, sheet };
}
