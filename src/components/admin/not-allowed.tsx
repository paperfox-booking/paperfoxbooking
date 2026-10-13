import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { StaffAccess } from "@/lib/auth/session";

/** Shown instead of an admin page to people who can't use it. */
export function NotAllowed({
  access,
}: {
  access: Extract<StaffAccess, { allowed: false }>;
}) {
  if (access.user.staffRole) {
    return (
      <Card className="mt-6">
        <h2 className="text-3xl">You can&apos;t use this page</h2>
        <p className="mt-2">
          Your team role doesn&apos;t include this. If you need it, please ask
          an owner to change your role.
        </p>
        <p className="mt-2">
          <Link href="/admin">Back to the dashboard</Link>
        </p>
      </Card>
    );
  }
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
