import "server-only";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * An event's Facebook group, joining details and class kits text. Only the
 * team, and people booked on the event, can read them, through
 * public.event_private_details (signed-in accounts can't select these
 * columns directly). Events the person can't see them for are left out.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface EventPrivateDetails {
  facebook_group_url: string | null;
  joining_info: string;
  class_kits_info: string;
}

export const NO_PRIVATE_DETAILS: EventPrivateDetails = {
  facebook_group_url: null,
  joining_info: "",
  class_kits_info: "",
};

/**
 * Every column of an event except the private ones, for selects by
 * signed-in accounts.
 */
export const EVENT_COLUMNS =
  "id, slug, title, summary, description, included, hotel_info, venue_id, starts_at, ends_at, status, capacity, booking_opens_at, booking_closes_at, balance_due_on, deposit_hold_days, copied_from_event_id, created_at, updated_at, created_by, deleted_at";

export async function loadPrivateDetails(
  supabase: Supabase,
  eventIds: readonly string[],
): Promise<Map<string, EventPrivateDetails>> {
  if (eventIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("event_private_details", {
    event_ids: [...new Set(eventIds)],
  });
  if (error) {
    throw new Error(`Couldn't load the event's details: ${error.message}`);
  }
  return new Map(
    data.map((row) => [
      row.event_id,
      {
        facebook_group_url: row.facebook_group_url,
        joining_info: row.joining_info,
        class_kits_info: row.class_kits_info,
      },
    ]),
  );
}
