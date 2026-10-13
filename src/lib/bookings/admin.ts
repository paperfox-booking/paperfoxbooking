import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuditEntry } from "./history";
import { comparePeople, toPersonRow, type PersonRow } from "./people";

export type { PersonRow } from "./people";

/**
 * Reads people and bookings for the admin area, as the signed-in team member
 * (row level security applies: door staff get no payments or emails back).
 * Call only after checking the person is on the team.
 */

export interface RoomRecord {
  id: string;
  name: string;
  capacity: number | null;
  notes: string;
  sortOrder: number;
}

const BOOKING_COLUMNS = `
  id, reference, ticket_type_id, room_id, price_pence, deposit_pence,
  price_note, notes, payment_notes, cancelled_at,
  customer:customers(id, full_name, email, phone, emergency_contact, dietary_health, is_team),
  payments(amount_pence, deleted_at),
  email_log(template, sent_on, created_at)
`;

export async function listEventPeople(eventId: string): Promise<PersonRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("event_id", eventId);
  if (error) throw new Error(`Couldn't load the bookings: ${error.message}`);
  return data.map(toPersonRow).sort(comparePeople);
}

export async function getPersonRow(
  bookingId: string,
): Promise<PersonRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the booking: ${error.message}`);
  return data ? toPersonRow(data) : null;
}

export async function listRooms(eventId: string): Promise<RoomRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_rooms")
    .select("id, name, capacity, notes, sort_order")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("name");
  if (error) throw new Error(`Couldn't load the rooms: ${error.message}`);
  return data.map((room) => ({
    id: room.id,
    name: room.name,
    capacity: room.capacity,
    notes: room.notes,
    sortOrder: room.sort_order,
  }));
}

export interface KnownPerson {
  id: string;
  fullName: string;
  email: string;
}

/** Everyone on file, for "someone who's been before" suggestions. */
export async function listKnownPeople(): Promise<KnownPerson[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, email")
    .is("deleted_at", null)
    .order("full_name")
    .limit(5000);
  if (error) throw new Error(`Couldn't load people: ${error.message}`);
  return data.map((person) => ({
    id: person.id,
    fullName: person.full_name,
    email: person.email ?? "",
  }));
}

export interface BookingDetail {
  id: string;
  reference: string;
  pricePence: number;
  depositPence: number | null;
  priceNote: string;
  notes: string;
  paymentNotes: string;
  source: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string;
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    balanceDueOn: string;
  };
  customer: { id: string; fullName: string; email: string; phone: string };
  optionId: string | null;
  roomId: string | null;
  payments: {
    id: string;
    amountPence: number;
    method: string;
    receivedOn: string | null;
    note: string;
    recordedBy: string | null;
    deletedAt: string | null;
    deleteReason: string;
  }[];
  emails: {
    id: string;
    template: string;
    sentOn: string | null;
    note: string;
    outsideSystem: boolean;
    createdBy: string | null;
  }[];
  history: (AuditEntry & { changedBy: string | null })[];
  /** Team members' names, for "recorded by" and the history. */
  people: Map<string, string>;
}

export async function getBookingDetail(
  bookingId: string,
): Promise<BookingDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      `id, reference, price_pence, deposit_pence, price_note, notes, payment_notes,
       source, created_at, cancelled_at, cancel_reason, ticket_type_id, room_id,
       event:events(id, title, starts_at, ends_at, balance_due_on),
       customer:customers(id, full_name, email, phone),
       payments(id, amount_pence, method, received_on, note, recorded_by, deleted_at, delete_reason, created_at),
       email_log(id, template, sent_on, note, outside_system, created_by, created_at)`,
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the booking: ${error.message}`);
  if (!booking || !booking.event || !booking.customer) return null;

  const paymentIds = booking.payments.map((payment) => payment.id);
  const { data: audit } = await supabase
    .from("audit_log")
    .select(
      "table_name, action, old_values, new_values, changed_at, changed_by",
    )
    .or(
      `and(table_name.eq.bookings,record_id.eq.${booking.id})${
        paymentIds.length
          ? `,and(table_name.eq.payments,record_id.in.(${paymentIds.join(",")}))`
          : ""
      }`,
    )
    .order("changed_at", { ascending: false })
    .limit(200);

  const staffIds = [
    ...booking.payments.map((payment) => payment.recorded_by),
    ...booking.email_log.map((email) => email.created_by),
    ...(audit ?? []).map((entry) => entry.changed_by),
  ].filter((id): id is string => Boolean(id));
  const { data: profiles } = staffIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...new Set(staffIds)])
    : { data: [] };

  return {
    id: booking.id,
    reference: booking.reference,
    pricePence: booking.price_pence,
    depositPence: booking.deposit_pence,
    priceNote: booking.price_note,
    notes: booking.notes,
    paymentNotes: booking.payment_notes,
    source: booking.source,
    createdAt: booking.created_at,
    cancelledAt: booking.cancelled_at,
    cancelReason: booking.cancel_reason,
    event: {
      id: booking.event.id,
      title: booking.event.title,
      startsAt: booking.event.starts_at,
      endsAt: booking.event.ends_at,
      balanceDueOn: booking.event.balance_due_on,
    },
    customer: {
      id: booking.customer.id,
      fullName: booking.customer.full_name,
      email: booking.customer.email ?? "",
      phone: booking.customer.phone,
    },
    optionId: booking.ticket_type_id,
    roomId: booking.room_id,
    payments: [...booking.payments]
      .sort((a, b) =>
        `${a.received_on ?? ""}${a.created_at}`.localeCompare(
          `${b.received_on ?? ""}${b.created_at}`,
        ),
      )
      .map((payment) => ({
        id: payment.id,
        amountPence: payment.amount_pence,
        method: payment.method,
        receivedOn: payment.received_on,
        note: payment.note,
        recordedBy: payment.recorded_by,
        deletedAt: payment.deleted_at,
        deleteReason: payment.delete_reason,
      })),
    emails: [...booking.email_log]
      .sort((a, b) =>
        `${b.sent_on ?? ""}${b.created_at}`.localeCompare(
          `${a.sent_on ?? ""}${a.created_at}`,
        ),
      )
      .map((email) => ({
        id: email.id,
        template: email.template,
        sentOn: email.sent_on,
        note: email.note,
        outsideSystem: email.outside_system,
        createdBy: email.created_by,
      })),
    history: (audit ?? []).map((entry) => ({
      table_name: entry.table_name,
      action: entry.action,
      old_values: entry.old_values as Record<string, unknown> | null,
      new_values: entry.new_values as Record<string, unknown> | null,
      changed_at: entry.changed_at,
      changedBy: entry.changed_by,
    })),
    people: new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile.full_name || profile.email,
      ]),
    ),
  };
}

export interface DirectoryPerson {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emergencyContact: string;
  dietaryHealth: string;
  notes: string;
  isTeam: boolean;
  /** Events they're booked on (not cancelled), soonest first. */
  events: { id: string; title: string; startsAt: string }[];
}

export function toDirectoryPerson(customer: {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  emergency_contact: string;
  dietary_health: string;
  notes: string;
  is_team: boolean;
  bookings: {
    cancelled_at: string | null;
    event: { id: string; title: string; starts_at: string } | null;
  }[];
}): DirectoryPerson {
  return {
    id: customer.id,
    fullName: customer.full_name,
    email: customer.email ?? "",
    phone: customer.phone,
    emergencyContact: customer.emergency_contact,
    dietaryHealth: customer.dietary_health,
    notes: customer.notes,
    isTeam: customer.is_team,
    events: customer.bookings
      .filter((booking) => !booking.cancelled_at && booking.event)
      .map((booking) => ({
        id: booking.event!.id,
        title: booking.event!.title,
        startsAt: booking.event!.starts_at,
      }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  };
}

const DIRECTORY_COLUMNS = `
  id, full_name, email, phone, emergency_contact, dietary_health, notes, is_team,
  bookings(cancelled_at, event:events(id, title, starts_at))
`;

/** Everyone on file, the team first and then by name. */
export async function listDirectory(): Promise<DirectoryPerson[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select(DIRECTORY_COLUMNS)
    .is("deleted_at", null)
    .limit(5000);
  if (error) throw new Error(`Couldn't load people: ${error.message}`);
  return data.map(toDirectoryPerson).sort(comparePeople);
}

export async function getDirectoryPerson(
  customerId: string,
): Promise<DirectoryPerson | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select(DIRECTORY_COLUMNS)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the person: ${error.message}`);
  return data ? toDirectoryPerson(data) : null;
}

/** Someone's bookings across every event, newest event first. */
export async function listPersonBookings(customerId: string): Promise<
  (PersonRow & {
    eventId: string;
    eventTitle: string;
    eventStartsAt: string;
    balanceDueOn: string;
  })[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `${BOOKING_COLUMNS}, event:events(id, title, starts_at, balance_due_on)`,
    )
    .eq("customer_id", customerId);
  if (error) throw new Error(`Couldn't load their bookings: ${error.message}`);
  return data
    .filter((booking) => booking.event)
    .map((booking) => ({
      ...toPersonRow(booking),
      eventId: booking.event!.id,
      eventTitle: booking.event!.title,
      eventStartsAt: booking.event!.starts_at,
      balanceDueOn: booking.event!.balance_due_on,
    }))
    .sort((a, b) => b.eventStartsAt.localeCompare(a.eventStartsAt));
}
