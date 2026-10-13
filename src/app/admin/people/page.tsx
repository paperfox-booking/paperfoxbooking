import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { listDirectory } from "@/lib/bookings/admin";
import { DirectoryGrid } from "./directory-grid";

export const metadata: Metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <>
      <h1 className="text-5xl">People</h1>
      <p className="mt-2 max-w-3xl">
        Everyone who&apos;s booked with Paper Fox, kept from one event to the
        next. Changes here show on every event they&apos;re booked on.
      </p>
      <Suspense fallback={<p className="mt-4">Loading people…</p>}>
        <Directory />
      </Suspense>
    </>
  );
}

async function Directory() {
  const access = await requireStaff("/admin/people", "bookings.view");
  if (!access.allowed) return <NotAllowed access={access} />;
  const people = await listDirectory();
  return (
    <div className="mt-6">
      <DirectoryGrid
        initialPeople={people}
        canEdit={can(access.user.staffRole, "bookings.manage")}
      />
    </div>
  );
}
