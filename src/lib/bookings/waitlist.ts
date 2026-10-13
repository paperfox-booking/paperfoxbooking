import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type WaitlistStatus = Database["public"]["Enums"]["waitlist_status"];

export interface WaitlistEntry {
  id: string;
  status: WaitlistStatus;
  fullName: string;
  email: string;
  phone: string;
  customerId: string;
  optionId: string | null;
  notes: string;
  joinedAt: string;
  offeredAt: string | null;
  offerExpiresOn: string | null;
  bookingId: string | null;
}

/** An event's waiting list, in the order people joined. */
export async function listWaitlist(eventId: string): Promise<WaitlistEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("waitlist")
    .select(
      `id, status, ticket_type_id, notes, created_at, offered_at, offer_expires_on, booking_id,
       customer:customers(id, full_name, email, phone)`,
    )
    .eq("event_id", eventId)
    .order("created_at");
  if (error)
    throw new Error(`Couldn't load the waiting list: ${error.message}`);
  return data.map((entry) => ({
    id: entry.id,
    status: entry.status,
    fullName: entry.customer?.full_name ?? "",
    email: entry.customer?.email ?? "",
    phone: entry.customer?.phone ?? "",
    customerId: entry.customer?.id ?? "",
    optionId: entry.ticket_type_id,
    notes: entry.notes,
    joinedAt: entry.created_at,
    offeredAt: entry.offered_at,
    offerExpiresOn: entry.offer_expires_on,
    bookingId: entry.booking_id,
  }));
}

/** How many people are waiting (or have been offered a place) on each event. */
export async function countWaiting(eventId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .in("status", ["waiting", "offered"]);
  return count ?? 0;
}
