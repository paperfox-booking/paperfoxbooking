import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { loadEmailSettings } from "@/lib/email/booking-emails";
import { pdfResponse, statementPdf } from "@/lib/pdf/statement";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";

/** A booking's statement of payments and refunds, as a PDF. */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/bookings/[bookingId]/statement">,
) {
  const { bookingId } = await context.params;
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "payments.view")) {
    return new Response("Please sign in as an owner or admin.", {
      status: 403,
    });
  }
  if (!isUuid(bookingId)) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  const settings = await loadEmailSettings(supabase);
  const statement = settings
    ? await statementPdf(supabase, bookingId, settings)
    : null;
  if (!statement) return new Response("Not found", { status: 404 });
  return pdfResponse(statement.pdf, statement.filename);
}
