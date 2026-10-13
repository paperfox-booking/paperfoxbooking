"use client";

import { useActionState } from "react";
import { TextField, TextareaField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import type { PersonField } from "@/lib/validation/bookings";
import { savePersonAction, type PersonFormState } from "../actions";

export function PersonForm({
  customerId,
  defaults,
}: {
  customerId: string;
  defaults: Record<PersonField, string>;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: PersonFormState, formData: FormData) =>
      savePersonAction(customerId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const value = (field: PersonField) =>
    state.values?.[field] ?? defaults[field];

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          name="fullName"
          label="Name"
          error={errors.fullName}
          defaultValue={value("fullName")}
          maxLength={200}
        />
        <TextField
          name="email"
          type="email"
          inputMode="email"
          label="Email (optional)"
          spellCheck={false}
          error={errors.email}
          defaultValue={value("email")}
        />
        <TextField
          name="phone"
          type="tel"
          label="Mobile (optional)"
          error={errors.phone}
          defaultValue={value("phone")}
          maxLength={40}
        />
        <TextField
          name="emergencyContact"
          label="Emergency contact (optional)"
          hint="Their name, how they're related and their phone number."
          error={errors.emergencyContact}
          defaultValue={value("emergencyContact")}
          maxLength={300}
        />
      </div>
      <TextareaField
        name="dietaryHealth"
        label="Dietary and health needs (optional)"
        hint="Health information is private: only the Paper Fox team can see it."
        error={errors.dietaryHealth}
        defaultValue={value("dietaryHealth")}
        rows={3}
      />
      <TextareaField
        name="notes"
        label="Notes about them (optional)"
        hint="Kept from one event to the next. Notes about one event, such as seating, go on that booking."
        error={errors.notes}
        defaultValue={value("notes")}
        rows={3}
      />
      <Checkbox
        id="isTeam"
        name="isTeam"
        defaultChecked={value("isTeam") === "on"}
        label="On the Paper Fox team"
        hint="Team members and helpers are listed first, like the AA rows on the spreadsheet."
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </Button>
    </form>
  );
}
