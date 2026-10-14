import "server-only";
import { statementLines, type StatementLine } from "@/lib/bookings/statement";
import { ukToday } from "@/lib/dates";
import { loadEmailEvent, loadEmailRecipient } from "@/lib/email/booking-emails";
import type { EmailSettings } from "@/lib/email/values";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderStatement, statementFileName } from "./documents";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/**
 * A booking's statement as a PDF, read as the signed-in person (so row level
 * security decides whose they can have). Null if they can't see it.
 */
export async function statementPdf(
  supabase: Supabase,
  bookingId: string,
  settings: EmailSettings,
  /** A customer's own figures (they can't read the payments table). */
  own?: { lines: StatementLine[]; paidPence: number },
): Promise<{ pdf: Buffer; filename: string } | null> {
  const [recipient, { data: money }] = await Promise.all([
    loadEmailRecipient(supabase, bookingId),
    own
      ? { data: null }
      : supabase
          .from("bookings")
          .select(
            `payments(amount_pence, method, received_on, deleted_at, created_at),
             refunds(amount_pence, method, refunded_on, deleted_at, created_at)`,
          )
          .eq("id", bookingId)
          .maybeSingle(),
  ]);
  if (!recipient || (!own && !money)) return null;
  const event = await loadEmailEvent(supabase, recipient.eventId);
  if (!event) return null;
  const pdf = await renderStatement({
    settings,
    event,
    booking: own
      ? { ...recipient.booking, paidPence: own.paidPence }
      : recipient.booking,
    lines: own ? own.lines : statementLines(money!.payments, money!.refunds),
    today: ukToday(),
  });
  return { pdf, filename: statementFileName(recipient.booking.reference) };
}

export function pdfResponse(pdf: Buffer, filename: string): Response {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
