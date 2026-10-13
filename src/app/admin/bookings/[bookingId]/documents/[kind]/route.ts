import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { ukToday } from "@/lib/dates";
import {
  loadEmailContext,
  loadEmailRecipient,
} from "@/lib/email/booking-emails";
import {
  DOCUMENT_KINDS,
  documentFileName,
  renderDocument,
  type DocumentKind,
} from "@/lib/pdf/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";

/** One booking's copy of an email attachment, as a PDF. */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/bookings/[bookingId]/documents/[kind]">,
) {
  const { bookingId, kind } = await context.params;
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "payments.view")) {
    return new Response("Please sign in as an owner or admin.", {
      status: 403,
    });
  }
  if (
    !isUuid(bookingId) ||
    !(DOCUMENT_KINDS as readonly string[]).includes(kind)
  ) {
    return new Response("Not found", { status: 404 });
  }
  const supabase = await createSupabaseServerClient();
  const recipient = await loadEmailRecipient(supabase, bookingId);
  const emailContext = recipient
    ? await loadEmailContext(supabase, recipient.eventId)
    : null;
  if (!recipient || !emailContext) {
    return new Response("Not found", { status: 404 });
  }
  const pdf = await renderDocument(kind as DocumentKind, {
    settings: emailContext.settings,
    event: emailContext.event,
    booking: recipient.booking,
    today: ukToday(),
  });
  const name = documentFileName(kind as DocumentKind, emailContext.event.title);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
