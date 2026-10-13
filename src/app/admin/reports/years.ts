import { formatInTimeZone } from "date-fns-tz";
import { UK_TIME_ZONE } from "@/lib/dates";

/** The UK year an event starts in, as text: "2027". */
export function eventYear(event: { startsAt: string }): string {
  return formatInTimeZone(event.startsAt, UK_TIME_ZONE, "yyyy");
}

/** Every year with an event, newest first. */
export function yearsOf(events: readonly { startsAt: string }[]): string[] {
  return [...new Set(events.map(eventYear))].sort().reverse();
}
