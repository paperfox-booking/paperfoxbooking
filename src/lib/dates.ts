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

/** The UK calendar date of a moment, as a form value: "2027-03-19". */
export function toUkDateInput(value: DateInput): string {
  return formatInTimeZone(toDate(value), UK_TIME_ZONE, "yyyy-MM-dd");
}

/** The UK clock time of a moment, as a form value: "16:00". */
export function toUkTimeInput(value: DateInput): string {
  return formatInTimeZone(toDate(value), UK_TIME_ZONE, "HH:mm");
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isoDateToUtcMidnight(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Expected YYYY-MM-DD, got ${date}`);
  const [, year, month, day] = match.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Not a real date: ${date}`);
  }
  return time;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** True for a real calendar date written as YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  try {
    isoDateToUtcMidnight(value);
    return true;
  } catch {
    return false;
  }
}

/** Calendar arithmetic on dates like "2027-03-19", with no time zones involved. */
export function addDays(date: string, days: number): string {
  const time = isoDateToUtcMidnight(date) + days * DAY_MS;
  return new Date(time).toISOString().slice(0, 10);
}

/** Whole days from one calendar date to another (negative if earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (isoDateToUtcMidnight(to) - isoDateToUtcMidnight(from)) / DAY_MS,
  );
}

/**
 * The dates of an event in words, without repeating the month or year when
 * they're the same: "Friday 19 to Sunday 21 March 2027".
 */
export function formatUkDateRange(start: DateInput, end: DateInput): string {
  const from = toDate(start);
  const to = toDate(end);
  const sameYear =
    formatInTimeZone(from, UK_TIME_ZONE, "yyyy") ===
    formatInTimeZone(to, UK_TIME_ZONE, "yyyy");
  const sameMonth =
    sameYear &&
    formatInTimeZone(from, UK_TIME_ZONE, "MM") ===
      formatInTimeZone(to, UK_TIME_ZONE, "MM");
  const sameDay =
    sameMonth &&
    formatInTimeZone(from, UK_TIME_ZONE, "dd") ===
      formatInTimeZone(to, UK_TIME_ZONE, "dd");
  if (sameDay) return formatUkLongDate(from);
  const startPattern = sameMonth
    ? "EEEE d"
    : sameYear
      ? "EEEE d MMMM"
      : "EEEE d MMMM yyyy";
  return `${formatInTimeZone(from, UK_TIME_ZONE, startPattern)} to ${formatUkLongDate(to)}`;
}

/** "4pm", "9am" or "12:30pm", for friendly start times in sentences. */
export function formatUkFriendlyTime(value: DateInput): string {
  const date = toDate(value);
  const minutes = formatInTimeZone(date, UK_TIME_ZONE, "mm");
  return formatInTimeZone(
    date,
    UK_TIME_ZONE,
    minutes === "00" ? "haaa" : "h:mmaaa",
  );
}
