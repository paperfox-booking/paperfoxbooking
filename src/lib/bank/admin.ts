import "server-only";
import { bookingMoney, netPaid } from "@/lib/bookings/money";
import { toUkDateInput, ukToday } from "@/lib/dates";
import { allRows } from "@/lib/supabase/all-rows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MatchBooking } from "./match";

/**
 * Every booking a bank transfer could be for: not cancelled, on an event
 * that hasn't ended more than 60 days ago (late payments still arrive). Read
 * in pages, as there can be more than Supabase's 1,000 rows at a time.
 */
export async function listBookingsForMatching(): Promise<MatchBooking[]> {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const data = await allRows((from, to) =>
    supabase
      .from("bookings")
      .select(
        `id, reference, price_pence, deposit_pence,
       customer:customers(full_name),
       event:events!inner(title, ends_at, balance_due_on, deleted_at, status),
       payments(amount_pence, received_on, deleted_at, created_at),
       refunds(amount_pence, deleted_at)`,
      )
      .is("cancelled_at", null)
      .gt("events.ends_at", since)
      .is("events.deleted_at", null)
      .neq("events.status", "cancelled")
      .order("reference")
      .range(from, to),
  );
  const today = ukToday();
  return data
    .filter((booking) => booking.event && booking.price_pence > 0)
    .map((booking) => {
      const paidPence = netPaid(booking.payments, booking.refunds);
      const money = bookingMoney(
        {
          pricePence: booking.price_pence,
          depositPence: booking.deposit_pence,
          paidPence,
          cancelled: false,
          balanceDueOn: booking.event!.balance_due_on,
        },
        today,
      );
      return {
        bookingId: booking.id,
        reference: booking.reference,
        fullName: booking.customer?.full_name ?? "",
        eventTitle: booking.event!.title,
        depositOwedPence: money.depositOwedPence,
        balancePence: money.balancePence,
        payments: booking.payments
          .filter((payment) => !payment.deleted_at)
          .map((payment) => ({
            amountPence: payment.amount_pence,
            receivedOn: payment.received_on,
            recordedOn: toUkDateInput(payment.created_at),
          })),
      };
    });
}
