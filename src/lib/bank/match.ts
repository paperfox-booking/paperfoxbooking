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
  payments: { amountPence: number; receivedOn: string | null }[];
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
  /** True when that booking already has this payment recorded. */
  alreadyRecorded: boolean;
}

const REFERENCE = /\bPF[\s-]?(\d{4})[\s-]?(\d{4})\b/gi;

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
      why: `Reference ${booking.reference}`,
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
    const alreadyRecorded = Boolean(
      booking?.payments.some(
        (payment) =>
          payment.amountPence === line.amountPence &&
          payment.receivedOn === line.date,
      ),
    );
    return { line, candidates, suggested, alreadyRecorded };
  });
}
