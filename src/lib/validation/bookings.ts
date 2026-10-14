import { z } from "zod";
import { daysBetween } from "@/lib/dates";
import { formatPrice } from "@/lib/money";
import {
  checkbox,
  optionalPounds,
  optionalText,
  optionalWholeNumber,
  requiredDate,
  requiredPounds,
  requiredText,
} from "./form";

/**
 * The checks for people, bookings and payments: the spreadsheet screen's
 * cells, and the forms on a booking's page.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** An optional email address, stored in lower case. Empty means none. */
export const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "That email address is too long" })
  .refine((value) => value === "" || EMAIL.test(value), {
    error: "Enter an email address in the right format, like name@example.com",
  })
  .transform((value) => (value === "" ? null : value));

const optionalId = z
  .union([z.literal(""), z.uuid({ error: "Choose from the list" })])
  .transform((value) => (value === "" ? null : value));

// ---------------------------------------------------------------------------
// One cell on the spreadsheet screen
// ---------------------------------------------------------------------------

export const PERSON_CELLS = [
  "fullName",
  "email",
  "phone",
  "emergencyContact",
  "dietaryHealth",
  "isTeam",
] as const;
export const BOOKING_CELLS = [
  "optionId",
  "roomId",
  "notes",
  "paymentNotes",
] as const;
export type PersonCell = (typeof PERSON_CELLS)[number];
export type BookingCell = (typeof BOOKING_CELLS)[number];
export type Cell = PersonCell | BookingCell;

export function isCell(value: unknown): value is Cell {
  return (
    typeof value === "string" &&
    ([...PERSON_CELLS, ...BOOKING_CELLS] as string[]).includes(value)
  );
}

export const cellSchemas = {
  fullName: requiredText(200, "Enter their name"),
  email: optionalEmail,
  phone: optionalText(40),
  emergencyContact: optionalText(300),
  dietaryHealth: optionalText(1000),
  isTeam: z.enum(["true", "false"]).transform((value) => value === "true"),
  optionId: optionalId,
  roomId: optionalId,
  notes: optionalText(2000),
  paymentNotes: optionalText(2000),
} satisfies Record<Cell, z.ZodType>;

/** Database column for each cell. */
export const CELL_COLUMNS: Record<Cell, string> = {
  fullName: "full_name",
  email: "email",
  phone: "phone",
  emergencyContact: "emergency_contact",
  dietaryHealth: "dietary_health",
  isTeam: "is_team",
  optionId: "ticket_type_id",
  roomId: "room_id",
  notes: "notes",
  paymentNotes: "payment_notes",
};

// ---------------------------------------------------------------------------
// Adding someone to an event
// ---------------------------------------------------------------------------

export const ADD_PERSON_FIELDS = [
  "fullName",
  "email",
  "optionId",
  "roomId",
] as const;
export type AddPersonField = (typeof ADD_PERSON_FIELDS)[number];

export const addPersonSchema = z.object({
  fullName: requiredText(200, "Enter their name"),
  email: optionalEmail,
  optionId: optionalId,
  roomId: optionalId,
});

export const PASS_PLACE_FIELDS = ["fullName", "email", "reason"] as const;
export type PassPlaceField = (typeof PASS_PLACE_FIELDS)[number];

/** Passing a place to someone else, with Paper Fox's approval. */
export const passPlaceSchema = z.object({
  fullName: requiredText(200, "Enter the name of the person taking the place"),
  email: optionalEmail,
  reason: requiredText(
    300,
    "Say why, for example Approved by Nichola by email on 12 October",
  ),
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const PAYMENT_METHODS = ["bank_transfer", "cash", "other"] as const;
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  card: "Card",
  other: "Other",
};

export const PAYMENT_FIELDS = [
  "amount",
  "receivedOn",
  "method",
  "note",
] as const;
export type PaymentField = (typeof PAYMENT_FIELDS)[number];

export function paymentSchema(today: string) {
  return z.object({
    amount: requiredPounds("Enter the amount received, like 60").refine(
      (pence) => pence > 0,
      { error: "Enter an amount more than £0" },
    ),
    receivedOn: requiredDate("Enter the date the money arrived").refine(
      (date) => daysBetween(today, date) <= 0,
      { error: "The date can't be in the future" },
    ),
    method: z.enum(PAYMENT_METHODS, { error: "Choose how it was paid" }),
    note: optionalText(500),
  });
}

export const removePaymentSchema = z.object({
  reason: requiredText(
    500,
    "Say why it's being removed, for example Recorded twice",
  ),
});

// ---------------------------------------------------------------------------
// Refunds, made outside the system and recorded here
// ---------------------------------------------------------------------------

export const REFUND_FIELDS = [
  "amount",
  "refundedOn",
  "method",
  "reason",
] as const;
export type RefundField = (typeof REFUND_FIELDS)[number];

/** `mostPence` is what they've paid, less earlier refunds. */
export function refundSchema(today: string, mostPence: number) {
  return z.object({
    amount: requiredPounds("Enter the amount refunded, like 135")
      .refine((pence) => pence > 0, { error: "Enter an amount more than £0" })
      .refine((pence) => pence <= mostPence, {
        error:
          mostPence > 0
            ? `That's more than they've paid. The most you can refund is ${formatPrice(mostPence)}`
            : "They haven't paid anything that could be refunded",
      }),
    refundedOn: requiredDate("Enter the date the money was paid back").refine(
      (date) => daysBetween(today, date) <= 0,
      { error: "The date can't be in the future" },
    ),
    method: z.enum(PAYMENT_METHODS, { error: "Choose how it was paid back" }),
    reason: requiredText(
      500,
      "Say why, for example Cancelled more than 6 weeks before",
    ),
  });
}

export const removeRefundSchema = z.object({
  reason: requiredText(
    500,
    "Say why it's being removed, for example Recorded on the wrong booking",
  ),
});

// ---------------------------------------------------------------------------
// Emails sent outside the system
// ---------------------------------------------------------------------------

export const EMAIL_TEMPLATES = [
  "B1",
  "B2",
  "B3",
  "thanks",
  "balance_reminder",
  "class_kits",
  "joining",
  "cancelled",
  "refund",
  "other",
] as const;
export const EMAIL_TEMPLATE_LABELS: Record<
  (typeof EMAIL_TEMPLATES)[number],
  string
> = {
  B1: "B1: booking received",
  B2: "B2: deposit received",
  B3: "B3: paid in full",
  thanks: "Thanks for your payment",
  balance_reminder: "Balance reminder",
  class_kits: "Class kits",
  joining: "Joining details",
  cancelled: "Cancellation confirmation",
  refund: "Refund confirmation",
  other: "Other",
};

export const EMAIL_RECORD_FIELDS = ["template", "sentOn", "note"] as const;
export type EmailRecordField = (typeof EMAIL_RECORD_FIELDS)[number];

export function emailRecordSchema(today: string) {
  return z.object({
    template: z.enum(EMAIL_TEMPLATES, { error: "Choose which email" }),
    sentOn: requiredDate("Enter the date it was sent").refine(
      (date) => daysBetween(today, date) <= 0,
      { error: "The date can't be in the future" },
    ),
    note: optionalText(500),
  });
}

// ---------------------------------------------------------------------------
// A booking's price, cancelling, and a person's details
// ---------------------------------------------------------------------------

export const PRICE_FIELDS = ["price", "deposit", "reason"] as const;
export type PriceField = (typeof PRICE_FIELDS)[number];

export const priceSchema = z
  .object({
    price: requiredPounds("Enter the total they owe, like 195"),
    deposit: optionalPounds,
    reason: requiredText(
      300,
      "Say why the price is different, for example Returning customer discount",
    ),
  })
  .refine(
    (form) =>
      form.deposit === null || (form.deposit > 0 && form.deposit <= form.price),
    {
      path: ["deposit"],
      error:
        "The deposit must be more than £0 and no more than the total. Leave it empty if they pay in full.",
    },
  );

export const CANCEL_FIELDS = ["reason", "confirm"] as const;
export type CancelField = (typeof CANCEL_FIELDS)[number];

export const cancelSchema = z.object({
  reason: requiredText(500, "Say why the booking is being cancelled"),
  confirm: checkbox.refine((ticked) => ticked, {
    error: "Tick the box to confirm",
  }),
});

export const PERSON_FIELDS = [
  "fullName",
  "email",
  "phone",
  "emergencyContact",
  "dietaryHealth",
  "notes",
  "isTeam",
] as const;
export type PersonField = (typeof PERSON_FIELDS)[number];

export const personSchema = z.object({
  fullName: requiredText(200, "Enter their name"),
  email: optionalEmail,
  phone: optionalText(40),
  emergencyContact: optionalText(300),
  dietaryHealth: optionalText(1000),
  notes: optionalText(2000),
  isTeam: checkbox,
});

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const ROOM_FIELDS = ["name", "capacity", "notes"] as const;
export type RoomField = (typeof ROOM_FIELDS)[number];

export const roomSchema = z.object({
  name: requiredText(60, "Enter the room's name, like Main room"),
  capacity: optionalWholeNumber(1, 2000, "78"),
  notes: optionalText(300),
});

// ---------------------------------------------------------------------------
// One cell on the People list (everyone on file)
// ---------------------------------------------------------------------------

export const CUSTOMER_CELLS = [
  "fullName",
  "email",
  "phone",
  "emergencyContact",
  "dietaryHealth",
  "notes",
  "isTeam",
] as const;
export type CustomerCell = (typeof CUSTOMER_CELLS)[number];

export function isCustomerCell(value: unknown): value is CustomerCell {
  return (
    typeof value === "string" &&
    (CUSTOMER_CELLS as readonly string[]).includes(value)
  );
}

export const customerCellSchemas = {
  fullName: cellSchemas.fullName,
  email: cellSchemas.email,
  phone: cellSchemas.phone,
  emergencyContact: cellSchemas.emergencyContact,
  dietaryHealth: cellSchemas.dietaryHealth,
  notes: optionalText(2000),
  isTeam: cellSchemas.isTeam,
} satisfies Record<CustomerCell, z.ZodType>;

export const CUSTOMER_COLUMNS: Record<CustomerCell, string> = {
  fullName: "full_name",
  email: "email",
  phone: "phone",
  emergencyContact: "emergency_contact",
  dietaryHealth: "dietary_health",
  notes: "notes",
  isTeam: "is_team",
};
