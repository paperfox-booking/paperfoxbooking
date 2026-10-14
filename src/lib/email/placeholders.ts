/**
 * The {{placeholders}} the email wording can use. Each is filled in from the
 * booking the email is about. This file is safe to use in the browser, so the
 * wording editor can list them.
 */
export const PLACEHOLDERS = [
  { name: "first_name", description: "Their first name, for example Jo" },
  { name: "full_name", description: "Their full name" },
  {
    name: "reference",
    description: "Their booking reference, for example PF-2027-0001",
  },
  {
    name: "event",
    description: "The event's name, for example Crop Weekend March 2027",
  },
  {
    name: "event_dates",
    description: "For example Friday 19 to Sunday 21 March 2027",
  },
  { name: "venue", description: "The venue's name" },
  {
    name: "option",
    description: "What they booked, for example Weekend (4pm start)",
  },
  {
    name: "prices",
    description: "A list of the event's options, with prices and deposits",
  },
  { name: "total", description: "What their place costs in total" },
  { name: "deposit", description: "Their deposit" },
  { name: "paid", description: "What they've paid so far" },
  { name: "balance", description: "What they still owe" },
  {
    name: "deposit_due_by",
    description:
      "When their place is held until, if the deposit hasn't arrived",
  },
  { name: "balance_due_on", description: "The event's balance due date" },
  {
    name: "amount_received",
    description: "The payment just received (for payment emails)",
  },
  { name: "received_on", description: "The date that payment arrived" },
  {
    name: "amount_refunded",
    description: "Their latest refund (for the refund email)",
  },
  { name: "refunded_on", description: "The date that refund was paid back" },
  {
    name: "bank_details",
    description: "Paper Fox's bank details, with their reference to use",
  },
  { name: "facebook_group", description: "The event's private Facebook group" },
  {
    name: "class_kits_info",
    description:
      "The event's Class kits box: the kits, prices and how to order",
  },
  {
    name: "joining_info",
    description:
      "The event's Joining details box: arrival, timetable and so on",
  },
  {
    name: "sign_off",
    description: "Who the email is from, for example Nichola & Morag",
  },
] as const;

export type PlaceholderName = (typeof PLACEHOLDERS)[number]["name"];
export type PlaceholderValues = Record<PlaceholderName, string>;

const KNOWN = new Set<string>(
  PLACEHOLDERS.map((placeholder) => placeholder.name),
);
const PATTERN = /\{\{\s*([a-z_]+)\s*\}\}/g;

export interface FilledText {
  text: string;
  /** Placeholders that don't exist, probably typing mistakes. */
  unknown: string[];
  /** Placeholders that exist but had nothing to fill them with. */
  empty: string[];
}

/** Fills in {{placeholders}}. Unknown ones are left as they are, and listed. */
export function fillPlaceholders(
  text: string,
  values: Partial<PlaceholderValues>,
): FilledText {
  const unknown = new Set<string>();
  const empty = new Set<string>();
  const filled = text.replace(PATTERN, (match, name: string) => {
    if (!KNOWN.has(name)) {
      unknown.add(name);
      return match;
    }
    const value = values[name as PlaceholderName] ?? "";
    if (!value) empty.add(name);
    return value;
  });
  return { text: filled, unknown: [...unknown], empty: [...empty] };
}
