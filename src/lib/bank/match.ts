import { daysBetween, formatUkDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import type { StatementLine } from "./statement";

/**
 * Suggests which booking each payment on a bank statement is for:
 *   - a booking reference in the description (PF-2027-0001, or written
 *     "PF 2027 0001" or "PF20270001") is a sure match;
 *   - otherwise names: the surname must appear, and the first name (or its
 *     first letter) makes it more likely;
 *   - an amount that's exactly the deposit or balance owed helps too.
 * Staff always check the suggestions before anything is recorded.
 * Safe to use in the browser and on the server.
 */

export interface MatchBooking {
  bookingId: string;
  reference: string;
  fullName: string;
  eventTitle: string;
  /** Still to pay towards the deposit. */
  depositOwedPence: number;
  /** Still to pay in total. */
  balancePence: number;
  /** Payments already recorded, to spot ones already entered. */
  payments: {
    amountPence: number;
    /** When it arrived, or null for a total brought in from a spreadsheet. */
    receivedOn: string | null;
    /** The UK date it was recorded in the system. */
    recordedOn: string;
  }[];
}

export interface Candidate {
  bookingId: string;
  score: number;
  why: string;
}

export interface LineMatch {
  line: StatementLine;
  /** Best first. */
  candidates: Candidate[];
  /** The booking to suggest, when the match is clear. */
  suggested: string | null;
  /** Why the suggested booking may already have this payment, if it may. */
  duplicate: string | null;
}

/** How far apart the bank's date and the date typed in can be. */
const SAME_PAYMENT_DAYS = 7;

/**
 * Why this booking may already have this payment recorded, or null. A
 * payment typed in with the Pay box is dated the day it was typed, which
 * can be a few days after the bank's date; and a total brought in from a
 * spreadsheet has no date at all, so anything paid before it was brought in
 * may already be in it.
 */
export function likelyDuplicate(
  line: StatementLine,
  booking: MatchBooking,
): string | null {
  for (const payment of booking.payments) {
    if (
      payment.receivedOn &&
      payment.amountPence === line.amountPence &&
      Math.abs(daysBetween(payment.receivedOn, line.date)) <= SAME_PAYMENT_DAYS
    ) {
      return `${booking.fullName} already has a payment of ${formatPrice(payment.amountPence)} on ${formatUkDate(`${payment.receivedOn}T12:00:00Z`)}, so this may be the same one.`;
    }
    if (
      !payment.receivedOn &&
      daysBetween(line.date, payment.recordedOn) >= 0
    ) {
      return `${booking.fullName}'s total brought in from the spreadsheet on ${formatUkDate(`${payment.recordedOn}T12:00:00Z`)} may already include this.`;
    }
  }
  return null;
}

// Also when run into other text, like "PF20270001JSMITH".
const REFERENCE = /(?<![A-Z0-9])PF[\s-]?(\d{4})[\s-]?(\d{4})(?!\d)/gi;

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9']+/)
    .map((word) => word.replace(/'/g, ""))
    .filter(Boolean);
}

/** "Jo Anne O'Brien-Smith" → first "jo", surnames ["obrien", "smith", "obriensmith"]. */
function nameParts(fullName: string): { first: string; surnames: string[] } {
  const parts = fullName.trim().split(/\s+/);
  const first = words(parts[0] ?? "")[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]! : "";
  const pieces = words(last);
  const joined = pieces.join("");
  return {
    first,
    surnames: [...new Set([...pieces, joined])].filter(
      (piece) => piece.length >= 2,
    ),
  };
}

function scoreBooking(
  line: StatementLine,
  booking: MatchBooking,
  references: Set<string>,
  descriptionWords: Set<string>,
): Candidate | null {
  if (references.has(booking.reference.toUpperCase())) {
    return {
      bookingId: booking.bookingId,
      score: 100,
      why: "Reference on the statement",
    };
  }
  const { first, surnames } = nameParts(booking.fullName);
  if (!surnames.some((surname) => descriptionWords.has(surname))) return null;
  let score = 40;
  const reasons = ["surname"];
  if (first && descriptionWords.has(first)) {
    score += 30;
    reasons.push("first name");
  } else if (first && descriptionWords.has(first[0]!)) {
    score += 10;
    reasons.push("initial");
  }
  if (
    line.amountPence === booking.depositOwedPence ||
    line.amountPence === booking.balancePence
  ) {
    score += 20;
    reasons.push("amount owed");
  }
  return {
    bookingId: booking.bookingId,
    score,
    why: `Matches ${reasons.join(", ")}`,
  };
}

export function matchStatement(
  lines: readonly StatementLine[],
  bookings: readonly MatchBooking[],
): LineMatch[] {
  return lines.map((line) => {
    const references = new Set(
      [...line.description.matchAll(REFERENCE)].map(
        (match) => `PF-${match[1]}-${match[2]}`,
      ),
    );
    const descriptionWords = new Set(words(line.description));
    const candidates = bookings
      .map((booking) =>
        scoreBooking(line, booking, references, descriptionWords),
      )
      .filter((candidate): candidate is Candidate => candidate !== null)
      .sort((a, b) => b.score - a.score);

    const [best, second] = candidates;
    const clear =
      best !== undefined &&
      (best.score >= 100 ||
        (best.score >= 70 &&
          (second === undefined || second.score < best.score)));
    const suggested = clear ? best.bookingId : null;
    const booking = bookings.find((item) => item.bookingId === suggested);
    const duplicate = booking ? likelyDuplicate(line, booking) : null;
    return { line, candidates, suggested, duplicate };
  });
}
