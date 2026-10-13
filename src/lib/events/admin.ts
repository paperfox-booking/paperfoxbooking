import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Reads events for the admin area, as the signed-in team member (row level
 * security applies). Call only after checking the person is on the team.
 */

type Tables = Database["public"]["Tables"];
export type VenueRecord = Tables["venues"]["Row"];
export type EventRecord = Tables["events"]["Row"];
export type OptionRecord = Tables["ticket_types"]["Row"];

export interface AdminEventSummary {
  id: string;
  slug: string;
  title: string;
  status: EventRecord["status"];
  startsAt: string;
  endsAt: string;
  capacity: number;
  venueName: string;
  optionCount: number;
}

export async function listVenues(): Promise<VenueRecord[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Couldn't load venues: ${error.message}`);
  return data;
}

export async function getVenue(id: string): Promise<VenueRecord | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("venues")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the venue: ${error.message}`);
  return data;
}

export async function listEvents(): Promise<AdminEventSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, slug, title, status, starts_at, ends_at, capacity, venues(name), ticket_types(id, deleted_at)",
    )
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`Couldn't load events: ${error.message}`);
  return data.map((event) => ({
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    capacity: event.capacity,
    venueName: event.venues?.name ?? "",
    optionCount: event.ticket_types.filter((option) => !option.deleted_at)
      .length,
  }));
}

/** Events not yet finished (soonest first), and past ones (latest first). */
export async function listEventsByTime(): Promise<{
  upcoming: AdminEventSummary[];
  past: AdminEventSummary[];
}> {
  const events = await listEvents();
  const now = Date.now();
  return {
    upcoming: events.filter((event) => Date.parse(event.endsAt) > now),
    past: events.filter((event) => Date.parse(event.endsAt) <= now).reverse(),
  };
}

export interface AdminEvent extends EventRecord {
  venue: VenueRecord | null;
  options: OptionRecord[];
}

export async function getEvent(id: string): Promise<AdminEvent | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select("*, venue:venues(*), options:ticket_types(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the event: ${error.message}`);
  if (!data) return null;
  return {
    ...data,
    options: data.options
      .filter((option) => !option.deleted_at)
      .sort(
        (a, b) => a.sort_order - b.sort_order || a.price_pence - b.price_pence,
      ),
  };
}
