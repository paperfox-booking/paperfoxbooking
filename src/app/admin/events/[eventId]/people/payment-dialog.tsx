"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  recordPaymentAction,
  type PaymentState,
} from "@/app/admin/bookings/actions";
import {
  MoneyField,
  SelectField,
  TextField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import type { BookingMoney } from "@/lib/bookings/money";
import type { PersonRow } from "@/lib/bookings/people";
import { formatPrice, penceToPoundsInput } from "@/lib/money";
import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/validation/bookings";

/** Records money received for one person, without leaving the list. */
export function PaymentDialog({
  row,
  money,
  today,
  onClose,
  onRecorded,
}: {
  row: PersonRow;
  money: BookingMoney;
  today: string;
  onClose: () => void;
  onRecorded: (row: PersonRow) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: PaymentState, formData: FormData) => {
      const result = await recordPaymentAction(
        row.bookingId,
        previous,
        formData,
      );
      if (result.done && result.row) onRecorded(result.row);
      return result;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  // Suggest what's needed next: the rest of the deposit, or the balance.
  const suggested =
    money.depositOwedPence > 0
      ? money.depositOwedPence
      : Math.max(money.balancePence, 0);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="payment-heading"
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-cream bg-white p-0 text-ink backdrop:bg-ink/50"
    >
      <form action={formAction} className="space-y-5 p-5 sm:p-6" noValidate>
        <h2 id="payment-heading" className="text-3xl">
          Record a payment from {row.fullName}
        </h2>
        <p>
          Total {formatPrice(row.pricePence)}, paid {formatPrice(row.paidPence)}
          , still owed {formatPrice(Math.max(money.balancePence, 0))}.
        </p>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <MoneyField
          name="amount"
          label="Amount received"
          error={errors.amount}
          defaultValue={
            state.values?.amount ??
            (suggested ? penceToPoundsInput(suggested) : "")
          }
          autoFocus
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
          className="max-w-64"
        >
          {PAYMENT_METHODS.map((method) => (
            <option key={method} value={method}>
              {PAYMENT_METHOD_LABELS[method]}
            </option>
          ))}
        </SelectField>
        <TextField
          name="note"
          label="Note (optional)"
          hint="For example the reference on the bank statement."
          error={errors.note}
          defaultValue={state.values?.note ?? ""}
          maxLength={500}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Record payment"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  );
}
