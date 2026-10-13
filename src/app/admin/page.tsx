import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Card } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";

export default function AdminDashboardPage() {
  return (
    <>
      <h1 className="text-5xl">Dashboard</h1>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}

const comingSoon = [
  {
    title: "Events",
    text: "Set up each weekend, its prices and deposits, and copy last year's to make this year's.",
  },
  {
    title: "Bookings",
    text: "Everyone booked on each event, what they've paid and what they still owe. The March 2027 spreadsheet comes across here.",
  },
  {
    title: "Payments",
    text: "Record bank transfers. The right email (deposit received or paid in full) goes out automatically.",
  },
  {
    title: "Emails and chasers",
    text: "Your B1, B2 and B3 emails, balance reminders and chasers, with a record of what was sent.",
  },
];

async function Dashboard() {
  const access = await requireStaff("/admin");

  if (!access.allowed) {
    return (
      <Card className="mt-6">
        <h2 className="text-3xl">This area is for the Paper Fox team</h2>
        <p className="mt-2">
          You&apos;re signed in as {access.user.email}, which isn&apos;t a team
          account. If you think it should be, please ask Paper Fox to add you.
        </p>
        <p className="mt-2">
          <Link href="/account">Go to my account</Link>
        </p>
      </Card>
    );
  }

  const { user } = access;
  return (
    <div className="mt-4 space-y-6">
      <p>
        Hello {user.fullName ?? user.email}. You&apos;re signed in as{" "}
        <strong>{ROLE_LABELS[user.staffRole].toLowerCase()}</strong>.
      </p>

      <section aria-labelledby="coming-heading">
        <h2 id="coming-heading" className="text-3xl">
          Coming next
        </h2>
        <ul className="mt-3 grid gap-4 sm:grid-cols-2">
          {comingSoon.map((item) => (
            <li key={item.title}>
              <Card className="h-full">
                <h3 className="text-2xl">{item.title}</h3>
                <p className="mt-1">{item.text}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <SignOutButton />
    </div>
  );
}
