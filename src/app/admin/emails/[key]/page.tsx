import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EmailPreview } from "@/components/admin/email-preview";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Card, Notice } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import {
  getTemplate,
  isTemplateKey,
  loadEmailContext,
  loadEmailRecipient,
  prepareEmail,
} from "@/lib/email/booking-emails";
import { PLACEHOLDERS } from "@/lib/email/placeholders";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatUkDateTime } from "@/lib/dates";
import { TemplateForm } from "./template-form";

export const metadata: Metadata = { title: "Change an email" };

export default function TemplatePage(props: PageProps<"/admin/emails/[key]">) {
  return (
    <Suspense fallback={<p>Loading the email…</p>}>
      <Template params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Template({
  params,
  searchParams,
}: Pick<PageProps<"/admin/emails/[key]">, "params" | "searchParams">) {
  const { key } = await params;
  const access = await requireStaff(
    `/admin/emails/${key}`,
    "attendees.message",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isTemplateKey(key)) notFound();
  const supabase = await createSupabaseServerClient();
  const [template, { notice }] = await Promise.all([
    getTemplate(supabase, key),
    searchParams,
  ]);
  if (!template) notFound();

  // Preview it with the most recent booking that has an email address.
  const { data: latest } = await supabase
    .from("bookings")
    .select("id, customers!inner(email)")
    .is("cancelled_at", null)
    .not("customers.email", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const recipient = latest
    ? await loadEmailRecipient(supabase, latest.id)
    : null;
  const context = recipient
    ? await loadEmailContext(supabase, recipient.eventId)
    : null;
  const prepared =
    recipient && context
      ? prepareEmail(context, recipient, { template: key })
      : null;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <p>
          <Link href="/admin/emails">Back to emails</Link>
        </p>
        <h1 className="mt-2 text-5xl">{template.name}</h1>
        <p className="mt-1 text-lg">{template.description}</p>
        <p className="text-stone">
          Last changed {formatUkDateTime(template.updated_at)}.
        </p>
        <PageNotice
          notice={notice}
          messages={{ saved: { text: "Saved. The preview shows the change." } }}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <TemplateForm
            templateKey={key}
            defaults={{
              subject: template.subject,
              body: template.body,
              attachBookingDetails: template.attach_booking_details ? "on" : "",
              attachConfirmation: template.attach_confirmation ? "on" : "",
              attachTerms: template.attach_terms ? "on" : "",
            }}
          />
          <details className="mt-6">
            <summary className="cursor-pointer font-bold">
              Details you can fill in automatically
            </summary>
            <p className="mt-2">
              Type these, with the double curly brackets, and each email fills
              in that person&apos;s details.
            </p>
            <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[12rem_1fr]">
              {PLACEHOLDERS.map((placeholder) => (
                <div key={placeholder.name} className="contents">
                  <dt>
                    <code className="font-bold">{`{{${placeholder.name}}}`}</code>
                  </dt>
                  <dd>{placeholder.description}</dd>
                </div>
              ))}
            </dl>
          </details>
        </Card>
        <Card id="preview">
          <h2 className="mb-3 text-3xl">Preview</h2>
          {prepared && recipient ? (
            <>
              <p className="mb-3">
                As {recipient.booking.fullName} ({recipient.booking.reference})
                would get it.
              </p>
              <EmailPreview
                prepared={prepared}
                testAddress={context?.settings.emailTestAddress ?? ""}
                attachmentHref={(kind) =>
                  `/admin/bookings/${recipient.bookingId}/documents/${kind}`
                }
              />
            </>
          ) : (
            <Notice>
              The preview appears once someone with an email address is booked
              on an event.
            </Notice>
          )}
        </Card>
      </div>
    </div>
  );
}
