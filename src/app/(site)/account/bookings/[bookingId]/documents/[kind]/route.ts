import { listMyBookings, loadCustomerSettings } from "@/lib/account/bookings";
import { getCurrentUser } from "@/lib/auth/session";
import { ukToday } from "@/lib/dates";
import { loadEmailEvent, loadEmailRecipient } from "@/lib/email/booking-emails";
import {
  DOCUMENT_KINDS,
  documentFileName,
  renderDocument,
  type DocumentKind,
} from "@/lib/pdf/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";

/** A customer's own copy of a document, as a PDF. */
export async function GET(
  _request: Request,
  context: RouteContext<"/account/bookings/[bookingId]/documents/[kind]">,
) {
  const { bookingId, kind } = await context.params;
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Please sign in to download this.", { status: 401 });
  }
  if (
    !isUuid(bookingId) ||
    !(DOCUMENT_KINDS as readonly string[]).includes(kind)
  ) {
    return new Response("Not found", { status: 404 });
  }
  // Only their own bookings, and the confirmation once their place is secured.
  const mine = (await listMyBookings(user.id)).find(
    (booking) => booking.id === bookingId && !booking.cancelled,
  );
  if (!mine) return new Response("Not found", { status: 404 });
  if (kind === "confirmation" && !placeSecured(mine.money.state)) {
    return new Response(
      "Your confirmation is ready once your deposit has arrived.",
      { status: 404 },
    );
  }
  const supabase = await createSupabaseServerClient();
  const recipient = await loadEmailRecipient(supabase, bookingId);
  const [settings, event] = await Promise.all([
    loadCustomerSettings(),
    recipient ? loadEmailEvent(supabase, recipient.eventId) : null,
  ]);
  if (!recipient || !settings || !event) {
    return new Response("Not found", { status: 404 });
  }
  const pdf = await renderDocument(kind as DocumentKind, {
    settings,
    event,
    // What they've paid comes from their own figures: customers can't read
    // the payments table itself.
    booking: { ...recipient.booking, paidPence: mine.paidPence },
    today: ukToday(),
  });
  const name = documentFileName(kind as DocumentKind, event.title);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

function placeSecured(state: string): boolean {
  return state === "deposit_paid" || state === "paid" || state === "free";
}
