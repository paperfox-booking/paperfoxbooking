import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";

/**
 * Everything held about one person, as a file, for answering a request to
 * see their data (a subject access request under UK GDPR). Owners and
 * admins only, as it includes health information and payments.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/admin/people/[customerId]/export">,
) {
  const { customerId } = await context.params;
  const user = await getCurrentUser();
  if (!user?.staffRole || !can(user.staffRole, "payments.view")) {
    return new Response("Please sign in as an owner or admin.", {
      status: 403,
    });
  }
  if (!isUuid(customerId)) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  const { data: person } = await supabase
    .from("customers")
    .select(
      "full_name, email, phone, emergency_contact, dietary_health, notes, created_at, updated_at",
    )
    .eq("id", customerId)
    .maybeSingle();
  if (!person) return new Response("Not found", { status: 404 });

  const [{ data: bookings }, { data: emails }, { data: waiting }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          `reference, created_at, cancelled_at, cancel_reason, price_pence, deposit_pence,
           price_note, notes, payment_notes, checked_in_at,
           event:events(title, starts_at), option:ticket_types(name), room:event_rooms(name),
           payments(amount_pence, method, received_on, note, deleted_at, delete_reason),
           refunds(amount_pence, method, refunded_on, reason, deleted_at, delete_reason)`,
        )
        .eq("customer_id", customerId)
        .order("created_at"),
      supabase
        .from("email_log")
        .select("template, subject, to_email, sent_on, sent_at, status, note")
        .eq("customer_id", customerId)
        .order("created_at"),
      supabase
        .from("waitlist")
        .select("status, notes, created_at, event:events(title)")
        .eq("customer_id", customerId),
    ]);

  const body = JSON.stringify(
    {
      about:
        "Everything Paper Fox Events Ltd holds about this person in its booking system. Amounts are in pence.",
      exportedAt: new Date().toISOString(),
      person,
      bookings: bookings ?? [],
      emails: emails ?? [],
      waitingLists: waiting ?? [],
    },
    null,
    2,
  );
  const safeName = person.full_name.replace(/[^\p{L}\p{N} -]/gu, "").trim();
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName} - Paper Fox data.json`)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
