import { formatInTimeZone } from "date-fns-tz";
import { addDays, daysBetween, toUkDateInput, UK_TIME_ZONE } from "@/lib/dates";

/**
 * Paper Fox's money and date rules for events, in one place (CLAUDE.md
 * sections 6 and 15). Each rule is a default the team can change per event:
 * these functions only work out what to suggest and what's owed.
 */

/** The balance is due this many weeks before the event, unless changed. */
export const BALANCE_DUE_WEEKS_BEFORE = 6;

/** A place is held this many days waiting for its deposit, unless changed. */
export const DEFAULT_DEPOSIT_HOLD_DAYS = 7;

/**
 * The suggested balance due date for an event starting at this moment:
 * 6 weeks before the UK date it starts. Returns "YYYY-MM-DD".
 */
export function defaultBalanceDueOn(startsAt: Date | string): string {
  return addDays(toUkDateInput(startsAt), -7 * BALANCE_DUE_WEEKS_BEFORE);
}

export interface OptionPrice {
  pricePence: number;
  /** Null means no deposit: pay in full. */
  depositPence: number | null;
}

export type PaymentPlan =
  | {
      kind: "deposit";
      payNowPence: number;
      balancePence: number;
      balanceDueOn: string;
    }
  | {
      kind: "full";
      payNowPence: number;
      reason: "no_deposit" | "balance_already_due";
    };

/**
 * What someone pays to book one place on this option, booking on `bookedOn`
 * (a UK date, "YYYY-MM-DD"). Booking on or after the balance due date means
 * paying in full straight away.
 */
export function paymentPlan(
  option: OptionPrice,
  balanceDueOn: string,
  bookedOn: string,
): PaymentPlan {
  if (option.depositPence === null) {
    return {
      kind: "full",
      payNowPence: option.pricePence,
      reason: "no_deposit",
    };
  }
  if (daysBetween(bookedOn, balanceDueOn) <= 0) {
    return {
      kind: "full",
      payNowPence: option.pricePence,
      reason: "balance_already_due",
    };
  }
  return {
    kind: "deposit",
    payNowPence: option.depositPence,
    balancePence: option.pricePence - option.depositPence,
    balanceDueOn,
  };
}

/** What's left to pay after the deposit. */
export function balanceAfterDeposit(option: OptionPrice): number {
  return option.depositPence === null
    ? 0
    : option.pricePence - option.depositPence;
}

/** The cheapest price, for "From £195" on the events list. */
export function lowestPrice(
  options: readonly { pricePence: number }[],
): number | null {
  if (options.length === 0) return null;
  return Math.min(...options.map((option) => option.pricePence));
}

/**
 * When copying an event, the suggested new start date: the same weekday
 * 52 weeks on, so a Friday stays a Friday ("2027-03-19" → "2028-03-17").
 */
export function suggestedCopyStart(startsAt: Date | string): string {
  return addDays(toUkDateInput(startsAt), 52 * 7);
}

/**
 * When copying an event, the suggested new title: the old title with its
 * month and year moved on to match the new date. "Coventry Crop Weekend
 * March 2027" copied to June 2027 becomes "Coventry Crop Weekend June 2027".
 */
export function suggestedCopyTitle(
  title: string,
  oldStartsAt: Date | string,
  newStartsOn: string,
): string {
  const newStart = `${newStartsOn}T12:00:00Z`;
  const oldMonth = formatInTimeZone(oldStartsAt, UK_TIME_ZONE, "MMMM");
  const oldYear = formatInTimeZone(oldStartsAt, UK_TIME_ZONE, "yyyy");
  const newMonth = formatInTimeZone(newStart, UK_TIME_ZONE, "MMMM");
  const newYear = formatInTimeZone(newStart, UK_TIME_ZONE, "yyyy");
  return title
    .replace(new RegExp(`\\b${oldMonth}\\b`, "g"), newMonth)
    .replace(new RegExp(`\\b${oldYear}\\b`, "g"), newYear);
}

/**
 * How long before the event a date is, in words: "6 weeks", "7 weeks and
 * 3 days", "10 days", "1 day".
 */
export function describeTimeBefore(days: number): string {
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  const dayWords = (count: number) => (count === 1 ? "1 day" : `${count} days`);
  if (weeks < 2) return dayWords(days);
  const weekWords = `${weeks} weeks`;
  return rest === 0 ? weekWords : `${weekWords} and ${dayWords(rest)}`;
}

export type EventStatus =
  "draft" | "published" | "sold_out" | "cancelled" | "finished";

export type PublicAvailability =
  | { kind: "open" }
  | { kind: "not_open_yet"; opensAt: string }
  | { kind: "closed" }
  | { kind: "sold_out" }
  | { kind: "cancelled" }
  | { kind: "finished" };

/** Whether people can book this event at this moment, and if not, why not. */
export function availability(
  event: {
    status: EventStatus;
    endsAt: string;
    bookingOpensAt: string | null;
    bookingClosesAt: string | null;
  },
  now: Date,
): PublicAvailability {
  if (event.status === "cancelled") return { kind: "cancelled" };
  if (event.status === "finished" || new Date(event.endsAt) <= now) {
    return { kind: "finished" };
  }
  if (event.status === "sold_out") return { kind: "sold_out" };
  if (event.bookingOpensAt && new Date(event.bookingOpensAt) > now) {
    return { kind: "not_open_yet", opensAt: event.bookingOpensAt };
  }
  if (event.bookingClosesAt && new Date(event.bookingClosesAt) <= now) {
    return { kind: "closed" };
  }
  return { kind: "open" };
}

export const STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  published: "Published",
  sold_out: "Sold out",
  cancelled: "Cancelled",
  finished: "Finished",
};
