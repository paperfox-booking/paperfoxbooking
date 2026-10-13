/**
 * Money is always held as a whole number of pence. Never use floating point
 * pounds for sums: convert at the edges (display and form input) only.
 */

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const gbpWhole = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function assertPence(pence: number): void {
  if (!Number.isSafeInteger(pence)) {
    throw new TypeError(`Expected a whole number of pence, got ${pence}`);
  }
}

/** Formats pence as pounds, for example 19500 → "£195.00". */
export function formatPence(pence: number): string {
  assertPence(pence);
  return gbp.format(pence / 100);
}

/**
 * Formats pence for headline prices, dropping ".00" when it's a whole number
 * of pounds: 19500 → "£195", 19550 → "£195.50".
 */
export function formatPrice(pence: number): string {
  assertPence(pence);
  return pence % 100 === 0 ? gbpWhole.format(pence / 100) : formatPence(pence);
}

/**
 * Turns what someone typed ("195", "£1,234.5", "60.00") into pence without
 * going through floating point. Returns null if it isn't a valid amount.
 * Negative amounts aren't accepted: refunds are recorded as their own thing.
 */
export function parsePoundsToPence(input: string): number | null {
  const cleaned = input.trim().replace(/^£/, "").replace(/,/g, "").trim();
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const pounds = Number(match[1]);
  const pence = Number((match[2] ?? "").padEnd(2, "0"));
  return pounds * 100 + pence;
}

/** Adds up pence amounts, checking every one is a whole number. */
export function sumPence(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => {
    assertPence(amount);
    return total + amount;
  }, 0);
}

/**
 * Pence as pounds for a form field to start with, without a pound sign or
 * trailing ".00": 19500 → "195", 19550 → "195.50".
 */
export function penceToPoundsInput(pence: number): string {
  assertPence(pence);
  const sign = pence < 0 ? "-" : "";
  const absolute = Math.abs(pence);
  const pounds = Math.floor(absolute / 100);
  const rest = absolute % 100;
  return rest === 0
    ? `${sign}${pounds}`
    : `${sign}${pounds}.${String(rest).padStart(2, "0")}`;
}
