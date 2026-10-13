import "server-only";
import { bookingMoney, type PaymentState } from "@/lib/bookings/money";
import { ukToday } from "@/lib/dates";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { EMAIL_TEMPLATE_LABELS } from "@/lib/validation/bookings";
import {
  loadEmailContext,
  loadEmailRecipient,
  prepareEmail,
  sendPreparedEmail,
  type EmailRecipient,
} from "./booking-emails";
import { emailTransport } from "./transport";
import type { EmailPayment } from "./values";
import { emailAfterPayment, type PaymentEmail } from "./which-email";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export function paymentStateOf(recipient: EmailRecipient): PaymentState {
  const today = ukToday();
  return bookingMoney(
    {
      pricePence: recipient.booking.pricePence,
      depositPence: recipient.booking.depositPence,
      paidPence: recipient.booking.paidPence,
      cancelled: recipient.booking.cancelled,
      balanceDueOn: today,
    },
    today,
  ).state;
}

export interface PaymentEmailResult {
  template: PaymentEmail;
  outcome: "sent" | "failed" | "off";
  /** A sentence for the screen saying what happened. */
  text: string;
}

/**
 * After a payment is recorded, sends B2, B3 or a thank you (see
 * emailAfterPayment), unless payment emails are switched off in Settings.
 */
export async function emailAfterRecordingPayment(
  supabase: Supabase,
  bookingId: string,
  stateBefore: PaymentState | null,
  payment: EmailPayment,
): Promise<PaymentEmailResult | undefined> {
  if (!stateBefore) return undefined;
  const recipient = await loadEmailRecipient(supabase, bookingId);
  if (!recipient) return undefined;
  const which = emailAfterPayment(stateBefore, paymentStateOf(recipient));
  if (!which) return undefined;
  const label = EMAIL_TEMPLATE_LABELS[which];

  const context = await loadEmailContext(supabase, recipient.eventId);
  if (!context || !context.settings.sendPaymentEmails) return undefined;
  if (emailTransport() === "off") {
    return {
      template: which,
      outcome: "off",
      text: `No email sent, because sending emails isn't switched on yet.`,
    };
  }
  const outcome = await sendPreparedEmail(
    supabase,
    context,
    prepareEmail(context, recipient, { template: which }, payment),
  );
  return outcome.sent
    ? {
        template: which,
        outcome: "sent",
        text: `${label} emailed to ${outcome.to}.${outcome.warning ? ` ${outcome.warning}` : ""}`,
      }
    : {
        template: which,
        outcome: "failed",
        text: `${label} couldn't be emailed: ${outcome.error}`,
      };
}
