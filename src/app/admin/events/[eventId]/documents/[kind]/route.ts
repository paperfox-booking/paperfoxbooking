import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { ukToday } from "@/lib/dates";
import { loadEmailContext } from "@/lib/email/booking-emails";
import {
  DOCUMENT_KINDS,
  documentFileName,
  renderDocument,
  type DocumentKind,
} from "@/lib/pdf/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";

/** A blank copy of an event's document, to check before emailing it. */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/events/[eventId]/documents/[kind]">,
) {
  const { eventId, kind } = await context.params;
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "payments.view")) {
    return new Response("Please sign in as an owner or admin.", {
      status: 403,
    });
  }
  if (
    !isUuid(eventId) ||
    !(DOCUMENT_KINDS as readonly string[]).includes(kind)
  ) {
    return new Response("Not found", { status: 404 });
  }
  const supabase = await createSupabaseServerClient();
  const emailContext = await loadEmailContext(supabase, eventId);
  if (!emailContext) return new Response("Not found", { status: 404 });
  const pdf = await renderDocument(kind as DocumentKind, {
    settings: emailContext.settings,
    event: emailContext.event,
    booking: null,
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
