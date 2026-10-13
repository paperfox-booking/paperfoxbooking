import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Change your password" };

export default function ChangePasswordPage() {
  return (
    <>
      <h1 className="text-5xl">Change your password</h1>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <ChangePassword />
      </Suspense>
    </>
  );
}

async function ChangePassword() {
  const access = await requireStaff("/admin/password");

  if (!access.allowed) {
    return (
      <Card className="mt-6">
        <h2 className="text-3xl">This area is for the Paper Fox team</h2>
        <p className="mt-2">
          <Link href="/account">Go to my account</Link>
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-6 max-w-lg">
      <p className="mb-6">
        Signed in as <strong>{access.user.email}</strong>. If someone set up
        your account with a temporary password, change it here.
      </p>
      <ChangePasswordForm />
    </Card>
  );
}
