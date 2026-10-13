import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Dates are stored in UTC and always shown in UK time, whatever the server's
 * or the visitor's own time zone. UI dates look like 31/12/2027, and times use
 * the 24 hour clock.
 */
export const UK_TIME_ZONE = "Europe/London";

type DateInput = Date | string;

function toDate(value: DateInput): Date {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid date: ${String(value)}`);
  }
  return date;
}

/** 31/12/2027 */
export function formatUkDate(value: DateInput): string {
  return formatInTimeZone(toDate(value), UK_TIME_ZONE, "dd/MM/yyyy");
}

/** 16:00 */
export function formatUkTime(value: DateInput): string {
  return formatInTimeZone(toDate(value), UK_TIME_ZONE, "HH:mm");
}

/** 31/12/2027 16:00 */
export function formatUkDateTime(value: DateInput): string {
  return formatInTimeZone(toDate(value), UK_TIME_ZONE, "dd/MM/yyyy HH:mm");
}

/** Friday 19 March 2027, for headings and emails. */
export function formatUkLongDate(value: DateInput): string {
  return formatInTimeZone(toDate(value), UK_TIME_ZONE, "EEEE d MMMM yyyy");
}

/**
 * Turns a UK wall clock date and time from a form ("2027-03-19" and "16:00")
 * into the exact moment in UTC, taking British Summer Time into account.
 */
export function ukDateTimeToUtc(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new RangeError(`Expected YYYY-MM-DD and HH:mm, got ${date} ${time}`);
  }
  return fromZonedTime(`${date}T${time}:00`, UK_TIME_ZONE);
}
