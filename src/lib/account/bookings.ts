import "server-only";
import {
  bookingMoney,
  sumPayments,
  type BookingMoney,
} from "@/lib/bookings/money";
import { ukToday } from "@/lib/dates";
import type { EmailSettings } from "@/lib/email/values";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A customer's own bookings, for their account. Row level security already
 * limits customers to their own records; this also filters by their own
 * customer record, so a team member's account shows only their own
 * bookings too.
 */

export interface MyBooking {
  id: string;
  reference: string;
  cancelled: boolean;
  optionName: string;
  pricePence: number;
  depositPence: number | null;
  paidPence: number;
  money: BookingMoney;
  event: {
    title: string;
    slug: string;
    startsAt: string;
    endsAt: string;
    balanceDueOn: string;
    venueName: string;
    facebookGroupUrl: string | null;
  };
  payments: {
    amountPence: number;
    receivedOn: string | null;
    method: string;
  }[];
}

export async function listMyBookings(userId: string): Promise<MyBooking[]> {
  const supabase = await createSupabaseServerClient();
  const { data: customers } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", userId)
    .is("deleted_at", null);
  const ids = (customers ?? []).map((customer) => customer.id);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, reference, cancelled_at, price_pence, deposit_pence,
       ticket_types(name),
       event:events(title, slug, starts_at, ends_at, balance_due_on, facebook_group_url, venues(name)),
       payments(amount_pence, received_on, method, deleted_at)`,
    )
    .in("customer_id", ids);
  if (error) throw new Error(`Couldn't load your bookings: ${error.message}`);
  const today = ukToday();
  return data
    .filter((booking) => booking.event)
    .map((booking) => {
      const event = booking.event!;
      const paidPence = sumPayments(booking.payments);
      return {
        id: booking.id,
        reference: booking.reference,
        cancelled: booking.cancelled_at !== null,
        optionName: booking.ticket_types?.name ?? "",
        pricePence: booking.price_pence,
        depositPence: booking.deposit_pence,
        paidPence,
        money: bookingMoney(
          {
            pricePence: booking.price_pence,
            depositPence: booking.deposit_pence,
            paidPence,
            cancelled: booking.cancelled_at !== null,
            balanceDueOn: event.balance_due_on,
          },
          today,
        ),
        event: {
          title: event.title,
          slug: event.slug,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          balanceDueOn: event.balance_due_on,
          venueName: event.venues?.name ?? "",
          facebookGroupUrl: event.facebook_group_url,
        },
        payments: booking.payments
          .filter((payment) => !payment.deleted_at)
          .map((payment) => ({
            amountPence: payment.amount_pence,
            receivedOn: payment.received_on,
            method: payment.method,
          }))
          .sort((a, b) =>
            (a.receivedOn ?? "").localeCompare(b.receivedOn ?? ""),
          ),
      };
    })
    .sort((a, b) => a.event.startsAt.localeCompare(b.event.startsAt));
}

/** The settings a customer may see: business, bank details and terms. */
export async function loadCustomerSettings(): Promise<EmailSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("customer_settings").maybeSingle();
  if (!data) return null;
  return {
    businessName: data.business_name,
    legalName: data.legal_name,
    companyNumber: data.company_number,
    contactEmail: data.contact_email,
    phone: data.phone,
    address: data.address,
    website: data.website,
    facebookUrl: data.facebook_url,
    facebookGroupUrl: data.facebook_group_url,
    instagramUrl: data.instagram_url,
    signOff: data.sign_off,
    bankName: data.bank_name,
    bankAccountName: data.bank_account_name,
    bankSortCode: data.bank_sort_code,
    bankAccountNumber: data.bank_account_number,
    termsText: data.terms_text,
    termsVersion: data.terms_version,
    // Email settings aren't shared with customers, and aren't needed here.
    emailReplyTo: "",
    emailTestAddress: "",
    sendPaymentEmails: false,
  };
}
