import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Card, Notice } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDateTime } from "@/lib/dates";
import { loadSettingsRow } from "@/lib/email/booking-emails";
import { emailTransport } from "@/lib/email/transport";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SettingsField } from "@/lib/validation/settings";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage(props: PageProps<"/admin/settings">) {
  return (
    <Suspense fallback={<p>Loading the settings…</p>}>
      <Settings searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Settings({
  searchParams,
}: Pick<PageProps<"/admin/settings">, "searchParams">) {
  const access = await requireStaff("/admin/settings", "settings.manage");
  if (!access.allowed) return <NotAllowed access={access} />;
  const supabase = await createSupabaseServerClient();
  const [row, { notice }] = await Promise.all([
    loadSettingsRow(supabase),
    searchParams,
  ]);
  if (!row) {
    return <Notice tone="error">The settings couldn&apos;t be loaded.</Notice>;
  }
  const defaults: Record<SettingsField, string> = {
    businessName: row.business_name,
    legalName: row.legal_name,
    companyNumber: row.company_number,
    contactEmail: row.contact_email,
    phone: row.phone,
    address: row.address,
    website: row.website,
    facebookUrl: row.facebook_url,
    facebookGroupUrl: row.facebook_group_url,
    instagramUrl: row.instagram_url,
    signOff: row.sign_off,
    bankName: row.bank_name,
    bankAccountName: row.bank_account_name,
    bankSortCode: row.bank_sort_code,
    bankAccountNumber: row.bank_account_number,
    emailReplyTo: row.email_reply_to,
    emailTestAddress: row.email_test_address,
    sendPaymentEmails: row.send_payment_emails ? "on" : "",
    termsText: row.terms_text,
  };
  const transport = emailTransport();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-5xl">Settings</h1>
        <p className="mt-1 text-lg">
          Only owners can see and change these. Last changed{" "}
          {formatUkDateTime(row.updated_at)}.
        </p>
        <PageNotice
          notice={notice}
          messages={{ saved: { text: "Settings saved." } }}
        />
      </div>
      <Card>
        <h2 className="text-3xl">Sending emails</h2>
        {transport === "resend" ? (
          <p className="mt-2">
            <strong>On.</strong> Emails are sent through Resend.
            {row.email_test_address
              ? ` Test mode is on, so every email goes to ${row.email_test_address}.`
              : " Test mode is off, so emails go to customers."}
          </p>
        ) : transport === "mailpit" ? (
          <p className="mt-2">
            <strong>Test mailbox.</strong> Emails go to the local test mailbox
            (Mailpit), never to anyone real.
          </p>
        ) : (
          <p className="mt-2">
            <strong>Off.</strong> You can preview emails, but nothing is sent
            until Resend is set up (George: see docs/setup.md, &ldquo;Sending
            emails&rdquo;).
          </p>
        )}
        <p className="mt-2">
          <Link href="/admin/emails">Change what the emails say</Link>
        </p>
      </Card>
      <Card>
        <h2 className="text-3xl">Team</h2>
        <p className="mt-2">
          <Link href="/admin/settings/team">
            See who can sign in, and change what they can do
          </Link>
        </p>
      </Card>
      <SettingsForm defaults={defaults} termsVersion={row.terms_version} />
    </div>
  );
}
