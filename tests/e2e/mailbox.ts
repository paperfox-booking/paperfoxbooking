import { expect } from "@playwright/test";

/**
 * Reads emails caught by Mailpit, the test mailbox that `supabase start` runs
 * locally. Nothing is really sent.
 */
const mailpitUrl = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

interface MailpitSearch {
  messages: { ID: string; Created: string }[];
}

interface MailpitMessage {
  Subject: string;
  Text: string;
}

/** Waits for the newest sign-in email to this address and returns its code. */
export async function latestSignInCode(
  email: string,
  sentAfter: Date,
): Promise<string> {
  let code = "";
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${mailpitUrl}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        );
        if (!search.ok) return "";
        const { messages } = (await search.json()) as MailpitSearch;
        const newest = messages
          .filter((message) => new Date(message.Created) >= sentAfter)
          .sort((a, b) => b.Created.localeCompare(a.Created))[0];
        if (!newest) return "";
        const response = await fetch(
          `${mailpitUrl}/api/v1/message/${newest.ID}`,
        );
        const message = (await response.json()) as MailpitMessage;
        code = /\b(\d{6})\b/.exec(message.Text)?.[1] ?? "";
        return code;
      },
      { message: `waiting for a sign-in email to ${email}`, timeout: 20_000 },
    )
    .not.toBe("");
  return code;
}
