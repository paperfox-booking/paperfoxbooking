import { listMyBookings, loadCustomerSettings } from "@/lib/account/bookings";
import { getCurrentUser } from "@/lib/auth/session";
import { business } from "@/lib/business";
import type { EmailSettings } from "@/lib/email/values";
import { pdfResponse, statementPdf } from "@/lib/pdf/statement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";

/**
 * A customer's own statement of payments and refunds, as a PDF, including
 * for a cancelled booking (to show a refund).
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/account/bookings/[bookingId]/statement">,
) {
  const { bookingId } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Please sign in to download this.", { status: 401 });
  }
  if (!isUuid(bookingId)) return new Response("Not found", { status: 404 });
  const mine = (await listMyBookings(user.id)).find(
    (booking) => booking.id === bookingId,
  );
  if (!mine) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  // Someone whose only booking is cancelled doesn't get the settings (with
  // the bank details), so their statement uses the public details.
  const settings = (await loadCustomerSettings()) ?? publicSettings();
  const statement = await statementPdf(supabase, bookingId, settings, {
    lines: mine.statement,
    paidPence: mine.paidPence,
  });
  if (!statement) return new Response("Not found", { status: 404 });
  return pdfResponse(statement.pdf, statement.filename);
}

function publicSettings(): EmailSettings {
  return {
    businessName: business.name,
    legalName: business.legalName,
    companyNumber: business.companyNumber,
    address: business.address.join("\n"),
    website: business.website,
    facebookUrl: business.social.facebook,
    facebookGroupUrl: "",
    instagramUrl: business.social.instagram,
    signOff: business.signOff,
    bankName: "",
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: "",
    contactEmail: business.email,
    phone: business.phone,
    emailReplyTo: business.email,
    emailTestAddress: "",
    sendPaymentEmails: false,
    termsText: "",
    termsVersion: 0,
  };
}
