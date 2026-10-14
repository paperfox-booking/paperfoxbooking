"use client";

import { useActionState } from "react";
import { TextField, TextareaField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import type { TemplateField } from "@/lib/validation/settings";
import { saveTemplateAction, type TemplateFormState } from "../actions";

export function TemplateForm({
  templateKey,
  defaults,
}: {
  templateKey: string;
  defaults: Record<TemplateField, string>;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: TemplateFormState, formData: FormData) =>
      saveTemplateAction(templateKey, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const value = (field: TemplateField) =>
    state.values?.[field] ?? defaults[field];
  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <TextField
        name="subject"
        label="Subject"
        error={errors.subject}
        defaultValue={value("subject")}
        maxLength={200}
      />
      <TextareaField
        name="body"
        label="What it says"
        hint="Leave a blank line between paragraphs. Start lines with “- ” for bullet points. The sign-off and social links are added for you."
        error={errors.body}
        defaultValue={value("body")}
        rows={18}
      />
      <fieldset className="space-y-2">
        <legend className="font-bold">Attach</legend>
        <Checkbox
          id="attachBookingDetails"
          name="attachBookingDetails"
          label="Booking details PDF (prices, how to pay, key dates, venue and hotel)"
          defaultChecked={value("attachBookingDetails") === "on"}
        />
        <Checkbox
          id="attachConfirmation"
          name="attachConfirmation"
          label="Confirmation PDF (their place, what's included, the Facebook group)"
          defaultChecked={value("attachConfirmation") === "on"}
        />
        <Checkbox
          id="attachTerms"
          name="attachTerms"
          label="Terms and conditions PDF"
          defaultChecked={value("attachTerms") === "on"}
        />
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save and preview"}
      </Button>
    </form>
  );
}
