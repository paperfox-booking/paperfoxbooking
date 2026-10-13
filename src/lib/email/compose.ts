import { fillPlaceholders, type PlaceholderValues } from "./placeholders";
import { emailHtml, emailText, type EmailBusiness } from "./layout";

export interface EmailWording {
  subject: string;
  body: string;
}

export interface ComposedEmail {
  subject: string;
  /** The filled-in wording, without the sign-off: what the email log keeps. */
  body: string;
  text: string;
  html: string;
  /** Things to check before sending, in plain English. */
  warnings: string[];
}

const EMPTY_WARNINGS: Partial<Record<keyof PlaceholderValues, string>> = {
  bank_details:
    "The bank details are empty. An owner can add them in Settings.",
  facebook_group:
    "This event has no Facebook group yet. Add it under the event's Change details.",
  deposit: "This booking has no deposit, so {{deposit}} is empty.",
  amount_received:
    "There's no payment to thank them for, so {{amount_received}} is empty.",
  received_on: "There's no payment date, so {{received_on}} is empty.",
  option: "This booking has no option, so {{option}} is empty.",
  prices: "No options are on sale, so {{prices}} is empty.",
};

/** Fills in the wording for one booking and wraps it in the branded layout. */
export function composeEmail({
  wording,
  values,
  business,
  logoUrl,
}: {
  wording: EmailWording;
  values: PlaceholderValues;
  business: EmailBusiness;
  logoUrl: string;
}): ComposedEmail {
  const subject = fillPlaceholders(wording.subject, values);
  const body = fillPlaceholders(wording.body, values);
  const unknown = [...new Set([...subject.unknown, ...body.unknown])];
  const empty = [...new Set([...subject.empty, ...body.empty])];
  const warnings = [
    ...unknown.map(
      (name) =>
        `{{${name}}} isn't a placeholder this system knows, so it's sent as it is. Check the spelling.`,
    ),
    ...empty.map(
      (name) =>
        EMPTY_WARNINGS[name as keyof PlaceholderValues] ??
        `{{${name}}} is empty for this booking.`,
    ),
  ];
  if (/\[[^\]\n]+\]/.test(body.text)) {
    warnings.push(
      "The wording still has a note in [square brackets] to replace. Change it on the Emails page first.",
    );
  }
  const subjectText = subject.text.replace(/\s+/g, " ").trim();
  return {
    subject: subjectText,
    body: body.text,
    text: emailText(body.text, business),
    html: emailHtml({
      subject: subjectText,
      body: body.text,
      business,
      logoUrl,
    }),
    warnings,
  };
}
