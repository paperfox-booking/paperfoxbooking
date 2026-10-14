import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Card, Notice } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDateTime } from "@/lib/dates";
import {
  listTemplates,
  loadSettingsRow,
  templateAttachments,
} from "@/lib/email/booking-emails";
import { emailTransport } from "@/lib/email/transport";
import { DOCUMENT_TITLES } from "@/lib/pdf/documents";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EMAIL_TEMPLATE_LABELS } from "@/lib/validation/bookings";

export const metadata: Metadata = { title: "Emails" };

export default function EmailsPage() {
  return (
    <Suspense fallback={<p>Loading the emails…</p>}>
      <Emails />
    </Suspense>
  );
}

async function Emails() {
  const access = await requireStaff("/admin/emails", "attendees.message");
  if (!access.allowed) return <NotAllowed access={access} />;
  const supabase = await createSupabaseServerClient();
  const [templates, settings, { data: recent }] = await Promise.all([
    listTemplates(supabase),
    loadSettingsRow(supabase),
    supabase
      .from("email_log")
      .select(
        "id, template, subject, to_email, status, error, sent_at, booking:bookings(id, reference, customer:customers(full_name))",
      )
      .eq("outside_system", false)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const transport = emailTransport();
  const failed = (recent ?? []).filter((email) => email.status === "failed");

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-5xl">Emails</h1>
        <p className="mt-1 text-lg">
          What each email says, and what&apos;s been sent. To email everyone on
          an event, open the event and choose <strong>Email people</strong>.
        </p>
      </div>

      {transport === "off" ? (
        <Notice>
          Sending emails isn&apos;t switched on yet. You can change and preview
          the emails, but nothing is sent until Resend is set up (see
          docs/setup.md).
        </Notice>
      ) : settings?.email_test_address ? (
        <Notice>
          Test mode is on: every email goes to {settings.email_test_address},
          not to customers. An owner can turn it off in{" "}
          <Link href="/admin/settings">Settings</Link>.
        </Notice>
      ) : null}

      <section aria-labelledby="wording-heading" className="space-y-3">
        <h2 id="wording-heading" className="text-3xl">
          The standard emails
        </h2>
        <ul className="grid gap-4 md:grid-cols-2">
          {templates.map((template) => {
            const attachments = templateAttachments(template);
            return (
              <li key={template.key}>
                <Card className="h-full">
                  <h3 className="text-2xl">
                    <Link href={`/admin/emails/${template.key}`}>
                      {template.name}
                    </Link>
                  </h3>
                  <p className="mt-1">{template.description}</p>
                  <p className="mt-1 text-stone">Subject: {template.subject}</p>
                  <p className="text-stone">
                    Attached:{" "}
                    {attachments.length
                      ? attachments
                          .map((kind) => DOCUMENT_TITLES[kind])
                          .join(", ")
                      : "nothing"}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="sent-heading" className="space-y-3">
        <h2 id="sent-heading" className="text-3xl">
          Sent by the system
        </h2>
        {failed.length ? (
          <Notice tone="error">
            {failed.length === 1
              ? "1 email below wasn't sent."
              : `${failed.length} emails below weren't sent.`}{" "}
            Open the booking to see why and send it again.
          </Notice>
        ) : null}
        {recent?.length ? (
          <ul className="space-y-2">
            {recent.map((email) => (
              <li
                key={email.id}
                className={cn(
                  "rounded-lg border bg-white p-3",
                  email.status === "failed" ? "border-danger" : "border-cream",
                )}
              >
                <strong>
                  {EMAIL_TEMPLATE_LABELS[
                    email.template as keyof typeof EMAIL_TEMPLATE_LABELS
                  ] ?? email.template}
                </strong>{" "}
                to {email.booking?.customer?.full_name ?? "someone"} (
                {email.to_email})
                {email.sent_at ? `, ${formatUkDateTime(email.sent_at)}` : null}
                {email.status === "test" ? " (test only)" : null}
                <span className="block">&ldquo;{email.subject}&rdquo;</span>
                {email.status === "failed" ? (
                  <span className="block font-bold text-danger">
                    Not sent: {email.error}
                  </span>
                ) : null}
                {email.booking ? (
                  <Link href={`/admin/bookings/${email.booking.id}`}>
                    Open booking {email.booking.reference}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nothing sent by the system yet.</p>
        )}
      </section>
    </div>
  );
}
