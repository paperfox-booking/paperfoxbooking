import { formatUkDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

/**
 * Turns audit log entries for a booking, its payments and its refunds into
 * plain English lines for the booking's History section.
 */

export interface AuditEntry {
  table_name: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  changed_at: string;
}

export interface HistoryNames {
  options: Map<string, string>;
  rooms: Map<string, string>;
}

const METHODS: Record<string, string> = {
  bank_transfer: "bank transfer",
  cash: "cash",
  card: "card",
  other: "other",
};

function money(value: unknown): string {
  return typeof value === "number" ? formatPrice(value) : "none";
}

function text(value: unknown): string {
  return typeof value === "string" && value.trim() ? `"${value}"` : "nothing";
}

const BOOKING_FIELDS: Record<
  string,
  (value: unknown, names: HistoryNames) => string
> = {
  price_pence: money,
  deposit_pence: money,
  ticket_type_id: (value, names) =>
    typeof value === "string"
      ? (names.options.get(value) ?? "another option")
      : "no option",
  room_id: (value, names) =>
    typeof value === "string"
      ? (names.rooms.get(value) ?? "another room")
      : "no room",
  price_note: text,
  notes: text,
  payment_notes: text,
};

const BOOKING_LABELS: Record<string, string> = {
  price_pence: "Total due",
  deposit_pence: "Deposit",
  ticket_type_id: "Option",
  room_id: "Room",
  price_note: "Price note",
  notes: "Notes",
  payment_notes: "Payment notes",
};

const SOURCES: Record<string, string> = {
  import: "imported from the spreadsheet",
  staff: "added by the team",
  online: "booked online",
};

export function describeChange(
  entry: AuditEntry,
  names: HistoryNames,
): string[] {
  const before = entry.old_values ?? {};
  const after = entry.new_values ?? {};

  if (entry.table_name === "payments") {
    const amount = money(after.amount_pence ?? before.amount_pence);
    if (entry.action === "insert") {
      const method = METHODS[String(after.method)] ?? "payment";
      const date =
        typeof after.received_on === "string"
          ? `, received ${formatUkDate(after.received_on)}`
          : "";
      return [`Payment of ${amount} recorded (${method}${date}).`];
    }
    if (!before.deleted_at && after.deleted_at) {
      return [`Payment of ${amount} removed: ${String(after.delete_reason)}.`];
    }
    return [];
  }

  if (entry.table_name === "refunds") {
    const amount = money(after.amount_pence ?? before.amount_pence);
    if (entry.action === "insert") {
      const method = METHODS[String(after.method)] ?? "refund";
      const date =
        typeof after.refunded_on === "string"
          ? `, paid back ${formatUkDate(after.refunded_on)}`
          : "";
      return [
        `Refund of ${amount} recorded (${method}${date}): ${String(after.reason)}.`,
      ];
    }
    if (!before.deleted_at && after.deleted_at) {
      return [`Refund of ${amount} removed: ${String(after.delete_reason)}.`];
    }
    return [];
  }

  if (entry.table_name === "bookings") {
    if (entry.action === "insert") {
      return [
        `Booked, ${SOURCES[String(after.source)] ?? "added"}, at ${money(after.price_pence)}.`,
      ];
    }
    const lines: string[] = [];
    if (!before.cancelled_at && after.cancelled_at) {
      lines.push(`Cancelled: ${String(after.cancel_reason)}.`);
    } else if (before.cancelled_at && !after.cancelled_at) {
      lines.push("Reinstated.");
    }
    for (const [field, describe] of Object.entries(BOOKING_FIELDS)) {
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
        lines.push(
          `${BOOKING_LABELS[field]} changed from ${describe(before[field], names)} to ${describe(after[field], names)}.`,
        );
      }
    }
    return lines;
  }
  return [];
}
