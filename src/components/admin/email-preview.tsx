import { Notice } from "@/components/ui/card";
import type { PreparedEmail } from "@/lib/email/booking-emails";
import type { DocumentKind } from "@/lib/pdf/documents";

/**
 * Shows an email exactly as it will be sent: who it goes to, the subject,
 * anything to check, the attachments (each opens as a PDF) and the email
 * itself, in a frame so its styles can't affect the page.
 */
export function EmailPreview({
  prepared,
  attachmentHref,
  testAddress,
}: {
  prepared: PreparedEmail;
  attachmentHref: (kind: DocumentKind) => string;
  testAddress: string;
}) {
  const { composed, recipient } = prepared;
  return (
    <div className="space-y-3">
      {prepared.problems.length ? (
        <Notice tone="error">
          <p className="font-bold">This email can&apos;t be sent yet:</p>
          <ul className="list-disc pl-5">
            {prepared.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {composed.warnings.length ? (
        <Notice>
          <p className="font-bold">Check before sending:</p>
          <ul className="list-disc pl-5">
            {composed.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr]">
        <dt className="font-bold">To</dt>
        <dd className="break-words">
          {recipient.booking.fullName}{" "}
          {recipient.email ? `<${recipient.email}>` : "(no email address)"}
          {testAddress ? (
            <span className="block text-stone">
              Test mode is on, so it goes to {testAddress} instead.
            </span>
          ) : null}
        </dd>
        <dt className="font-bold">Subject</dt>
        <dd className="break-words">{composed.subject}</dd>
        <dt className="font-bold">Attached</dt>
        <dd>
          {prepared.attachments.length ? (
            <ul>
              {prepared.attachments.map((attachment) => (
                <li key={attachment.kind}>
                  <a
                    href={attachmentHref(attachment.kind)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {attachment.filename}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            "Nothing"
          )}
        </dd>
      </dl>
      <iframe
        title={`Preview of the email: ${composed.subject}`}
        srcDoc={composed.html}
        sandbox=""
        className="h-[32rem] w-full rounded-lg border-2 border-cream bg-white"
      />
    </div>
  );
}
