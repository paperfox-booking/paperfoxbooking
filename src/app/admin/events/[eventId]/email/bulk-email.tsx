"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox, Input, Label, Select, Textarea } from "@/components/ui/form";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  pickAudience,
  type Audience,
  type AudiencePerson,
} from "@/lib/email/audience";
import type { EmailTransport } from "@/lib/email/transport";
import {
  previewBulkEmailAction,
  sendBulkEmailAction,
  type BulkChoice,
  type BulkPreview,
} from "./actions";

const CUSTOM = "custom";
const BATCH = 5;

type Attachment = "booking-details" | "confirmation" | "terms";
const ATTACHMENT_LABELS: Record<Attachment, string> = {
  "booking-details": "Booking details PDF",
  confirmation: "Confirmation PDF",
  terms: "Terms and conditions PDF",
};

/**
 * Emailing everyone (or some people) booked on an event: choose the email,
 * choose who gets it, check the preview, then send. Emails go a few at a
 * time, and the page shows how far it's got.
 */
export function BulkEmail({
  eventId,
  people,
  templates,
  balanceDueOn,
  today,
  transport,
  testAddress,
}: {
  eventId: string;
  people: AudiencePerson[];
  templates: { key: string; name: string }[];
  balanceDueOn: string;
  today: string;
  transport: EmailTransport;
  testAddress: string;
}) {
  const [template, setTemplate] = useState(templates[0]?.key ?? CUSTOM);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [audience, setAudience] = useState<Audience>("everyone");
  const [includeTeam, setIncludeTeam] = useState(false);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    sent: number;
    failed: { name: string; error: string }[];
    total: number;
    done: boolean;
  } | null>(null);
  const stopRef = useRef(false);

  const isCustom = template === CUSTOM;
  const recipients = useMemo(
    () =>
      pickAudience(people, audience, {
        template: isCustom ? null : template,
        includeTeam,
        balanceDueOn,
        today,
      }),
    [people, audience, template, isCustom, includeTeam, balanceDueOn, today],
  );
  const withEmail = recipients.filter((person) => person.email);
  const withoutEmail = recipients.filter((person) => !person.email);

  const choice: BulkChoice = isCustom
    ? { custom: { subject, body }, attachments }
    : { template: template as "B1" };

  /** Any change means the preview needs checking again. */
  function changed() {
    setPreview(null);
    setChecked(false);
    setProgress(null);
  }

  async function showPreview() {
    setPreviewError("");
    const first = withEmail[0];
    if (!first) {
      setPreviewError("Nobody on this list has an email address.");
      return;
    }
    setBusy(true);
    const result = await previewBulkEmailAction(
      eventId,
      choice,
      first.bookingId,
    );
    setBusy(false);
    if (result.ok) setPreview(result.preview);
    else setPreviewError(result.error);
  }

  async function send() {
    stopRef.current = false;
    setBusy(true);
    const total = withEmail.length;
    let sent = 0;
    const failed: { name: string; error: string }[] = [];
    setProgress({ sent, failed, total, done: false });
    for (let start = 0; start < total; start += BATCH) {
      if (stopRef.current) break;
      const batch = withEmail.slice(start, start + BATCH);
      const result = await sendBulkEmailAction(
        eventId,
        choice,
        batch.map((person) => person.bookingId),
      );
      if (!result.ok) {
        failed.push({ name: "Everyone left", error: result.error });
        break;
      }
      for (const outcome of result.results) {
        const person = batch.find((p) => p.bookingId === outcome.bookingId);
        if (outcome.sent) sent += 1;
        else
          failed.push({
            name: person?.fullName ?? "Someone",
            error: outcome.error,
          });
      }
      setProgress({ sent, failed: [...failed], total, done: false });
    }
    setProgress({ sent, failed: [...failed], total, done: true });
    setBusy(false);
  }

  const sendingOff = transport === "off";

  return (
    <div className="space-y-6">
      <fieldset className="space-y-4 rounded-2xl border border-cream bg-white p-4">
        <legend className="px-1 text-2xl font-bold">1. Which email</legend>
        <div>
          <Label htmlFor="bulk-template">Email</Label>
          <Select
            id="bulk-template"
            value={template}
            onChange={(event) => {
              setTemplate(event.currentTarget.value);
              changed();
            }}
            className="max-w-md"
          >
            {templates.map((option) => (
              <option key={option.key} value={option.key}>
                {option.name}
              </option>
            ))}
            <option value={CUSTOM}>A message of your own</option>
          </Select>
        </div>
        {isCustom ? (
          <>
            <div>
              <Label htmlFor="bulk-subject">Subject</Label>
              <Input
                id="bulk-subject"
                value={subject}
                maxLength={200}
                onChange={(event) => {
                  setSubject(event.currentTarget.value);
                  changed();
                }}
              />
            </div>
            <div>
              <Label htmlFor="bulk-body">Message</Label>
              <p id="bulk-body-hint" className="text-stone">
                Start with &ldquo;Hello {"{{first_name}}"}&rdquo; to use each
                person&apos;s name. The sign-off is added for you. The details
                you can fill in are listed on the Emails page.
              </p>
              <Textarea
                id="bulk-body"
                aria-describedby="bulk-body-hint"
                rows={12}
                value={body}
                onChange={(event) => {
                  setBody(event.currentTarget.value);
                  changed();
                }}
              />
            </div>
            <fieldset className="space-y-2">
              <legend className="font-bold">Attach (optional)</legend>
              {(Object.keys(ATTACHMENT_LABELS) as Attachment[]).map((kind) => (
                <Checkbox
                  key={kind}
                  id={`bulk-attach-${kind}`}
                  label={ATTACHMENT_LABELS[kind]}
                  checked={attachments.includes(kind)}
                  onChange={(event) => {
                    const on = event.currentTarget.checked;
                    setAttachments((current) =>
                      on
                        ? [...current, kind]
                        : current.filter((item) => item !== kind),
                    );
                    changed();
                  }}
                />
              ))}
            </fieldset>
          </>
        ) : null}
      </fieldset>

      <fieldset className="space-y-3 rounded-2xl border border-cream bg-white p-4">
        <legend className="px-1 text-2xl font-bold">2. Who gets it</legend>
        <div className="space-y-2">
          {AUDIENCES.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-3">
              <input
                type="radio"
                name="bulk-audience"
                value={option}
                checked={audience === option}
                onChange={() => {
                  setAudience(option);
                  changed();
                }}
                className="size-6 accent-coral-deep"
              />
              <span>
                {AUDIENCE_LABELS[option]} (
                {
                  pickAudience(people, option, {
                    template: isCustom ? null : template,
                    includeTeam,
                    balanceDueOn,
                    today,
                  }).length
                }
                )
              </span>
            </label>
          ))}
        </div>
        <Checkbox
          id="bulk-team"
          label="Include the team's free places"
          checked={includeTeam}
          onChange={(event) => {
            setIncludeTeam(event.currentTarget.checked);
            changed();
          }}
        />
        <p className="text-lg font-bold" aria-live="polite">
          {withEmail.length === 1
            ? "1 person will get this email."
            : `${withEmail.length} people will get this email.`}
        </p>
        {withoutEmail.length ? (
          <Notice>
            {withoutEmail.length === 1
              ? "1 person has no email address, so won't get it: "
              : `${withoutEmail.length} people have no email address, so won't get it: `}
            {withoutEmail.map((person) => person.fullName).join(", ")}.
          </Notice>
        ) : null}
        {withEmail.length ? (
          <details>
            <summary className="cursor-pointer font-bold">
              See who&apos;ll get it
            </summary>
            <ul className="mt-2 columns-1 sm:columns-2 lg:columns-3">
              {withEmail.map((person) => (
                <li key={person.bookingId}>{person.fullName}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </fieldset>

      <section
        aria-labelledby="bulk-preview-heading"
        className="space-y-3 rounded-2xl border border-cream bg-white p-4"
      >
        <h2 id="bulk-preview-heading" className="text-2xl font-bold">
          3. Check it
        </h2>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || withEmail.length === 0}
          onClick={() => void showPreview()}
        >
          Preview the email
        </Button>
        {previewError ? <Notice tone="error">{previewError}</Notice> : null}
        {preview ? (
          <div className="space-y-3">
            <p>
              As {withEmail[0]?.fullName} will get it
              {testAddress ? ` (test mode: it goes to ${testAddress})` : ""}.
            </p>
            {preview.problems.length ? (
              <Notice tone="error">{preview.problems.join(" ")}</Notice>
            ) : null}
            {preview.warnings.length ? (
              <Notice>
                <p className="font-bold">Check before sending:</p>
                <ul className="list-disc pl-5">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </Notice>
            ) : null}
            <p>
              <strong>Subject:</strong> {preview.subject}
            </p>
            <p>
              <strong>Attached:</strong>{" "}
              {preview.attachments.length
                ? preview.attachments.join(", ")
                : "nothing"}
            </p>
            <iframe
              title={`Preview of the email: ${preview.subject}`}
              srcDoc={preview.html}
              sandbox=""
              className="h-[28rem] w-full rounded-lg border-2 border-cream bg-white"
            />
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby="bulk-send-heading"
        className="space-y-3 rounded-2xl border border-cream bg-white p-4"
      >
        <h2 id="bulk-send-heading" className="text-2xl font-bold">
          4. Send
        </h2>
        {sendingOff ? (
          <Notice>
            Sending emails isn&apos;t switched on yet, so this can&apos;t send
            anything. You can still preview.
          </Notice>
        ) : null}
        <Checkbox
          id="bulk-checked"
          label="I've checked the preview"
          checked={checked}
          disabled={!preview}
          onChange={(event) => setChecked(event.currentTarget.checked)}
        />
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            size="large"
            disabled={
              busy ||
              !preview ||
              !checked ||
              sendingOff ||
              withEmail.length === 0
            }
            onClick={() => void send()}
          >
            {withEmail.length === 1
              ? "Send to 1 person"
              : `Send to ${withEmail.length} people`}
          </Button>
          {busy && progress && !progress.done ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                stopRef.current = true;
              }}
            >
              Stop sending
            </Button>
          ) : null}
        </div>
        <div aria-live="polite">
          {progress ? (
            <p className="text-lg font-bold">
              {progress.done
                ? `Finished: ${progress.sent} of ${progress.total} sent.`
                : `Sending… ${progress.sent} of ${progress.total} sent. Keep this page open.`}
            </p>
          ) : null}
          {progress?.failed.length ? (
            <Notice tone="error" className="mt-2">
              <p className="font-bold">Not sent:</p>
              <ul className="list-disc pl-5">
                {progress.failed.map((failure, index) => (
                  <li key={index}>
                    {failure.name}: {failure.error}
                  </li>
                ))}
              </ul>
            </Notice>
          ) : null}
        </div>
      </section>
    </div>
  );
}
