import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { daysBetween, toUkDateInput } from "@/lib/dates";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import {
  availability,
  type EventStatus,
  type PublicAvailability,
} from "./rules";

/**
 * Published events for the public pages. These are cached and shared by
 * every visitor, so pages load fast on a phone. The team's changes refresh
 * them straight away (each admin action calls updateTag(PUBLIC_EVENTS_TAG)),
 * and they also refresh themselves every hour, so "booking opens" and
 * "finished" stay current.
 */

export const PUBLIC_EVENTS_TAG = "public-events";

export interface PublicOption {
  id: string;
  name: string;
  description: string;
  pricePence: number;
  depositPence: number | null;
  startsAt: string | null;
  onSale: boolean;
}

export interface PublicVenue {
  name: string;
  addressLines: string[];
  postcode: string;
  phone: string;
  mapUrl: string | null;
  parking: string;
  accessInfo: string;
}

export interface PublicEvent {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  included: string[];
  hotelInfo: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  balanceDueOn: string;
  bookingOpensAt: string | null;
  bookingClosesAt: string | null;
  venue: PublicVenue | null;
  options: PublicOption[];
  availability: PublicAvailability;
  /**
   * False once the balance due date has arrived: from then on, people
   * booking pay in full.
   */
  depositsOpen: boolean;
}

const EVENT_COLUMNS = `
  id, slug, title, summary, description, included, hotel_info, starts_at,
  ends_at, status, balance_due_on, booking_opens_at, booking_closes_at,
  venue:venues(name, address, postcode, phone, map_url, parking, access_info),
  options:ticket_types(id, name, description, price_pence, deposit_pence, starts_at, on_sale, sort_order)
`;

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

type EventRow = NonNullable<
  Awaited<ReturnType<typeof selectEvents>>["data"]
>[number];

function selectEvents() {
  return createSupabasePublicClient()
    .from("events")
    .select(EVENT_COLUMNS)
    .is("deleted_at", null)
    .neq("status", "draft");
}

function toPublicEvent(row: EventRow, now: Date): PublicEvent {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    included: lines(row.included),
    hotelInfo: row.hotel_info,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    balanceDueOn: row.balance_due_on,
    bookingOpensAt: row.booking_opens_at,
    bookingClosesAt: row.booking_closes_at,
    venue: row.venue
      ? {
          name: row.venue.name,
          addressLines: lines(row.venue.address),
          postcode: row.venue.postcode,
          phone: row.venue.phone,
          mapUrl: row.venue.map_url,
          parking: row.venue.parking,
          accessInfo: row.venue.access_info,
        }
      : null,
    options: [...row.options]
      .sort(
        (a, b) => a.sort_order - b.sort_order || a.price_pence - b.price_pence,
      )
      .map((option) => ({
        id: option.id,
        name: option.name,
        description: option.description,
        pricePence: option.price_pence,
        depositPence: option.deposit_pence,
        startsAt: option.starts_at,
        onSale: option.on_sale,
      })),
    availability: availability(
      {
        status: row.status,
        endsAt: row.ends_at,
        bookingOpensAt: row.booking_opens_at,
        bookingClosesAt: row.booking_closes_at,
      },
      now,
    ),
    depositsOpen: daysBetween(toUkDateInput(now), row.balance_due_on) > 0,
  };
}

/**
 * Events that haven't finished yet, soonest first, or null if they couldn't
 * be loaded. A failure is only remembered for a minute, so the page recovers
 * by itself (for example while a new release waits for its database change).
 */
export async function getUpcomingEvents(): Promise<PublicEvent[] | null> {
  "use cache";
  cacheTag(PUBLIC_EVENTS_TAG);

  const now = new Date();
  const { data, error } = await selectEvents()
    .gt("ends_at", now.toISOString())
    .order("starts_at", { ascending: true });
  if (error) {
    console.error("Couldn't load upcoming events", error.message);
    cacheLife("seconds");
    return null;
  }
  cacheLife("hours");
  return data.map((row) => toPublicEvent(row, now));
}

/** One event by its web address, or null if there isn't a public one. */
export async function getPublicEvent(
  slug: string,
): Promise<PublicEvent | null> {
  "use cache";
  cacheTag(PUBLIC_EVENTS_TAG);

  const now = new Date();
  const { data, error } = await selectEvents().eq("slug", slug).maybeSingle();
  if (error) {
    cacheLife("seconds");
    throw new Error(`Couldn't load the event: ${error.message}`);
  }
  cacheLife("hours");
  return data ? toPublicEvent(data, now) : null;
}

/** The web addresses of upcoming public events, to build ahead of time. */
export async function getUpcomingEventSlugs(): Promise<string[]> {
  return ((await getUpcomingEvents()) ?? []).map((event) => event.slug);
}
