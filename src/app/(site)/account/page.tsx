import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignOutButton } from "@/components/site/sign-out-button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-5xl">My account</h1>
      <Suspense fallback={<p className="mt-4">Loading your account…</p>}>
        <AccountDetails />
      </Suspense>
    </div>
  );
}

async function AccountDetails() {
  const user = await requireUser("/account");

  return (
    <div className="mt-4 space-y-6">
      <p>
        Signed in as <strong>{user.fullName ?? user.email}</strong>
        {user.fullName ? ` (${user.email})` : null}
      </p>

      {user.staffRole ? (
        <Card className="border-teal bg-cream-light">
          <p className="font-bold">You&apos;re on the Paper Fox team.</p>
          <p className="mt-1">
            <Link href="/admin">Go to the admin area</Link>
          </p>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-3xl">My bookings</h2>
        <p className="mt-2">
          You don&apos;t have any bookings yet. When you book a Paper Fox
          weekend, it will appear here with what you&apos;ve paid and anything
          left to pay.
        </p>
      </Card>

      <SignOutButton />
    </div>
  );
}
