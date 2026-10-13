import { z } from "zod";
import { optionalEmail } from "./bookings";
import {
  checkbox,
  optionalText,
  optionalWebAddress,
  requiredText,
} from "./form";

/**
 * The settings screen (owners only) and the email wording editor. Browsers
 * send new lines in big text boxes as \r\n, so they're tidied to \n, or the
 * terms would look changed (and get a new version) on every save.
 */

function longText(max: number, missing?: string) {
  const base = z
    .string()
    .transform((value) => value.replace(/\r\n?/g, "\n").trim());
  return missing
    ? base.pipe(
        z
          .string()
          .min(1, { error: missing })
          .max(max, { error: `Use ${max} characters or fewer` }),
      )
    : base.pipe(
        z.string().max(max, { error: `Use ${max} characters or fewer` }),
      );
}

const requiredEmail = (missing: string) =>
  optionalEmail.pipe(z.string({ error: missing }).min(1, { error: missing }));

/** "12 34 56", "123456" or "12-34-56", kept as 12-34-56. Empty is fine. */
export const sortCode = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return "";
    const digits = value.replace(/[\s-]/g, "");
    if (!/^\d{6}$/.test(digits)) {
      context.addIssue({
        code: "custom",
        message: "Enter the 6 digit sort code, like 12-34-56",
      });
      return z.NEVER;
    }
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  });

/** An 8 digit account number. Spaces are ignored. Empty is fine. */
export const accountNumber = z
  .string()
  .trim()
  .transform((value, context) => {
    const digits = value.replace(/\s/g, "");
    if (digits !== "" && !/^\d{8}$/.test(digits)) {
      context.addIssue({
        code: "custom",
        message: "Enter the 8 digit account number",
      });
      return z.NEVER;
    }
    return digits;
  });

const webAddress = optionalWebAddress.transform((value) => value ?? "");

export const SETTINGS_FIELDS = [
  "businessName",
  "legalName",
  "companyNumber",
  "contactEmail",
  "phone",
  "address",
  "website",
  "facebookUrl",
  "facebookGroupUrl",
  "instagramUrl",
  "signOff",
  "bankName",
  "bankAccountName",
  "bankSortCode",
  "bankAccountNumber",
  "emailReplyTo",
  "emailTestAddress",
  "sendPaymentEmails",
  "termsText",
] as const;
export type SettingsField = (typeof SETTINGS_FIELDS)[number];

export const settingsSchema = z
  .object({
    businessName: requiredText(120, "Enter the business name"),
    legalName: optionalText(120),
    companyNumber: optionalText(20),
    contactEmail: requiredEmail("Enter the email address customers can use"),
    phone: optionalText(40),
    address: longText(400),
    website: webAddress,
    facebookUrl: webAddress,
    facebookGroupUrl: webAddress,
    instagramUrl: webAddress,
    signOff: optionalText(120),
    bankName: optionalText(80),
    bankAccountName: optionalText(80),
    bankSortCode: sortCode,
    bankAccountNumber: accountNumber,
    emailReplyTo: requiredEmail("Enter the email address replies go to"),
    emailTestAddress: optionalEmail.transform((value) => value ?? ""),
    sendPaymentEmails: checkbox,
    termsText: longText(30000, "Enter the terms and conditions"),
  })
  .refine(
    (values) =>
      (values.bankSortCode === "") === (values.bankAccountNumber === ""),
    {
      path: ["bankAccountNumber"],
      error: "Enter both the sort code and the account number, or neither",
    },
  )
  .transform((values) => ({
    business_name: values.businessName,
    legal_name: values.legalName,
    company_number: values.companyNumber,
    contact_email: values.contactEmail,
    phone: values.phone,
    address: values.address,
    website: values.website,
    facebook_url: values.facebookUrl,
    facebook_group_url: values.facebookGroupUrl,
    instagram_url: values.instagramUrl,
    sign_off: values.signOff,
    bank_name: values.bankName,
    bank_account_name: values.bankAccountName,
    bank_sort_code: values.bankSortCode,
    bank_account_number: values.bankAccountNumber,
    email_reply_to: values.emailReplyTo,
    email_test_address: values.emailTestAddress,
    send_payment_emails: values.sendPaymentEmails,
    terms_text: values.termsText,
  }));

export const TEMPLATE_FIELDS = [
  "subject",
  "body",
  "attachBookingDetails",
  "attachConfirmation",
  "attachTerms",
] as const;
export type TemplateField = (typeof TEMPLATE_FIELDS)[number];

export const templateSchema = z
  .object({
    subject: requiredText(200, "Enter the subject").transform((value) =>
      value.replace(/\s+/g, " "),
    ),
    body: longText(20000, "Enter what the email says"),
    attachBookingDetails: checkbox,
    attachConfirmation: checkbox,
    attachTerms: checkbox,
  })
  .transform((values) => ({
    subject: values.subject,
    body: values.body,
    attach_booking_details: values.attachBookingDetails,
    attach_confirmation: values.attachConfirmation,
    attach_terms: values.attachTerms,
  }));
