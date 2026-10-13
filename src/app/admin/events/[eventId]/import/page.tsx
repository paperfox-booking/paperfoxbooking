import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Notice } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { countBooked, getEvent } from "@/lib/events/admin";
import { isUuid } from "@/lib/validation/ids";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import a spreadsheet" };

export default function ImportPage(
  props: PageProps<"/admin/events/[eventId]/import">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Import params={props.params} />
    </Suspense>
  );
}

async function Import({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/import">, "params">) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/import`,
    "bookings.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const [event, booked] = await Promise.all([
    getEvent(eventId),
    countBooked(eventId),
  ]);
  if (!event) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p>
          <Link href={`/admin/events/${event.id}/people`}>
            Back to people booked
          </Link>
        </p>
        <h1 className="mt-2 text-5xl">Import a spreadsheet</h1>
        <p className="mt-1 text-lg">
          Bring everyone on a booking spreadsheet into {event.title}: their
          details, option, room, what they owe, what they&apos;ve paid and the
          last email sent.
        </p>
      </div>
      {booked > 0 ? (
        <Notice>
          This event already has {booked} {booked === 1 ? "person" : "people"}{" "}
          booked, so a spreadsheet can&apos;t be imported into it. Imports only
          go into an event with nobody booked yet, so nobody is added twice.
        </Notice>
      ) : (
        <ImportForm eventId={event.id} />
      )}
    </div>
  );
}
