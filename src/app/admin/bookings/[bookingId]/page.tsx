import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { EmailPreview } from "@/components/admin/email-preview";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { getBookingDetail, listRooms } from "@/lib/bookings/admin";
import { describeChange } from "@/lib/bookings/history";
import {
  PAYMENT_STATE_LABELS,
  bookingMoney,
  sumPayments,
} from "@/lib/bookings/money";
import {
  formatUkDate,
  formatUkDateRange,
  formatUkDateTime,
  formatUkLongDate,
  ukToday,
} from "@/lib/dates";
import {
  TEMPLATE_KEYS,
  isTemplateKey,
  loadEmailContext,
  loadEmailRecipient,
  prepareEmail,
  type TemplateKey,
} from "@/lib/email/booking-emails";
import { emailTransport } from "@/lib/email/transport";
import { getEvent } from "@/lib/events/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPrice, penceToPoundsInput } from "@/lib/money";
import {
  EMAIL_TEMPLATE_LABELS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/validation/bookings";
import { isUuid } from "@/lib/validation/ids";
import { cn } from "@/lib/utils";
import {
  CancelForm,
  PriceForm,
  RecordEmailForm,
  RecordPaymentForm,
  ReinstateForm,
  RemovePaymentForm,
  SendEmailForm,
} from "./forms";

export const metadata: Metadata = { title: "Booking" };

const NOTICES = {
  "payment-recorded": { text: "Payment recorded." },
  "payment-removed": {
    text: "Payment removed. It's still shown in the history.",
  },
  "email-recorded": { text: "Email recorded." },
  "email-sent": { text: "Email sent." },
  "booked-from-waitlist": {
    text: "Booked in from the waiting list. Send them B1 below, with how to pay.",
  },
  "price-changed": { text: "Price changed." },
  cancelled: { text: "The booking has been cancelled and the place freed up." },
  reinstated: { text: "The booking has been reinstated." },
};

export default function BookingPage(
  props: PageProps<"/admin/bookings/[bookingId]">,
) {
  return (
    <Suspense fallback={<p>Loading the booking…</p>}>
      <Booking params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Booking({
  params,
  searchParams,
}: Pick<PageProps<"/admin/bookings/[bookingId]">, "params" | "searchParams">) {
  const { bookingId } = await params;
  const access = await requireStaff(
    `/admin/bookings/${bookingId}`,
    "bookings.view",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(bookingId)) notFound();

  const booking = await getBookingDetail(bookingId);
  if (!booking) notFound();
  const [event, rooms, { notice, email: emailOutcome, preview }] =
    await Promise.all([
      getEvent(booking.event.id),
      listRooms(booking.event.id),
      searchParams,
    ]);

  const role = access.user.staffRole;
  const canEdit = can(role, "bookings.manage");
  const canSeeMoney = can(role, "payments.view");
  const today = ukToday();
  const paidPence = sumPayments(
    booking.payments.map((payment) => ({
      amount_pence: payment.amountPence,
      deleted_at: payment.deletedAt,
    })),
  );
  const money = bookingMoney(
    {
      pricePence: booking.pricePence,
      depositPence: booking.depositPence,
      paidPence,
      cancelled: booking.cancelledAt !== null,
      balanceDueOn: booking.event.balanceDueOn,
    },
    today,
  );
  const names = {
    options: new Map(
      (event?.options ?? []).map((option) => [option.id, option.name]),
    ),
    rooms: new Map(rooms.map((room) => [room.id, room.name])),
  };
  const who = (id: string | null) =>
    id ? (booking.people.get(id) ?? "Someone on the team") : "Imported";
  const suggested =
    money.depositOwedPence > 0
      ? money.depositOwedPence
      : Math.max(money.balancePence, 0);
  const cancelled = booking.cancelledAt !== null;
  const canMessage = can(role, "attendees.message");
  // The email most likely needed next, picked in the Send an email list.
  const nextEmail: TemplateKey =
    money.state === "paid"
      ? "B3"
      : money.state === "deposit_paid" || money.state === "part_paid"
        ? "balance_reminder"
        : "B1";
  const previewKey = isTemplateKey(preview) ? preview : null;
  const emailPreview =
    canMessage && previewKey ? await loadPreview(bookingId, previewKey) : null;

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <p>
          <Link href={`/admin/events/${booking.event.id}/people`}>
            Back to everyone booked on {booking.event.title}
          </Link>
        </p>
        <h1 className="mt-2 text-5xl">{booking.customer.fullName}</h1>
        <p className="mt-1 text-lg">
          {booking.reference} ·{" "}
          <Link href={`/admin/events/${booking.event.id}`}>
            {booking.event.title}
          </Link>
          , {formatUkDateRange(booking.event.startsAt, booking.event.endsAt)}
        </p>
        <p className="mt-1">
          <Link href={`/admin/people/${booking.customer.id}`}>
            See {booking.customer.fullName}&apos;s details and other bookings
          </Link>
        </p>
        <PageNotice notice={notice} messages={NOTICES} />
        <PaymentEmailNotice outcome={emailOutcome} />
        {cancelled ? (
          <Notice tone="error" className="mt-4">
            Cancelled on {formatUkDate(booking.cancelledAt!)}:{" "}
            {booking.cancelReason}
          </Notice>
        ) : null}
      </div>

      <Card>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
          <Row label="Option">
            {booking.optionId
              ? (names.options.get(booking.optionId) ?? "Removed option")
              : "No option"}
          </Row>
          <Row label="Room">
            {booking.roomId
              ? (names.rooms.get(booking.roomId) ?? "Removed room")
              : "No room"}
          </Row>
          {canSeeMoney ? (
            <>
              <Row label="Total due">
                {formatPrice(booking.pricePence)}
                {booking.priceNote ? ` (${booking.priceNote})` : null}
              </Row>
              <Row label="Deposit">
                {booking.depositPence === null
                  ? "None: paid in full"
                  : formatPrice(booking.depositPence)}
              </Row>
              <Row label="Paid">{formatPrice(paidPence)}</Row>
              <Row label="Still to pay">
                <span className={cn(money.overdue && "font-bold text-danger")}>
                  {money.balancePence < 0
                    ? `Overpaid by ${formatPrice(-money.balancePence)}`
                    : formatPrice(money.balancePence)}
                  {money.overdue ? " (overdue)" : null}
                </span>
              </Row>
              <Row label="Status">{PAYMENT_STATE_LABELS[money.state]}</Row>
              <Row label="Balance due by">
                {formatUkLongDate(booking.event.balanceDueOn)}
              </Row>
              {booking.paymentNotes ? (
                <Row label="Payment notes">{booking.paymentNotes}</Row>
              ) : null}
            </>
          ) : null}
          {booking.notes ? <Row label="Notes">{booking.notes}</Row> : null}
          <Row label="Booked">
            {formatUkDateTime(booking.createdAt)}
            {booking.source === "import" ? ", from the spreadsheet" : null}
          </Row>
        </dl>
        {canEdit ? (
          <p className="mt-4 text-stone">
            To change their option, room, notes or contact details, use the{" "}
            <Link href={`/admin/events/${booking.event.id}/people`}>
              people booked list
            </Link>
            .
          </p>
        ) : null}
      </Card>

      {canSeeMoney ? (
        <Section title="Payments">
          {booking.payments.length === 0 ? (
            <p>No payments yet.</p>
          ) : (
            <ul className="space-y-3">
              {booking.payments.map((payment) => {
                const label = formatPrice(payment.amountPence);
                return (
                  <li
                    key={payment.id}
                    className={cn(
                      "rounded-lg border border-cream bg-white p-4",
                      payment.deletedAt && "text-stone",
                    )}
                  >
                    <p>
                      <strong
                        className={cn(payment.deletedAt && "line-through")}
                      >
                        {label}
                      </strong>{" "}
                      {PAYMENT_METHOD_LABELS[payment.method]?.toLowerCase() ??
                        payment.method}
                      {payment.receivedOn
                        ? `, received ${formatUkDate(payment.receivedOn)}`
                        : null}
                      {payment.note ? `. ${payment.note}` : null}
                    </p>
                    <p className="text-sm text-stone">
                      Recorded by {who(payment.recordedBy)}
                    </p>
                    {payment.deletedAt ? (
                      <p className="font-bold">
                        Removed: {payment.deleteReason}
                      </p>
                    ) : canEdit ? (
                      <RemovePaymentForm
                        bookingId={booking.id}
                        paymentId={payment.id}
                        label={label}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {canEdit && !cancelled ? (
            <Card>
              <h3 className="mb-3 text-2xl">Record a payment</h3>
              <RecordPaymentForm
                bookingId={booking.id}
                today={today}
                suggested={suggested ? penceToPoundsInput(suggested) : ""}
              />
            </Card>
          ) : null}
        </Section>
      ) : null}

      {canSeeMoney ? (
        <Section title="Emails sent">
          {booking.emails.length === 0 ? (
            <p>No emails recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {booking.emails.map((email) => {
                const label =
                  EMAIL_TEMPLATE_LABELS[
                    email.template as keyof typeof EMAIL_TEMPLATE_LABELS
                  ] ?? email.template;
                const failed = email.status === "failed";
                const test = email.status === "test";
                return (
                  <li
                    key={email.id}
                    className={cn(
                      "rounded-lg border bg-white p-3",
                      failed ? "border-danger" : "border-cream",
                    )}
                  >
                    <strong>{label}</strong>
                    {failed
                      ? `, not sent${email.sentAt ? ` (${formatUkDateTime(email.sentAt)})` : ""}`
                      : test
                        ? `, test only${email.sentAt ? ` (${formatUkDateTime(email.sentAt)})` : ""}: sent to the test address, not to them`
                        : email.sentAt
                          ? `, sent ${formatUkDateTime(email.sentAt)}`
                          : email.sentOn
                            ? `, sent ${formatUkDate(email.sentOn)}`
                            : ", date not known"}
                    {email.note ? `. ${email.note}` : null}
                    {email.subject ? (
                      <span className="block">
                        &ldquo;{email.subject}&rdquo;
                        {email.toEmail ? ` to ${email.toEmail}` : null}
                      </span>
                    ) : null}
                    {email.attachments.length ? (
                      <span className="block text-sm">
                        Attached: {email.attachments.join(", ")}
                      </span>
                    ) : null}
                    {failed ? (
                      <span className="block font-bold text-danger">
                        Why: {email.error || "not known"}
                      </span>
                    ) : null}
                    <span className="block text-sm text-stone">
                      {email.outsideSystem
                        ? `Sent outside the system, recorded by ${who(email.createdBy)}`
                        : `Sent by the system, by ${who(email.createdBy)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {canMessage && !cancelled ? (
            <Card id="send-email">
              <h3 className="mb-3 text-2xl">Send an email</h3>
              {emailTransport() === "off" ? (
                <Notice className="mb-3">
                  Sending emails isn&apos;t switched on yet, so you can preview
                  emails but not send them. See Settings.
                </Notice>
              ) : null}
              <form
                method="get"
                action={`/admin/bookings/${booking.id}#send-email`}
                className="flex flex-wrap items-end gap-3"
              >
                <div>
                  <label htmlFor="preview-email" className="block font-bold">
                    Email to send
                  </label>
                  <Select
                    id="preview-email"
                    name="preview"
                    defaultValue={previewKey ?? nextEmail}
                    className="max-w-sm"
                  >
                    {TEMPLATE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {EMAIL_TEMPLATE_LABELS[key]}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" variant="secondary">
                  Preview
                </Button>
              </form>
              {emailPreview ? (
                <div className="mt-4 space-y-4">
                  <EmailPreview
                    prepared={emailPreview.prepared}
                    testAddress={emailPreview.testAddress}
                    attachmentHref={(kind) =>
                      `/admin/bookings/${booking.id}/documents/${kind}`
                    }
                  />
                  <SendEmailForm
                    bookingId={booking.id}
                    template={emailPreview.prepared.templateKey}
                    label={
                      EMAIL_TEMPLATE_LABELS[
                        emailPreview.prepared
                          .templateKey as keyof typeof EMAIL_TEMPLATE_LABELS
                      ]
                    }
                    disabled={
                      emailPreview.prepared.problems.length > 0 ||
                      emailTransport() === "off"
                    }
                  />
                </div>
              ) : null}
            </Card>
          ) : null}
          {canEdit ? (
            <details className="rounded-2xl border border-cream bg-white p-4">
              <summary className="cursor-pointer font-bold">
                Record an email sent outside the system
              </summary>
              <div className="mt-3">
                <RecordEmailForm bookingId={booking.id} today={today} />
              </div>
            </details>
          ) : null}
        </Section>
      ) : null}

      {canEdit ? (
        <Section title="Changes">
          {!cancelled ? (
            <details className="rounded-2xl border border-cream bg-white p-4">
              <summary className="cursor-pointer font-bold">
                Change the price
              </summary>
              <div className="mt-3">
                <PriceForm
                  bookingId={booking.id}
                  price={penceToPoundsInput(booking.pricePence)}
                  deposit={
                    booking.depositPence === null
                      ? ""
                      : penceToPoundsInput(booking.depositPence)
                  }
                />
              </div>
            </details>
          ) : null}
          {cancelled ? (
            <ReinstateForm bookingId={booking.id} />
          ) : (
            <details className="rounded-2xl border border-cream bg-white p-4">
              <summary className="cursor-pointer font-bold">
                Cancel this booking
              </summary>
              <div className="mt-3">
                <CancelForm bookingId={booking.id} />
              </div>
            </details>
          )}
        </Section>
      ) : null}

      {canSeeMoney ? (
        <Section title="History">
          {booking.history.length === 0 ? (
            <p>No changes recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {booking.history.map((entry, index) => {
                const lines = describeChange(entry, names);
                if (lines.length === 0) return null;
                return (
                  <li key={index} className="border-l-4 border-cream pl-3">
                    <p className="text-sm text-stone">
                      {formatUkDateTime(entry.changed_at)} by{" "}
                      {who(entry.changedBy)}
                    </p>
                    {lines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      ) : null}
    </div>
  );
}

/** An email filled in for this booking, ready to check and send. */
async function loadPreview(bookingId: string, key: TemplateKey) {
  const supabase = await createSupabaseServerClient();
  const recipient = await loadEmailRecipient(supabase, bookingId);
  if (!recipient) return null;
  const context = await loadEmailContext(supabase, recipient.eventId);
  if (!context) return null;
  return {
    prepared: prepareEmail(context, recipient, { template: key }),
    testAddress: context.settings.emailTestAddress,
  };
}

/** What happened about the email after a payment (?email=B2.sent). */
function PaymentEmailNotice({
  outcome,
}: {
  outcome: string | string[] | undefined;
}) {
  if (typeof outcome !== "string") return null;
  const [template, result] = outcome.split(".");
  const label =
    EMAIL_TEMPLATE_LABELS[template as keyof typeof EMAIL_TEMPLATE_LABELS];
  if (!label) return null;
  if (result === "sent") {
    return <Notice className="mt-2">{label} has been emailed to them.</Notice>;
  }
  if (result === "failed") {
    return (
      <Notice tone="error" className="mt-2">
        {label} couldn&apos;t be emailed. Emails sent, below, says why. You can
        send it again from there.
      </Notice>
    );
  }
  if (result === "off") {
    return (
      <Notice className="mt-2">
        No email was sent, because sending emails isn&apos;t switched on yet.
      </Notice>
    );
  }
  return null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `${title.toLowerCase().replace(/[^a-z]+/g, "-")}-heading`;
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-bold">{label}</dt>
      <dd className="break-words">{children}</dd>
    </>
  );
}
