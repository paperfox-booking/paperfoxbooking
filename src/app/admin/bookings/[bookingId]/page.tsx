import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Card, Notice } from "@/components/ui/card";
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
import { getEvent } from "@/lib/events/admin";
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
} from "./forms";

export const metadata: Metadata = { title: "Booking" };

const NOTICES = {
  "payment-recorded": { text: "Payment recorded." },
  "payment-removed": {
    text: "Payment removed. It's still shown in the history.",
  },
  "email-recorded": { text: "Email recorded." },
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
  const [event, rooms, { notice }] = await Promise.all([
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

  return (
    <div className="space-y-8">
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
              {booking.emails.map((email) => (
                <li
                  key={email.id}
                  className="rounded-lg border border-cream bg-white p-3"
                >
                  <strong>
                    {EMAIL_TEMPLATE_LABELS[
                      email.template as keyof typeof EMAIL_TEMPLATE_LABELS
                    ] ?? email.template}
                  </strong>
                  {email.sentOn
                    ? `, sent ${formatUkDate(email.sentOn)}`
                    : ", date not known"}
                  {email.note ? `. ${email.note}` : null}
                  <span className="block text-sm text-stone">
                    {email.outsideSystem
                      ? `Sent outside the system, recorded by ${who(email.createdBy)}`
                      : "Sent by the system"}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
