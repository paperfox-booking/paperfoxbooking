import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { getVenue } from "@/lib/events/admin";
import { isUuid } from "@/lib/validation/ids";
import { saveVenueAction } from "../actions";
import { VenueForm } from "../venue-form";

export const metadata: Metadata = { title: "Change a venue" };

export default function EditVenuePage(
  props: PageProps<"/admin/venues/[venueId]">,
) {
  return (
    <>
      <p>
        <Link href="/admin/venues">Back to venues</Link>
      </p>
      <Suspense fallback={<p className="mt-4">Loading…</p>}>
        <EditVenue params={props.params} />
      </Suspense>
    </>
  );
}

async function EditVenue({
  params,
}: Pick<PageProps<"/admin/venues/[venueId]">, "params">) {
  const { venueId } = await params;
  const access = await requireStaff(
    `/admin/venues/${venueId}`,
    "events.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(venueId)) notFound();
  const venue = await getVenue(venueId);
  if (!venue) notFound();

  return (
    <>
      <h1 className="mt-2 text-5xl">Change {venue.name}</h1>
      <Card className="mt-6 max-w-2xl">
        <VenueForm
          action={saveVenueAction.bind(null, venue.id)}
          defaults={{
            name: venue.name,
            address: venue.address,
            postcode: venue.postcode,
            phone: venue.phone,
            mapUrl: venue.map_url ?? "",
            parking: venue.parking,
            accessInfo: venue.access_info,
          }}
          isNew={false}
        />
      </Card>
    </>
  );
}
