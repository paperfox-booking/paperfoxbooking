"use client";

import { useActionState, useRef } from "react";
import {
  MoneyField,
  SelectField,
  TextField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/validation/bookings";
import {
  cancelBookingAction,
  changePriceAction,
  passPlaceAction,
  recordEmailAction,
  recordPaymentAction,
  recordRefundAction,
  reinstateBookingAction,
  removePaymentAction,
  removeRefundAction,
  sendEmailAction,
  type CancelState,
  type EmailRecordState,
  type PassPlaceState,
  type PaymentState,
  type PriceState,
  type RefundState,
  type SendEmailState,
  type SimpleState,
} from "../actions";

/** The forms on a booking's own page. Each one returns here when it's done. */

export function RecordPaymentForm({
  bookingId,
  today,
  suggested,
}: {
  bookingId: string;
  today: string;
  suggested: string;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: PaymentState, formData: FormData) =>
      recordPaymentAction(bookingId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="returnTo" value="booking" />
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          name="amount"
          label="Amount received"
          error={errors.amount}
          defaultValue={state.values?.amount ?? suggested}
        />
        <TextField
          name="receivedOn"
          type="date"
          label="Date it arrived"
          error={errors.receivedOn}
          defaultValue={state.values?.receivedOn ?? today}
          max={today}
          className="max-w-56"
        />
        <SelectField
          name="method"
          label="How it was paid"
          error={errors.method}
          defaultValue={state.values?.method ?? "bank_transfer"}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="payment-note"
          name="note"
          label="Note (optional)"
          hint="For example the bank statement reference."
          error={errors.note}
          defaultValue={state.values?.note ?? ""}
          maxLength={500}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record payment"}
      </Button>
    </form>
  );
}

export function RemovePaymentForm({
  bookingId,
  paymentId,
  label,
}: {
  bookingId: string;
  paymentId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: SimpleState, formData: FormData) =>
      removePaymentAction(bookingId, paymentId, previous, formData),
    {},
  );
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-coral-deep underline">
        Remove<span className="sr-only"> the payment of {label}</span>
      </summary>
      <form action={formAction} className="mt-2 space-y-3" noValidate>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <TextField
          id={`reason-${paymentId}`}
          name="reason"
          label="Why it's being removed"
          hint="For example, recorded twice. The payment stays in the history."
          error={state.fieldErrors?.reason}
          maxLength={500}
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          Remove the payment of {label}
        </Button>
      </form>
    </details>
  );
}

export function RecordRefundForm({
  bookingId,
  today,
  most,
}: {
  bookingId: string;
  today: string;
  /** The most that can be refunded, for the hint. */
  most: string;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: RefundState, formData: FormData) =>
      recordRefundAction(bookingId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <p>
        Make the refund in online banking first, then record it here. It comes
        off what they&apos;ve paid, and off the event&apos;s income.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          id="refund-amount"
          name="amount"
          label="Amount refunded"
          hint={`The most you can refund is ${most}.`}
          error={errors.amount}
          defaultValue={state.values?.amount ?? ""}
        />
        <TextField
          id="refund-date"
          name="refundedOn"
          type="date"
          label="Date it was paid back"
          error={errors.refundedOn}
          defaultValue={state.values?.refundedOn ?? today}
          max={today}
          className="max-w-56"
        />
        <SelectField
          id="refund-method"
          name="method"
          label="How it was paid back"
          error={errors.method}
          defaultValue={state.values?.method ?? "bank_transfer"}
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </SelectField>
        <TextField
          id="refund-reason"
          name="reason"
          label="Why"
          hint="For example, cancelled more than 6 weeks before, £60 fee kept."
          error={errors.reason}
          defaultValue={state.values?.reason ?? ""}
          maxLength={500}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record refund"}
      </Button>
    </form>
  );
}

export function RemoveRefundForm({
  bookingId,
  refundId,
  label,
}: {
  bookingId: string;
  refundId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: SimpleState, formData: FormData) =>
      removeRefundAction(bookingId, refundId, previous, formData),
    {},
  );
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-coral-deep underline">
        Remove<span className="sr-only"> the refund of {label}</span>
      </summary>
      <form action={formAction} className="mt-2 space-y-3" noValidate>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <TextField
          id={`refund-reason-${refundId}`}
          name="reason"
          label="Why it's being removed"
          hint="For example, recorded on the wrong booking. It stays in the history."
          error={state.fieldErrors?.reason}
          maxLength={500}
        />
        <Button type="submit" variant="secondary" disabled={pending}>
          Remove the refund of {label}
        </Button>
      </form>
    </details>
  );
}

export function RecordEmailForm({
  bookingId,
  today,
}: {
  bookingId: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: EmailRecordState, formData: FormData) =>
      recordEmailAction(bookingId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          name="template"
          label="Which email"
          error={errors.template}
          defaultValue={state.values?.template ?? "B1"}
        >
          {EMAIL_TEMPLATES.map((template) => (
            <option key={template} value={template}>
              {EMAIL_TEMPLATE_LABELS[template]}
            </option>
          ))}
        </SelectField>
        <TextField
          name="sentOn"
          type="date"
          label="Date it was sent"
          error={errors.sentOn}
          defaultValue={state.values?.sentOn ?? today}
          max={today}
          className="max-w-56"
        />
      </div>
      <TextField
        id="email-note"
        name="note"
        label="Note (optional)"
        error={errors.note}
        defaultValue={state.values?.note ?? ""}
        maxLength={500}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Record email"}
      </Button>
    </form>
  );
}

export function PriceForm({
  bookingId,
  price,
  deposit,
}: {
  bookingId: string;
  price: string;
  deposit: string;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: PriceState, formData: FormData) =>
      changePriceAction(bookingId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField
          name="price"
          label="Total due"
          error={errors.price}
          defaultValue={state.values?.price ?? price}
        />
        <MoneyField
          name="deposit"
          label="Deposit (optional)"
          hint="Leave empty if they pay in full."
          error={errors.deposit}
          defaultValue={state.values?.deposit ?? deposit}
        />
      </div>
      <TextField
        id="price-reason"
        name="reason"
        label="Why the price is different"
        hint="For example, returning customer discount. It's kept with the booking."
        error={errors.reason}
        defaultValue={state.values?.reason ?? ""}
        maxLength={300}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Change the price"}
      </Button>
    </form>
  );
}

export function CancelForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState(
    (previous: CancelState, formData: FormData) =>
      cancelBookingAction(bookingId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <p>
        Their place is freed up for someone else. Payments stay recorded. If
        they&apos;re owed a refund, record it on this page afterwards.
      </p>
      <TextField
        id="cancel-reason"
        name="reason"
        label="Why it's being cancelled"
        error={errors.reason}
        defaultValue={state.values?.reason ?? ""}
        maxLength={500}
      />
      <Checkbox
        id="cancel-confirm"
        name="confirm"
        label="Yes, cancel this booking"
        aria-invalid={errors.confirm ? true : undefined}
      />
      {errors.confirm ? (
        <p className="font-bold text-danger">{errors.confirm}</p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        Cancel the booking
      </Button>
    </form>
  );
}

function suggestion(person: { fullName: string; email: string }): string {
  return person.email
    ? `${person.fullName} (${person.email})`
    : person.fullName;
}

export function PassPlaceForm({
  bookingId,
  currentName,
  knownPeople,
}: {
  bookingId: string;
  currentName: string;
  knownPeople: { fullName: string; email: string }[];
}) {
  const name = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    (previous: PassPlaceState, formData: FormData) =>
      passPlaceAction(bookingId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};

  function pickKnownPerson(value: string) {
    const match = knownPeople.find((person) => suggestion(person) === value);
    if (match && name.current && email.current) {
      name.current.value = match.fullName;
      email.current.value = match.email;
    }
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <p>
        For when {currentName} can&apos;t come and you&apos;ve approved someone
        to take their place. The booking moves to them, with its reference,
        option, room and payments. Any money is settled between the two of them.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          ref={name}
          id="pass-name"
          name="fullName"
          label="Who's taking the place"
          hint="Start typing to choose someone who's been before."
          list="pass-known-people"
          autoComplete="off"
          error={errors.fullName}
          defaultValue={state.values?.fullName ?? ""}
          onChange={(event) => pickKnownPerson(event.currentTarget.value)}
        />
        <TextField
          ref={email}
          id="pass-email"
          name="email"
          type="email"
          inputMode="email"
          label="Their email (optional)"
          spellCheck={false}
          error={errors.email}
          defaultValue={state.values?.email ?? ""}
        />
      </div>
      <datalist id="pass-known-people">
        {knownPeople.map((person) => (
          <option
            key={`${person.fullName}:${person.email}`}
            value={suggestion(person)}
          />
        ))}
      </datalist>
      <TextField
        id="pass-reason"
        name="reason"
        label="Why it's being passed on"
        hint="For example, approved by Nichola by email on 12 October. It's added to the booking's notes."
        error={errors.reason}
        defaultValue={state.values?.reason ?? ""}
        maxLength={300}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Pass the place on"}
      </Button>
    </form>
  );
}

export function ReinstateForm({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState<SimpleState>(
    () => reinstateBookingAction(bookingId),
    {},
  );
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        Reinstate this booking
      </Button>
    </form>
  );
}

export function SendEmailForm({
  bookingId,
  template,
  label,
  disabled,
}: {
  bookingId: string;
  template: string;
  label: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: SendEmailState, formData: FormData) =>
      sendEmailAction(bookingId, previous, formData),
    {},
  );
  return (
    <form action={formAction} className="space-y-3">
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <input type="hidden" name="template" value={template} />
      <Button type="submit" disabled={pending || disabled}>
        {pending ? "Sending…" : `Send ${label}`}
      </Button>
    </form>
  );
}
