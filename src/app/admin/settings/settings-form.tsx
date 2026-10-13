"use client";

import { useActionState } from "react";
import { TextField, TextareaField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import type { SettingsField } from "@/lib/validation/settings";
import { saveSettingsAction, type SettingsFormState } from "./actions";

export function SettingsForm({
  defaults,
  termsVersion,
}: {
  defaults: Record<SettingsField, string>;
  termsVersion: number;
}) {
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(saveSettingsAction, {});
  const errors = state.fieldErrors ?? {};
  const value = (field: SettingsField) =>
    state.values?.[field] ?? defaults[field];

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Card className="space-y-5">
        <h2 className="text-3xl">Bank details for transfers</h2>
        <p>
          These go in the B1 email, the thank you and reminder emails, and the
          booking details PDF, with each person&apos;s booking reference to use
          when they pay.
        </p>
        <TextField
          name="bankAccountName"
          label="Account name"
          hint="Leave empty to use the company's legal name."
          error={errors.bankAccountName}
          defaultValue={value("bankAccountName")}
          maxLength={80}
        />
        <TextField
          name="bankName"
          label="Bank (optional)"
          error={errors.bankName}
          defaultValue={value("bankName")}
          maxLength={80}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="bankSortCode"
            label="Sort code"
            hint="For example 12-34-56"
            error={errors.bankSortCode}
            defaultValue={value("bankSortCode")}
            inputMode="numeric"
            autoComplete="off"
            className="max-w-40"
          />
          <TextField
            name="bankAccountNumber"
            label="Account number"
            hint="8 digits"
            error={errors.bankAccountNumber}
            defaultValue={value("bankAccountNumber")}
            inputMode="numeric"
            autoComplete="off"
            className="max-w-48"
          />
        </div>
      </Card>

      <Card className="space-y-5">
        <h2 className="text-3xl">Emails</h2>
        <TextField
          name="emailReplyTo"
          type="email"
          label="Replies go to"
          hint="When someone replies to an email from the system."
          error={errors.emailReplyTo}
          defaultValue={value("emailReplyTo")}
        />
        <TextField
          name="signOff"
          label="Signed by"
          hint="At the end of every email, before Paper Fox."
          error={errors.signOff}
          defaultValue={value("signOff")}
          maxLength={120}
        />
        <Checkbox
          id="sendPaymentEmails"
          name="sendPaymentEmails"
          label="Email people automatically when a payment is recorded (B2 for a deposit, B3 when paid in full, or a thank you)"
          defaultChecked={value("sendPaymentEmails") === "on"}
        />
        <TextField
          name="emailTestAddress"
          type="email"
          label="Test mode: send every email to this address instead (optional)"
          hint="While this has an address in it, no customer gets an email: they all come here, marked as a test. Empty it when you're ready to go live."
          error={errors.emailTestAddress}
          defaultValue={value("emailTestAddress")}
        />
      </Card>

      <Card className="space-y-5">
        <h2 className="text-3xl">Business details</h2>
        <p>In every email&apos;s footer and on the PDFs.</p>
        <TextField
          name="businessName"
          label="Business name"
          error={errors.businessName}
          defaultValue={value("businessName")}
          maxLength={120}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            name="legalName"
            label="Legal name"
            error={errors.legalName}
            defaultValue={value("legalName")}
            maxLength={120}
          />
          <TextField
            name="companyNumber"
            label="Company number"
            error={errors.companyNumber}
            defaultValue={value("companyNumber")}
            maxLength={20}
          />
          <TextField
            name="contactEmail"
            type="email"
            label="Contact email"
            error={errors.contactEmail}
            defaultValue={value("contactEmail")}
          />
          <TextField
            name="phone"
            type="tel"
            label="Phone"
            error={errors.phone}
            defaultValue={value("phone")}
            maxLength={40}
          />
        </div>
        <TextareaField
          name="address"
          label="Address"
          hint="One line per line."
          error={errors.address}
          defaultValue={value("address")}
          rows={4}
        />
        <TextField
          name="website"
          label="Website"
          error={errors.website}
          defaultValue={value("website")}
        />
        <TextField
          name="facebookUrl"
          label="Facebook page"
          error={errors.facebookUrl}
          defaultValue={value("facebookUrl")}
        />
        <TextField
          name="facebookGroupUrl"
          label="Facebook group (the main one)"
          hint="Each event's own group is set on the event."
          error={errors.facebookGroupUrl}
          defaultValue={value("facebookGroupUrl")}
        />
        <TextField
          name="instagramUrl"
          label="Instagram"
          error={errors.instagramUrl}
          defaultValue={value("instagramUrl")}
        />
      </Card>

      <Card className="space-y-5">
        <h2 className="text-3xl">Terms and conditions</h2>
        <p>
          This is version {termsVersion}. Changing the wording makes a new
          version, and every version is kept. Start a line with &ldquo;##
          &rdquo; for a heading, and &ldquo;- &rdquo; for a bullet point. Leave
          a blank line between paragraphs.
        </p>
        <TextareaField
          name="termsText"
          label="Terms and conditions"
          error={errors.termsText}
          defaultValue={value("termsText")}
          rows={20}
        />
      </Card>

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
