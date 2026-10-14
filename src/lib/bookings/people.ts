import type { EmailTemplate } from "@/lib/import/booking-sheet";
import { netPaid } from "./money";

/**
 * One person's row on the spreadsheet screen, and the order rows go in.
 * Safe to use in the browser and on the server.
 */

export interface PersonRow {
  bookingId: string;
  reference: string;
  customerId: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContact: string;
  dietaryHealth: string;
  isTeam: boolean;
  optionId: string;
  roomId: string;
  pricePence: number;
  depositPence: number | null;
  priceNote: string;
  notes: string;
  paymentNotes: string;
  cancelled: boolean;
  /** Paid, less anything refunded. */
  paidPence: number;
  /** When they arrived at the event, if they have. */
  checkedInAt: string | null;
  lastEmail: { template: EmailTemplate; sentOn: string | null } | null;
}

export type BookingSelect = {
  id: string;
  reference: string;
  ticket_type_id: string | null;
  room_id: string | null;
  price_pence: number;
  deposit_pence: number | null;
  price_note: string;
  notes: string;
  payment_notes: string;
  cancelled_at: string | null;
  checked_in_at: string | null;
  customer: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string;
    emergency_contact: string;
    dietary_health: string;
    is_team: boolean;
  } | null;
  payments: { amount_pence: number; deleted_at: string | null }[];
  refunds: { amount_pence: number; deleted_at: string | null }[];
  email_log: {
    template: string;
    sent_on: string | null;
    created_at: string;
    status: string;
    customer_id: string | null;
  }[];
};

export function toPersonRow(booking: BookingSelect): PersonRow {
  const customer = booking.customer;
  const latest = booking.email_log
    // Failed sends, and test sends to the test address, don't count; nor do
    // emails to someone who had this place before it was passed on.
    .filter(
      (email) =>
        email.status !== "failed" &&
        email.status !== "test" &&
        (email.customer_id === null || email.customer_id === customer?.id),
    )
    .sort((a, b) =>
      `${b.sent_on ?? ""}${b.created_at}`.localeCompare(
        `${a.sent_on ?? ""}${a.created_at}`,
      ),
    )[0];
  return {
    bookingId: booking.id,
    reference: booking.reference,
    customerId: customer?.id ?? "",
    fullName: customer?.full_name ?? "",
    email: customer?.email ?? "",
    phone: customer?.phone ?? "",
    emergencyContact: customer?.emergency_contact ?? "",
    dietaryHealth: customer?.dietary_health ?? "",
    isTeam: customer?.is_team ?? false,
    optionId: booking.ticket_type_id ?? "",
    roomId: booking.room_id ?? "",
    pricePence: booking.price_pence,
    depositPence: booking.deposit_pence,
    priceNote: booking.price_note,
    notes: booking.notes,
    paymentNotes: booking.payment_notes,
    cancelled: booking.cancelled_at !== null,
    paidPence: netPaid(booking.payments, booking.refunds),
    checkedInAt: booking.checked_in_at,
    lastEmail: latest
      ? { template: latest.template as EmailTemplate, sentOn: latest.sent_on }
      : null,
  };
}

/** Team first, then everyone else by name, as on the spreadsheet. */
export function comparePeople(
  a: Pick<PersonRow, "isTeam" | "fullName">,
  b: Pick<PersonRow, "isTeam" | "fullName">,
): number {
  if (a.isTeam !== b.isTeam) return a.isTeam ? -1 : 1;
  return a.fullName.localeCompare(b.fullName, "en-GB", {
    sensitivity: "base",
  });
}
