"use server";

import { z } from "zod";
import { staffWithPermission } from "@/lib/auth/session";
import { daysBetween, isIsoDate, ukToday } from "@/lib/dates";
import { emailAfterRecordingPayment } from "@/lib/email/payment-emails";
import { SEND_GAP_MS, emailTransport } from "@/lib/email/transport";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BATCH = 5;
const NOTE_PREFIX = "Bank statement: ";

const itemSchema = z.object({
  bookingId: z.uuid(),
  amountPence: z.number().int().min(1).max(10_000_000),
  date: z
    .string()
    .refine(isIsoDate)
    .refine((date) => daysBetween(ukToday(), date) <= 0, {
      error: "That date is in the future",
    }),
  // Long statement descriptions are cut short rather than refused.
  description: z.string().transform((value) => value.slice(0, 400)),
});

export type StatementItem = z.input<typeof itemSchema>;

export type StatementResult =
  { recorded: true; emailNote?: string } | { recorded: false; error: string };

/**
 * Records a few bank transfers from a statement as payments, each sending
 * its email (B2, B3 or thanks) as a payment does. A transfer already
 * recorded from a statement (same booking, amount and date) is skipped, so
 * sending the same statement twice is safe.
 */
export async function recordStatementPaymentsAction(
  items: StatementItem[],
): Promise<
  { ok: true; results: StatementResult[] } | { ok: false; error: string }
> {
  if (!(await staffWithPermission("payments.record"))) {
    return {
      ok: false,
      error: "You need to be an owner or admin to record payments.",
    };
  }
  const parsed = z.array(itemSchema).max(BATCH).safeParse(items);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Something in the statement couldn't be read. Refresh the page.",
    };
  }
  const supabase = await createSupabaseServerClient();
  const results: StatementResult[] = [];
  for (const [index, item] of parsed.data.entries()) {
    // The same amount on the same day for this booking, however it was
    // recorded, is this payment again: never record it twice.
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("booking_id", item.bookingId)
      .eq("amount_pence", item.amountPence)
      .eq("received_on", item.date)
      .is("deleted_at", null)
      .limit(1);
    if (existing?.length) {
      results.push({
        recorded: false,
        error:
          "Already recorded: they have a payment of this amount on this day.",
      });
      continue;
    }
    if (index > 0 && emailTransport() === "resend") {
      await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
    }
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        booking_id: item.bookingId,
        amount_pence: item.amountPence,
        received_on: item.date,
        method: "bank_transfer",
        note: `${NOTE_PREFIX}${item.description}`.slice(0, 500),
      })
      .select("id")
      .single();
    if (error) {
      results.push({ recorded: false, error: friendlyDatabaseError(error) });
      continue;
    }
    const email = await emailAfterRecordingPayment(supabase, item.bookingId, {
      id: payment.id,
      amountPence: item.amountPence,
      receivedOn: item.date,
    });
    results.push({ recorded: true, emailNote: email?.text });
  }
  return { ok: true, results };
}
