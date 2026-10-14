import "server-only";
import { publicEnv } from "@/lib/env";
import { bookingMoney, netPaid } from "@/lib/bookings/money";
import { ukToday } from "@/lib/dates";
import {
  DOCUMENT_TITLES,
  documentFileName,
  renderDocument,
  type DocumentEvent,
  type DocumentKind,
} from "@/lib/pdf/documents";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { composeEmail, type ComposedEmail } from "./compose";
import { emailTransport, sendEmail } from "./transport";
import {
  placeholderValues,
  type EmailBooking,
  type EmailPayment,
  type EmailSettings,
} from "./values";

/**
 * Loading what an email about a booking needs, filling it in, and sending it
 * with its PDF attachments. Everything runs as the signed-in team member, so
 * row level security still applies: only owners and admins can read the
 * settings and log emails.
 */

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const TEMPLATE_KEYS = [
  "B1",
  "B2",
  "B3",
  "thanks",
  "balance_reminder",
  "class_kits",
  "joining",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export function isTemplateKey(value: unknown): value is TemplateKey {
  return (
    typeof value === "string" &&
    (TEMPLATE_KEYS as readonly string[]).includes(value)
  );
}

export type EmailTemplate = Tables<"email_templates">;

/** A standard email, or a message written just for this send. */
export type EmailChoice =
  | { template: TemplateKey }
  | {
      custom: { subject: string; body: string };
      attachments: DocumentKind[];
    };

export function settingsFromRow(row: Tables<"settings">): EmailSettings {
  return {
    businessName: row.business_name,
    legalName: row.legal_name,
    companyNumber: row.company_number,
    address: row.address,
    website: row.website,
    facebookUrl: row.facebook_url,
    facebookGroupUrl: row.facebook_group_url,
    instagramUrl: row.instagram_url,
    signOff: row.sign_off,
    bankName: row.bank_name,
    bankAccountName: row.bank_account_name,
    bankSortCode: row.bank_sort_code,
    bankAccountNumber: row.bank_account_number,
    contactEmail: row.contact_email,
    phone: row.phone,
    emailReplyTo: row.email_reply_to,
    emailTestAddress: row.email_test_address,
    sendPaymentEmails: row.send_payment_emails,
    termsText: row.terms_text,
    termsVersion: row.terms_version,
  };
}

export async function loadSettingsRow(
  supabase: Supabase,
): Promise<Tables<"settings"> | null> {
  const { data } = await supabase.from("settings").select("*").maybeSingle();
  return data;
}

export async function loadEmailSettings(
  supabase: Supabase,
): Promise<EmailSettings | null> {
  const row = await loadSettingsRow(supabase);
  return row ? settingsFromRow(row) : null;
}

export async function listTemplates(
  supabase: Supabase,
): Promise<EmailTemplate[]> {
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .order("sort_order");
  return data ?? [];
}

export async function getTemplate(
  supabase: Supabase,
  key: TemplateKey,
): Promise<EmailTemplate | null> {
  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("key", key)
    .maybeSingle();
  return data;
}

/** The documents a standard email attaches. */
export function templateAttachments(template: EmailTemplate): DocumentKind[] {
  return [
    template.attach_booking_details && ("booking-details" as const),
    template.attach_confirmation && ("confirmation" as const),
    template.attach_terms && ("terms" as const),
  ].filter((kind): kind is DocumentKind => Boolean(kind));
}

export async function loadEmailEvent(
  supabase: Supabase,
  eventId: string,
): Promise<DocumentEvent | null> {
  const { data } = await supabase
    .from("events")
    .select(
      `title, starts_at, ends_at, balance_due_on, deposit_hold_days,
       facebook_group_url, included, hotel_info, class_kits_info, joining_info,
       venues (name, address, postcode, phone, parking, access_info),
       ticket_types (name, description, price_pence, deposit_pence, on_sale, starts_at, sort_order, deleted_at)`,
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!data) return null;
  const venue = data.venues;
  return {
    title: data.title,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    balanceDueOn: data.balance_due_on,
    depositHoldDays: data.deposit_hold_days,
    facebookGroupUrl: data.facebook_group_url,
    included: data.included,
    hotelInfo: data.hotel_info,
    classKitsInfo: data.class_kits_info,
    joiningInfo: data.joining_info,
    venueName: venue?.name ?? "",
    venueAddress: venue?.address ?? "",
    venuePostcode: venue?.postcode ?? "",
    venuePhone: venue?.phone ?? "",
    venueParking: venue?.parking ?? "",
    venueAccess: venue?.access_info ?? "",
    options: [...data.ticket_types]
      .filter((option) => !option.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((option) => ({
        name: option.name,
        description: option.description,
        pricePence: option.price_pence,
        depositPence: option.deposit_pence,
        onSale: option.on_sale,
        startsAt: option.starts_at,
      })),
  };
}

export interface EmailRecipient {
  bookingId: string;
  eventId: string;
  email: string | null;
  booking: EmailBooking;
  lastPayment: EmailPayment | null;
}

export async function loadEmailRecipient(
  supabase: Supabase,
  bookingId: string,
): Promise<EmailRecipient | null> {
  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, event_id, price_pence, deposit_pence, cancelled_at, created_at,
       customers (full_name, email),
       ticket_types (name),
       payments (amount_pence, received_on, deleted_at, created_at),
       refunds (amount_pence, deleted_at)`,
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!data) return null;
  const payments = data.payments
    .filter((payment) => !payment.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const last = payments.at(-1);
  return {
    bookingId: data.id,
    eventId: data.event_id,
    email: data.customers?.email ?? null,
    lastPayment: last
      ? { amountPence: last.amount_pence, receivedOn: last.received_on }
      : null,
    booking: {
      reference: data.reference,
      fullName: data.customers?.full_name ?? "",
      optionName: data.ticket_types?.name ?? "",
      pricePence: data.price_pence,
      depositPence: data.deposit_pence,
      paidPence: netPaid(data.payments, data.refunds),
      cancelled: data.cancelled_at !== null,
      createdAt: data.created_at,
    },
  };
}

export interface PreparedEmail {
  recipient: EmailRecipient;
  templateKey: TemplateKey | "other";
  /** Where it will really go: the test address while one is set. */
  sendTo: string | null;
  /** True while test mode sends it to the test address instead. */
  test: boolean;
  /** The same key means the email service sends it once, even if asked twice. */
  idempotencyKey?: string;
  composed: ComposedEmail;
  attachments: { kind: DocumentKind; filename: string; title: string }[];
  /** Reasons it can't be sent at all. */
  problems: string[];
}

export interface EmailContext {
  settings: EmailSettings;
  event: DocumentEvent;
  templates: Map<TemplateKey, EmailTemplate>;
}

export async function loadEmailContext(
  supabase: Supabase,
  eventId: string,
): Promise<EmailContext | null> {
  const [settings, event, templates] = await Promise.all([
    loadEmailSettings(supabase),
    loadEmailEvent(supabase, eventId),
    listTemplates(supabase),
  ]);
  if (!settings || !event) return null;
  return {
    settings,
    event,
    templates: new Map(
      templates
        .filter((template) => isTemplateKey(template.key))
        .map((template) => [template.key as TemplateKey, template]),
    ),
  };
}

function logoUrl(): string {
  return `${publicEnv().NEXT_PUBLIC_SITE_URL}/brand/fox-mark.png`;
}

/** Fills in an email for one booking, ready to preview or send. */
export function prepareEmail(
  context: EmailContext,
  recipient: EmailRecipient,
  choice: EmailChoice,
  payment: EmailPayment | null = recipient.lastPayment,
  idempotencyKey?: string,
): PreparedEmail {
  const { settings, event } = context;
  const template =
    "template" in choice ? context.templates.get(choice.template) : null;
  const wording =
    "template" in choice
      ? { subject: template?.subject ?? "", body: template?.body ?? "" }
      : choice.custom;
  const chosenKinds =
    "template" in choice
      ? template
        ? templateAttachments(template)
        : []
      : choice.attachments;
  // The confirmation says their place is confirmed, so it only goes once
  // their deposit (or a free place) has secured it.
  const state = bookingMoney(
    {
      pricePence: recipient.booking.pricePence,
      depositPence: recipient.booking.depositPence,
      paidPence: recipient.booking.paidPence,
      cancelled: recipient.booking.cancelled,
      balanceDueOn: event.balanceDueOn,
    },
    ukToday(),
  ).state;
  const secured =
    state === "deposit_paid" || state === "paid" || state === "free";
  const kinds = chosenKinds.filter(
    (kind) => kind !== "confirmation" || secured,
  );
  const composed = composeEmail({
    wording,
    values: placeholderValues({
      settings,
      event,
      booking: recipient.booking,
      payment,
      today: ukToday(),
    }),
    business: settings,
    logoUrl: logoUrl(),
  });

  const problems: string[] = [];
  if ("template" in choice && !template) {
    problems.push("That email's wording couldn't be found.");
  }
  if (!recipient.email) {
    problems.push(
      `${recipient.booking.fullName || "This person"} has no email address. Add one on the people list.`,
    );
  }
  if (recipient.booking.cancelled) {
    problems.push("This booking is cancelled.");
  }

  if (kinds.length < chosenKinds.length) {
    composed.warnings.push(
      "The confirmation PDF is left off, because their deposit hasn't arrived yet.",
    );
  }

  const testing = settings.emailTestAddress;
  if (testing && recipient.email) {
    composed.subject = `[Test: for ${recipient.email}] ${composed.subject}`;
  }

  return {
    recipient,
    templateKey: "template" in choice ? choice.template : "other",
    sendTo: testing || recipient.email,
    test: Boolean(testing),
    idempotencyKey,
    composed,
    attachments: kinds.map((kind) => ({
      kind,
      filename: documentFileName(kind, event.title),
      title: DOCUMENT_TITLES[kind],
    })),
    problems,
  };
}

export type SendOutcome =
  { sent: true; to: string; warning?: string } | { sent: false; error: string };

/** Sends a prepared email with its attachments, and logs it either way. */
export async function sendPreparedEmail(
  supabase: Supabase,
  context: EmailContext,
  prepared: PreparedEmail,
): Promise<SendOutcome> {
  if (prepared.problems.length) {
    return { sent: false, error: prepared.problems.join(" ") };
  }
  if (emailTransport() === "off") {
    return {
      sent: false,
      error:
        "Sending emails isn't switched on yet, so nothing was sent. See docs/setup.md.",
    };
  }
  const to = prepared.sendTo!;
  const attachments = await Promise.all(
    prepared.attachments.map(async (attachment) => ({
      filename: attachment.filename,
      content: await renderDocument(attachment.kind, {
        settings: context.settings,
        event: context.event,
        booking: prepared.recipient.booking,
        today: ukToday(),
      }),
    })),
  );
  const result = await sendEmail({
    to: { email: to, name: prepared.recipient.booking.fullName },
    replyTo: context.settings.emailReplyTo,
    subject: prepared.composed.subject,
    text: prepared.composed.text,
    html: prepared.composed.html,
    attachments,
    idempotencyKey: prepared.idempotencyKey,
  });

  const { error: logError } = await supabase.rpc("log_email", {
    booking_id: prepared.recipient.bookingId,
    template: prepared.templateKey,
    subject: prepared.composed.subject,
    to_email: to,
    body: prepared.composed.body,
    attachments: prepared.attachments.map((attachment) => attachment.filename),
    sent: result.ok,
    provider_message_id: result.ok ? (result.id ?? undefined) : undefined,
    error: result.ok ? "" : result.error,
    test: prepared.test,
  });

  if (!result.ok) return { sent: false, error: result.error };
  return logError
    ? {
        sent: true,
        to,
        warning:
          "It was sent, but couldn't be added to the email log, so it won't show in the list of emails sent.",
      }
    : { sent: true, to };
}

/** Prepares and sends one email about one booking. */
export async function sendBookingEmail(
  supabase: Supabase,
  bookingId: string,
  choice: EmailChoice,
  payment?: EmailPayment,
): Promise<SendOutcome> {
  const recipient = await loadEmailRecipient(supabase, bookingId);
  if (!recipient)
    return { sent: false, error: "That booking couldn't be found." };
  const context = await loadEmailContext(supabase, recipient.eventId);
  if (!context) {
    return {
      sent: false,
      error: "Only owners and admins can send emails.",
    };
  }
  return sendPreparedEmail(
    supabase,
    context,
    prepareEmail(context, recipient, choice, payment ?? recipient.lastPayment),
  );
}
