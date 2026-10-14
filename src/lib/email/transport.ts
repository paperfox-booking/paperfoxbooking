import "server-only";

/**
 * Sends one email. Which way depends on the settings (.env.example):
 *   - RESEND_API_KEY set: through Resend, for real;
 *   - EMAIL_SEND_TO_MAILPIT=true: to the local test mailbox (Mailpit), for
 *     development and the browser tests. Nothing leaves the computer;
 *   - neither: sending is off, and the admin area says so.
 *
 * Resend allows about 2 emails a second, so callers sending lots space them
 * out (see SEND_GAP_MS).
 */

export type EmailTransport = "resend" | "mailpit" | "off";

export interface OutgoingEmail {
  to: { email: string; name: string };
  replyTo: string;
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; content: Buffer }[];
  /** The same key twice means Resend sends it once (for retries). */
  idempotencyKey?: string;
}

export type SendResult =
  { ok: true; id: string | null } | { ok: false; error: string };

/** The gap to leave between emails when sending lots, to stay under Resend's limit. */
export const SEND_GAP_MS = 600;

export function emailTransport(): EmailTransport {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.EMAIL_SEND_TO_MAILPIT === "true") return "mailpit";
  return "off";
}

function sender(): { name: string; email: string; formatted: string } {
  const formatted =
    process.env.EMAIL_FROM || "Paper Fox <bookings@paper-fox.co.uk>";
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(formatted);
  return match
    ? { name: match[1] ?? "", email: match[2] ?? "", formatted }
    : { name: "", email: formatted.trim(), formatted };
}

/** Removes anything that could start a new email header. */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, " ").trim();
}

export async function sendEmail(email: OutgoingEmail): Promise<SendResult> {
  const transport = emailTransport();
  if (transport === "off") {
    return {
      ok: false,
      error: "Sending emails isn't switched on yet.",
    };
  }
  try {
    return transport === "resend"
      ? await sendWithResend(email)
      : await sendToMailpit(email);
  } catch (error) {
    // Network failures: say what happened without any of the email itself.
    return {
      ok: false,
      error: `The email service couldn't be reached (${error instanceof Error ? error.name : "error"}). Try again in a minute.`,
    };
  }
}

async function sendWithResend(email: OutgoingEmail): Promise<SendResult> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(email.idempotencyKey
        ? { "Idempotency-Key": email.idempotencyKey }
        : {}),
    },
    body: JSON.stringify({
      from: sender().formatted,
      to: [email.to.email],
      reply_to: email.replyTo,
      subject: oneLine(email.subject),
      text: email.text,
      html: email.html,
      attachments: email.attachments.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content.toString("base64"),
      })),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };
  if (!response.ok) {
    return {
      ok: false,
      error: `Resend said: ${result.message ?? response.statusText} (${response.status}).`,
    };
  }
  return { ok: true, id: result.id ?? null };
}

async function sendToMailpit(email: OutgoingEmail): Promise<SendResult> {
  const base = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
  const from = sender();
  const response = await fetch(`${base}/api/v1/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      From: { Email: from.email, Name: from.name },
      To: [{ Email: email.to.email, Name: oneLine(email.to.name) }],
      ReplyTo: [{ Email: email.replyTo }],
      Subject: oneLine(email.subject),
      Text: email.text,
      HTML: email.html,
      Attachments: email.attachments.map((attachment) => ({
        Filename: attachment.filename,
        Content: attachment.content.toString("base64"),
        ContentType: "application/pdf",
      })),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const result = (await response.json().catch(() => ({}))) as { ID?: string };
  if (!response.ok) {
    return {
      ok: false,
      error: `The test mailbox said: ${response.statusText} (${response.status}).`,
    };
  }
  return { ok: true, id: result.ID ?? null };
}
