import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { requireStaff } from "@/lib/auth/session";
import { listEventPeople } from "@/lib/bookings/admin";
import { formatUkDateRange, ukToday } from "@/lib/dates";
import { listTemplates, loadSettingsRow } from "@/lib/email/booking-emails";
import { emailTransport } from "@/lib/email/transport";
import { getEvent } from "@/lib/events/admin";
import { allRows } from "@/lib/supabase/all-rows";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";
import { BulkEmail } from "./bulk-email";

export const metadata: Metadata = { title: "Email people" };

export default function EmailPeoplePage(
  props: PageProps<"/admin/events/[eventId]/email">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EmailPeople params={props.params} />
    </Suspense>
  );
}

async function EmailPeople({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/email">, "params">) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/email`,
    "attendees.message",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();
  const supabase = await createSupabaseServerClient();
  const [event, rows, templates, settings] = await Promise.all([
    getEvent(eventId),
    listEventPeople(eventId),
    listTemplates(supabase),
    loadSettingsRow(supabase),
  ]);
  if (!event) notFound();

  // Which standard emails each person has already had.
  const sent = await allRows((from, to) =>
    supabase
      .from("email_log")
      .select("booking_id, template, bookings!inner(event_id)")
      .eq("bookings.event_id", eventId)
      // Failed sends, and test sends to the test address, don't count.
      .not("status", "in", "(failed,test)")
      .order("id")
      .range(from, to),
  );
  const had = new Map<string, Set<string>>();
  for (const email of sent) {
    if (!email.booking_id) continue;
    const set = had.get(email.booking_id) ?? new Set<string>();
    set.add(email.template);
    had.set(email.booking_id, set);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p>
          <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
        </p>
        <h1 className="mt-2 text-5xl">Email people</h1>
        <p className="mt-1 text-lg">
          {event.title}, {formatUkDateRange(event.starts_at, event.ends_at)}.
          Each person gets their own copy, with their own details filled in.
        </p>
      </div>
      <BulkEmail
        eventId={event.id}
        people={rows.map((row) => ({
          bookingId: row.bookingId,
          reference: row.reference,
          fullName: row.fullName,
          email: row.email,
          isTeam: row.isTeam,
          cancelled: row.cancelled,
          pricePence: row.pricePence,
          depositPence: row.depositPence,
          paidPence: row.paidPence,
          sentTemplates: [...(had.get(row.bookingId) ?? [])],
        }))}
        templates={templates.map((template) => ({
          key: template.key,
          name: template.name,
        }))}
        balanceDueOn={event.balance_due_on}
        today={ukToday()}
        transport={emailTransport()}
        testAddress={settings?.email_test_address ?? ""}
      />
    </div>
  );
}
