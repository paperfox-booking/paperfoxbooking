"use client";

import { useActionState } from "react";
import {
  DateTimeFields,
  MoneyField,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import type { OptionField } from "@/lib/validation/events";
import type { ActionState, OptionFormState } from "./actions";

/** The form for adding or changing one option, such as the 9am start. */
export function OptionForm({
  action,
  removeAction,
  defaults,
  isNew,
}: {
  action: (
    state: OptionFormState,
    formData: FormData,
  ) => Promise<OptionFormState>;
  removeAction?: () => Promise<ActionState>;
  defaults: Record<OptionField, string>;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const value = (field: OptionField) =>
    state.values?.[field] ?? defaults[field];

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-6" noValidate>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <TextField
          name="name"
          label="Name"
          hint="For example, Weekend (4pm start)."
          error={errors.name}
          defaultValue={value("name")}
          maxLength={80}
        />
        <TextareaField
          name="description"
          label="Description (optional)"
          hint="What's included and the times, in a sentence or two."
          error={errors.description}
          defaultValue={value("description")}
          rows={3}
        />
        <MoneyField
          name="price"
          label="Full price"
          error={errors.price}
          defaultValue={value("price")}
        />
        <MoneyField
          name="deposit"
          label="Deposit (optional)"
          hint="Paid to secure the place, with the rest due by the event's balance date. Leave empty if people pay in full."
          error={errors.deposit}
          defaultValue={value("deposit")}
        />
        <DateTimeFields
          legend="Starts (optional)"
          hint="If this option starts at a different time from the event, for example the 9am Kick Starter."
          date={{
            name: "startDate",
            label: "Start date",
            error: errors.startDate,
            defaultValue: value("startDate"),
          }}
          time={{
            name: "startTime",
            label: "Start time",
            error: errors.startTime,
            defaultValue: value("startTime"),
          }}
        />
        <TextField
          name="capacity"
          label="Places for this option (optional)"
          hint="Only if this option has its own limit. The event's overall limit always applies."
          error={errors.capacity}
          defaultValue={value("capacity")}
          inputMode="numeric"
          className="max-w-32"
        />
        <TextField
          name="sortOrder"
          label="Order (optional)"
          hint="Options with lower numbers are listed first."
          error={errors.sortOrder}
          defaultValue={value("sortOrder")}
          inputMode="numeric"
          className="max-w-32"
        />
        <Checkbox
          id="onSale"
          name="onSale"
          defaultChecked={value("onSale") === "on"}
          label="On sale"
          hint="Untick to stop people booking this option, without removing it."
        />
        <Button type="submit" size="large" disabled={pending}>
          {pending ? "Saving…" : isNew ? "Add option" : "Save option"}
        </Button>
      </form>

      {removeAction ? <RemoveOption action={removeAction} /> : null}
    </div>
  );
}

function RemoveOption({ action }: { action: () => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <details className="rounded-lg border-2 border-cream bg-white p-4">
      <summary className="cursor-pointer font-bold">Remove this option</summary>
      <form action={formAction} className="mt-3 space-y-4">
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <p>
          It will no longer be shown or available to book. To stop sales for a
          while instead, untick On sale.
        </p>
        <Button type="submit" variant="secondary" disabled={pending}>
          Remove option
        </Button>
      </form>
    </details>
  );
}
