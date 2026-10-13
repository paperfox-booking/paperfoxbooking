import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
