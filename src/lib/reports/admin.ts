import "server-only";
import { sumPayments } from "@/lib/bookings/money";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profitFor, type Profit } from "./profit";

/**
 * Reads what the profit and loss pages need, as the signed-in team member
 * (owners and admins only: row level security hides costs and payments from
 * everyone else). Call only after checking the person may see reports.
 */

export interface CostRow {
  id: string;
  category: string;
  description: string;
  supplier: string;
  amountPence: number;
  paid: boolean;
  notes: string;
}

export interface EventProfit {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  capacity: number;
  balanceDueOn: string;
  profit: Profit;
  /** Places and income for each option, for the event's own page. */
  byOption: { optionId: string | null; count: number; salesPence: number }[];
  freePlaces: number;
}

const COLUMNS = `
  id, title, starts_at, ends_at, status, capacity, balance_due_on,
  bookings(price_pence, cancelled_at, ticket_type_id, payments(amount_pence, deleted_at)),
  event_costs(amount_pence, paid, category, deleted_at)
`;

type EventSelect = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  capacity: number;
  balance_due_on: string;
  bookings: {
    price_pence: number;
    cancelled_at: string | null;
    ticket_type_id: string | null;
    payments: { amount_pence: number; deleted_at: string | null }[];
  }[];
  event_costs: {
    amount_pence: number;
    paid: boolean;
    category: string;
    deleted_at: string | null;
  }[];
};

function toEventProfit(event: EventSelect): EventProfit {
  const bookings = event.bookings.map((booking) => ({
    pricePence: booking.price_pence,
    paidPence: sumPayments(booking.payments),
    cancelled: booking.cancelled_at !== null,
    optionId: booking.ticket_type_id,
  }));
  const options = new Map<
    string | null,
    { count: number; salesPence: number }
  >();
  for (const booking of bookings) {
    if (booking.cancelled) continue;
    const entry = options.get(booking.optionId) ?? { count: 0, salesPence: 0 };
    entry.count += 1;
    entry.salesPence += booking.pricePence;
    options.set(booking.optionId, entry);
  }
  return {
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    status: event.status,
    capacity: event.capacity,
    balanceDueOn: event.balance_due_on,
    profit: profitFor({
      capacity: event.capacity,
      bookings,
      costs: event.event_costs
        .filter((cost) => !cost.deleted_at)
        .map((cost) => ({
          amountPence: cost.amount_pence,
          paid: cost.paid,
          category: cost.category,
        })),
    }),
    byOption: [...options].map(([optionId, entry]) => ({ optionId, ...entry })),
    freePlaces: bookings.filter(
      (booking) => !booking.cancelled && booking.pricePence === 0,
    ).length,
  };
}

/** Every event's profit and loss, soonest first. */
export async function listEventProfits(): Promise<EventProfit[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .is("deleted_at", null)
    .order("starts_at", { ascending: true });
  if (error) throw new Error(`Couldn't load the report: ${error.message}`);
  return (data as EventSelect[]).map(toEventProfit);
}

export async function getEventProfit(
  eventId: string,
): Promise<EventProfit | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("events")
    .select(COLUMNS)
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the report: ${error.message}`);
  return data ? toEventProfit(data as EventSelect) : null;
}

export async function listCosts(eventId: string): Promise<CostRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("event_costs")
    .select("id, category, description, supplier, amount_pence, paid, notes")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(`Couldn't load the costs: ${error.message}`);
  return data.map((cost) => ({
    id: cost.id,
    category: cost.category,
    description: cost.description,
    supplier: cost.supplier,
    amountPence: cost.amount_pence,
    paid: cost.paid,
    notes: cost.notes,
  }));
}

export async function getCost(costId: string): Promise<CostRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("event_costs")
    .select("id, category, description, supplier, amount_pence, paid, notes")
    .eq("id", costId)
    .is("deleted_at", null)
    .maybeSingle();
  return data
    ? {
        id: data.id,
        category: data.category,
        description: data.description,
        supplier: data.supplier,
        amountPence: data.amount_pence,
        paid: data.paid,
        notes: data.notes,
      }
    : null;
}
