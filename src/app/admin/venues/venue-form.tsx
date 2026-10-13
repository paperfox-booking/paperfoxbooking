"use client";

import { useActionState } from "react";
import { TextField, TextareaField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import type { VenueField } from "@/lib/validation/events";
import type { VenueFormState } from "./actions";

export function VenueForm({
  action,
  defaults,
  isNew,
}: {
  action: (
    state: VenueFormState,
    formData: FormData,
  ) => Promise<VenueFormState>;
  defaults: Record<VenueField, string>;
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const value = (field: VenueField) => state.values?.[field] ?? defaults[field];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <TextField
        name="name"
        label="Name"
        error={errors.name}
        defaultValue={value("name")}
        maxLength={120}
      />
      <TextareaField
        name="address"
        label="Address (optional)"
        hint="One line of the address per line, without the postcode."
        error={errors.address}
        defaultValue={value("address")}
        rows={3}
      />
      <TextField
        name="postcode"
        label="Postcode (optional)"
        error={errors.postcode}
        defaultValue={value("postcode")}
        autoCapitalize="characters"
        className="max-w-40"
      />
      <TextField
        name="phone"
        type="tel"
        label="Phone (optional)"
        error={errors.phone}
        defaultValue={value("phone")}
        className="max-w-64"
      />
      <TextField
        name="mapUrl"
        type="url"
        label="Map link (optional)"
        hint="Paste the link from Google Maps' Share button."
        error={errors.mapUrl}
        defaultValue={value("mapUrl")}
        inputMode="url"
        spellCheck={false}
      />
      <TextareaField
        name="parking"
        label="Parking (optional)"
        error={errors.parking}
        defaultValue={value("parking")}
        rows={2}
      />
      <TextareaField
        name="accessInfo"
        label="Access information (optional)"
        hint="For example step-free access, lifts and accessible toilets."
        error={errors.accessInfo}
        defaultValue={value("accessInfo")}
        rows={3}
      />
      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Saving…" : isNew ? "Add venue" : "Save venue"}
      </Button>
    </form>
  );
}
