"use server";

import { z } from "zod";
import { staffWithPermission } from "@/lib/auth/session";
import {
  TEMPLATE_KEYS,
  loadEmailContext,
  loadEmailRecipient,
  prepareEmail,
  sendPreparedEmail,
  type EmailChoice,
} from "@/lib/email/booking-emails";
import { SEND_GAP_MS, emailTransport } from "@/lib/email/transport";
import { DOCUMENT_KINDS } from "@/lib/pdf/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** At most this many emails per call, so each call finishes quickly. */
const BATCH = 5;

const choiceSchema = z.union([
  z.object({ template: z.enum(TEMPLATE_KEYS) }),
  z.object({
    custom: z.object({
      subject: z
        .string()
        .trim()
        .min(1, { error: "Enter a subject" })
        .max(200, { error: "Use 200 characters or fewer for the subject" }),
      body: z
        .string()
        .transform((value) => value.replace(/\r\n?/g, "\n").trim())
        .pipe(
          z
            .string()
            .min(1, { error: "Write the message" })
            .max(20000, { error: "Use 20,000 characters or fewer" }),
        ),
    }),
    attachments: z.array(z.enum(DOCUMENT_KINDS)).max(3),
  }),
]);

export type BulkChoice = z.input<typeof choiceSchema>;

const NOT_ALLOWED = "You need to be an owner or admin to send emails.";

export interface BulkPreview {
  subject: string;
  html: string;
  warnings: string[];
  problems: string[];
  attachments: string[];
  sendTo: string | null;
}

/** The email as the first person on the list would get it. */
export async function previewBulkEmailAction(
  eventId: string,
  choice: BulkChoice,
  bookingId: string,
): Promise<{ ok: true; preview: BulkPreview } | { ok: false; error: string }> {
  if (!(await staffWithPermission("attendees.message"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  const parsed = choiceSchema.safeParse(choice);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }
  const supabase = await createSupabaseServerClient();
  const [context, recipient] = await Promise.all([
    loadEmailContext(supabase, eventId),
    loadEmailRecipient(supabase, bookingId),
  ]);
  if (!context) return { ok: false, error: NOT_ALLOWED };
  if (!recipient || recipient.eventId !== eventId) {
    return { ok: false, error: "That booking couldn't be found." };
  }
  const prepared = prepareEmail(context, recipient, parsed.data as EmailChoice);
  return {
    ok: true,
    preview: {
      subject: prepared.composed.subject,
      html: prepared.composed.html,
      warnings: prepared.composed.warnings,
      problems: prepared.problems,
      attachments: prepared.attachments.map(
        (attachment) => attachment.filename,
      ),
      sendTo: prepared.sendTo,
    },
  };
}

export type BulkResult = { bookingId: string } & (
  { sent: true } | { sent: false; error: string }
);

/** Sends the email to a few people at a time; the page calls it repeatedly. */
export async function sendBulkEmailAction(
  eventId: string,
  choice: BulkChoice,
  bookingIds: string[],
): Promise<{ ok: true; results: BulkResult[] } | { ok: false; error: string }> {
  if (!(await staffWithPermission("attendees.message"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  const parsed = choiceSchema.safeParse(choice);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }
  const ids = z.array(z.uuid()).max(BATCH).safeParse(bookingIds);
  if (!ids.success)
    return { ok: false, error: "Something went wrong. Refresh the page." };
  if (emailTransport() === "off") {
    return { ok: false, error: "Sending emails isn't switched on yet." };
  }
  const supabase = await createSupabaseServerClient();
  const context = await loadEmailContext(supabase, eventId);
  if (!context) return { ok: false, error: NOT_ALLOWED };

  const results: BulkResult[] = [];
  for (const [index, bookingId] of ids.data.entries()) {
    // Resend allows about 2 emails a second.
    if (index > 0 && emailTransport() === "resend") {
      await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
    }
    const recipient = await loadEmailRecipient(supabase, bookingId);
    if (!recipient || recipient.eventId !== eventId) {
      results.push({ bookingId, sent: false, error: "Booking not found." });
      continue;
    }
    const outcome = await sendPreparedEmail(
      supabase,
      context,
      prepareEmail(context, recipient, parsed.data as EmailChoice),
    );
    results.push(
      outcome.sent
        ? { bookingId, sent: true }
        : { bookingId, sent: false, error: outcome.error },
    );
  }
  return { ok: true, results };
}
