import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { saveVenueAction } from "../actions";
import { VenueForm } from "../venue-form";

export const metadata: Metadata = { title: "Add a venue" };

const EMPTY = {
  name: "",
  address: "",
  postcode: "",
  phone: "",
  mapUrl: "",
  parking: "",
  accessInfo: "",
};

export default function NewVenuePage() {
  return (
    <>
      <p>
        <Link href="/admin/venues">Back to venues</Link>
      </p>
      <h1 className="mt-2 text-5xl">Add a venue</h1>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <NewVenue />
      </Suspense>
    </>
  );
}

async function NewVenue() {
  const access = await requireStaff("/admin/venues/new", "events.manage");
  if (!access.allowed) return <NotAllowed access={access} />;
  return (
    <Card className="mt-6 max-w-2xl">
      <VenueForm
        action={saveVenueAction.bind(null, null)}
        defaults={EMPTY}
        isNew
      />
    </Card>
  );
}
