"use client";

import { useActionState } from "react";
import { TextField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import type { CopyField } from "@/lib/validation/events";
import type { CopyFormState } from "../../actions";

export function CopyEventForm({
  action,
  defaults,
}: {
  action: (state: CopyFormState, formData: FormData) => Promise<CopyFormState>;
  defaults: Record<CopyField, string>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const value = (field: CopyField) => state.values?.[field] ?? defaults[field];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <TextField
        name="title"
        label="Name for the new event"
        error={errors.title}
        defaultValue={value("title")}
        maxLength={120}
      />
      <TextField
        name="startDate"
        type="date"
        label="Date the new event starts"
        hint="We've suggested the same weekday a year on. Every other date moves on by the same number of days."
        error={errors.startDate}
        defaultValue={value("startDate")}
        className="max-w-56"
      />
      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Copying…" : "Copy event"}
      </Button>
    </form>
  );
}
