"use server";

import { redirect } from "next/navigation";
import { staffWithPermission } from "@/lib/auth/session";
import { getPersonRow, type PersonRow } from "@/lib/bookings/admin";
import { toUkDateInput } from "@/lib/dates";
import {
  isTemplateKey,
  loadEmailRecipient,
  sendBookingEmail,
} from "@/lib/email/booking-emails";
import {
  emailAfterRecordingPayment,
  paymentStateOf,
} from "@/lib/email/payment-emails";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import type { TablesUpdate } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ADD_PERSON_FIELDS,
  CANCEL_FIELDS,
  CELL_COLUMNS,
  EMAIL_RECORD_FIELDS,
  PAYMENT_FIELDS,
  PERSON_CELLS,
  PRICE_FIELDS,
  addPersonSchema,
  cancelSchema,
  cellSchemas,
  emailRecordSchema,
  isCell,
  paymentSchema,
  priceSchema,
  removePaymentSchema,
  type AddPersonField,
  type CancelField,
  type EmailRecordField,
  type PaymentField,
  type PriceField,
} from "@/lib/validation/bookings";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";

/**
 * Everything the team does to bookings and payments. Each action checks the
 * person's permission (the database checks again with row level security)
 * and validates every value. Changes are recorded in the audit log by the
 * database.
 */

const NOT_ALLOWED =
  "You need to be signed in as an owner or admin to change bookings.";
const EMAIL_TAKEN =
  "Someone else already has that email address. Each person needs their own.";

function today(): string {
  return toUkDateInput(new Date());
}

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

/** The option's price and deposit, if it belongs to this event. */
async function optionPrice(
  supabase: Supabase,
  eventId: string,
  optionId: string,
): Promise<{ price_pence: number; deposit_pence: number | null } | null> {
  const { data } = await supabase
    .from("ticket_types")
    .select("price_pence, deposit_pence")
    .eq("id", optionId)
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .maybeSingle();
  return data;
}

// ---------------------------------------------------------------------------
// The spreadsheet screen
// ---------------------------------------------------------------------------

export type CellResult =
  | { ok: true; row: PersonRow; emailNote?: string }
  | { ok: false; error: string };

/** Saves one cell of the spreadsheet screen and returns the updated row. */
export async function saveCellAction(
  bookingId: string,
  field: string,
  value: string,
): Promise<CellResult> {
  if (!(await staffWithPermission("bookings.manage"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  if (!isCell(field)) return { ok: false, error: "That can't be changed." };
  const parsed = cellSchemas[field].safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check this",
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("customer_id, event_id, ticket_type_id, price_pence, deposit_pence")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) {
    return { ok: false, error: "That booking couldn't be found." };
  }

  let error: { code?: string; message?: string } | null = null;
  if ((PERSON_CELLS as readonly string[]).includes(field)) {
    // The column comes from CELL_COLUMNS and the value from its own check.
    const update = {
      [CELL_COLUMNS[field]]: parsed.data,
    } as TablesUpdate<"customers">;
    ({ error } = await supabase
      .from("customers")
      .update(update)
      .eq("id", booking.customer_id));
  } else if (field === "optionId") {
    const optionId = parsed.data as string | null;
    const update: {
      ticket_type_id: string | null;
      price_pence?: number;
      deposit_pence?: number | null;
    } = { ticket_type_id: optionId };
    // Follow the new option's price, unless this booking had its own price.
    const previous = booking.ticket_type_id
      ? await optionPrice(supabase, booking.event_id, booking.ticket_type_id)
      : null;
    const next = optionId
      ? await optionPrice(supabase, booking.event_id, optionId)
      : null;
    if (optionId && !next) {
      return { ok: false, error: "Choose an option from the list." };
    }
    if (next && (!previous || previous.price_pence === booking.price_pence)) {
      update.price_pence = next.price_pence;
      update.deposit_pence =
        next.deposit_pence !== null && next.deposit_pence <= next.price_pence
          ? next.deposit_pence
          : null;
    }
    ({ error } = await supabase
      .from("bookings")
      .update(update)
      .eq("id", bookingId));
  } else {
    const update = {
      [CELL_COLUMNS[field]]: parsed.data,
    } as TablesUpdate<"bookings">;
    ({ error } = await supabase
      .from("bookings")
      .update(update)
      .eq("id", bookingId));
  }

  if (error) {
    if (error.code === "23505") return { ok: false, error: EMAIL_TAKEN };
    if (error.code === "23503") {
      return { ok: false, error: "Choose from the list." };
    }
    return { ok: false, error: friendlyDatabaseError(error) };
  }

  const row = await getPersonRow(bookingId);
  if (!row) return { ok: false, error: "That booking couldn't be found." };
  return { ok: true, row };
}

export type AddPersonState = FormState<AddPersonField> & { row?: PersonRow };

/** Books someone onto an event, reusing their record if they've been before. */
export async function addPersonAction(
  eventId: string,
  _previous: AddPersonState,
  formData: FormData,
): Promise<AddPersonState> {
  const values = readForm(formData, ADD_PERSON_FIELDS);
  if (!(await staffWithPermission("bookings.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = addPersonSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const person = parsed.data;
  const supabase = await createSupabaseServerClient();

  let customerId: string | null = null;
  if (person.email) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("email", person.email)
      .is("deleted_at", null)
      .maybeSingle();
    customerId = existing?.id ?? null;
  }
  if (!customerId) {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({ full_name: person.fullName, email: person.email })
      .select("id")
      .single();
    if (error) {
      return {
        values,
        error:
          error.code === "23505" ? EMAIL_TAKEN : friendlyDatabaseError(error),
      };
    }
    customerId = created.id;
  }

  const option = person.optionId
    ? await optionPrice(supabase, eventId, person.optionId)
    : null;
  if (person.optionId && !option) {
    return {
      values,
      fieldErrors: { optionId: "Choose an option from the list" },
    };
  }

  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      event_id: eventId,
      customer_id: customerId,
      ticket_type_id: person.optionId,
      room_id: person.roomId,
      price_pence: option?.price_pence ?? 0,
      deposit_pence: option?.deposit_pence ?? null,
      source: "staff",
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return {
        values,
        error: `${person.fullName} is already booked on this event.`,
      };
    }
    return { values, error: friendlyDatabaseError(error) };
  }

  const row = await getPersonRow(booking.id);
  return row
    ? { row }
    : { error: "Added, but the list couldn't be updated. Refresh the page." };
}

export type PaymentState = FormState<PaymentField> & {
  done?: boolean;
  row?: PersonRow;
  /** What happened about the email that follows a payment. */
  emailNote?: string;
};

/** Records money received for a booking. */
export async function recordPaymentAction(
  bookingId: string,
  _previous: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const values = readForm(formData, PAYMENT_FIELDS);
  if (!(await staffWithPermission("payments.record"))) {
    return {
      values,
      error: "You need to be an owner or admin to record payments.",
    };
  }
  const parsed = paymentSchema(today()).safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const before = await loadEmailRecipient(supabase, bookingId);
  const { error } = await supabase.from("payments").insert({
    booking_id: bookingId,
    amount_pence: parsed.data.amount,
    received_on: parsed.data.receivedOn,
    method: parsed.data.method,
    note: parsed.data.note,
  });
  if (error) return { values, error: friendlyDatabaseError(error) };
  const email = await emailAfterRecordingPayment(
    supabase,
    bookingId,
    before ? paymentStateOf(before) : null,
    { amountPence: parsed.data.amount, receivedOn: parsed.data.receivedOn },
  );

  if (formData.get("returnTo") === "booking") {
    redirect(
      `/admin/bookings/${bookingId}?notice=payment-recorded${
        email ? `&email=${email.template}.${email.outcome}` : ""
      }`,
    );
  }
  const row = await getPersonRow(bookingId);
  return { done: true, row: row ?? undefined, emailNote: email?.text };
}

// ---------------------------------------------------------------------------
// A booking's own page
// ---------------------------------------------------------------------------

export type SimpleState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function removePaymentAction(
  bookingId: string,
  paymentId: string,
  _previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  if (!(await staffWithPermission("payments.record"))) {
    return { error: "You need to be an owner or admin to remove payments." };
  }
  const parsed = removePaymentSchema.safeParse({
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.success) {
    return { fieldErrors: { reason: parsed.error.issues[0]!.message } };
  }
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("payments")
    .update(
      {
        deleted_at: new Date().toISOString(),
        delete_reason: parsed.data.reason,
      },
      { count: "exact" },
    )
    .eq("id", paymentId)
    .eq("booking_id", bookingId)
    .is("deleted_at", null);
  if (error) return { error: friendlyDatabaseError(error) };
  if (count === 0) return { error: "That payment has already been removed." };
  redirect(`/admin/bookings/${bookingId}?notice=payment-removed`);
}

export type EmailRecordState = FormState<EmailRecordField>;

export async function recordEmailAction(
  bookingId: string,
  _previous: EmailRecordState,
  formData: FormData,
): Promise<EmailRecordState> {
  const values = readForm(formData, EMAIL_RECORD_FIELDS);
  if (!(await staffWithPermission("bookings.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = emailRecordSchema(today()).safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("customer_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { values, error: "That booking couldn't be found." };
  const { error } = await supabase.from("email_log").insert({
    booking_id: bookingId,
    customer_id: booking.customer_id,
    template: parsed.data.template,
    sent_on: parsed.data.sentOn,
    note: parsed.data.note,
  });
  if (error) return { values, error: friendlyDatabaseError(error) };
  redirect(`/admin/bookings/${bookingId}?notice=email-recorded`);
}

export type PriceState = FormState<PriceField>;

export async function changePriceAction(
  bookingId: string,
  _previous: PriceState,
  formData: FormData,
): Promise<PriceState> {
  const values = readForm(formData, PRICE_FIELDS);
  if (!(await staffWithPermission("bookings.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = priceSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("bookings")
    .update(
      {
        price_pence: parsed.data.price,
        deposit_pence: parsed.data.deposit,
        price_note: parsed.data.reason,
      },
      { count: "exact" },
    )
    .eq("id", bookingId);
  if (error) return { values, error: friendlyDatabaseError(error) };
  if (count === 0) return { values, error: "That booking couldn't be found." };
  redirect(`/admin/bookings/${bookingId}?notice=price-changed`);
}

export type CancelState = FormState<CancelField>;

export async function cancelBookingAction(
  bookingId: string,
  _previous: CancelState,
  formData: FormData,
): Promise<CancelState> {
  const values = readForm(formData, CANCEL_FIELDS);
  if (!(await staffWithPermission("bookings.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = cancelSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("bookings")
    .update(
      {
        cancelled_at: new Date().toISOString(),
        cancel_reason: parsed.data.reason,
      },
      { count: "exact" },
    )
    .eq("id", bookingId)
    .is("cancelled_at", null);
  if (error) return { values, error: friendlyDatabaseError(error) };
  if (count === 0) {
    return { values, error: "This booking has already been cancelled." };
  }
  redirect(`/admin/bookings/${bookingId}?notice=cancelled`);
}

export async function reinstateBookingAction(
  bookingId: string,
): Promise<SimpleState> {
  if (!(await staffWithPermission("bookings.manage"))) {
    return { error: NOT_ALLOWED };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("bookings")
    .update({ cancelled_at: null, cancel_reason: "" })
    .eq("id", bookingId);
  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "This person already has another place on this event, so this booking can't be reinstated.",
      };
    }
    return { error: friendlyDatabaseError(error) };
  }
  redirect(`/admin/bookings/${bookingId}?notice=reinstated`);
}

/**
 * The spreadsheet screen's Pay box: records a bank transfer received today,
 * for the amount typed. Anything else (cash, another date, a note) uses the
 * full payment form.
 */
export async function quickPaymentAction(
  bookingId: string,
  amount: string,
): Promise<CellResult> {
  if (!(await staffWithPermission("payments.record"))) {
    return {
      ok: false,
      error: "You need to be an owner or admin to record payments.",
    };
  }
  const parsed = paymentSchema(today()).safeParse({
    amount,
    receivedOn: today(),
    method: "bank_transfer",
    note: "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the amount",
    };
  }
  const supabase = await createSupabaseServerClient();
  const before = await loadEmailRecipient(supabase, bookingId);
  const { error } = await supabase.from("payments").insert({
    booking_id: bookingId,
    amount_pence: parsed.data.amount,
    received_on: parsed.data.receivedOn,
    method: "bank_transfer",
  });
  if (error) return { ok: false, error: friendlyDatabaseError(error) };
  const email = await emailAfterRecordingPayment(
    supabase,
    bookingId,
    before ? paymentStateOf(before) : null,
    { amountPence: parsed.data.amount, receivedOn: parsed.data.receivedOn },
  );
  const row = await getPersonRow(bookingId);
  if (!row) return { ok: false, error: "That booking couldn't be found." };
  return { ok: true, row, emailNote: email?.text };
}

// ---------------------------------------------------------------------------
// Sending an email from a booking's page
// ---------------------------------------------------------------------------

export type SendEmailState = { error?: string };

/** Sends one of the standard emails to the person on this booking. */
export async function sendEmailAction(
  bookingId: string,
  _previous: SendEmailState,
  formData: FormData,
): Promise<SendEmailState> {
  if (!(await staffWithPermission("attendees.message"))) {
    return { error: "You need to be an owner or admin to send emails." };
  }
  const template = formData.get("template");
  if (!isTemplateKey(template)) {
    return { error: "Choose which email to send." };
  }
  const supabase = await createSupabaseServerClient();
  const outcome = await sendBookingEmail(supabase, bookingId, { template });
  if (!outcome.sent) return { error: outcome.error };
  redirect(`/admin/bookings/${bookingId}?notice=email-sent`);
}
