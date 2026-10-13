import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { PageNotice } from "@/components/admin/page-notice";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth/session";
import { listVenues } from "@/lib/events/admin";

export const metadata: Metadata = { title: "Venues" };

export default function VenuesPage(props: PageProps<"/admin/venues">) {
  return (
    <>
      <h1 className="text-5xl">Venues</h1>
      <Suspense fallback={<p className="mt-4">Loading venues…</p>}>
        <Venues searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Venues({
  searchParams,
}: Pick<PageProps<"/admin/venues">, "searchParams">) {
  const access = await requireStaff("/admin/venues");
  if (!access.allowed) return <NotAllowed access={access} />;

  const [venues, { notice }] = await Promise.all([listVenues(), searchParams]);
  const canManage = can(access.user.staffRole, "events.manage");

  return (
    <div className="mt-4 space-y-6">
      <PageNotice notice={notice} messages={{ saved: { text: "Saved." } }} />
      {canManage ? (
        <Button asChild>
          <Link href="/admin/venues/new">Add a venue</Link>
        </Button>
      ) : null}
      {venues.length === 0 ? (
        <Card>
          <p className="font-bold">There aren&apos;t any venues yet.</p>
          <p className="mt-1">Add one before adding an event.</p>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {venues.map((venue) => (
            <li key={venue.id}>
              <Card className="h-full">
                <h2 className="text-2xl">{venue.name}</h2>
                <p className="mt-1 whitespace-pre-line">
                  {[venue.address, venue.postcode].filter(Boolean).join("\n")}
                </p>
                {venue.phone ? <p>{venue.phone}</p> : null}
                {canManage ? (
                  <p className="mt-3">
                    <Link href={`/admin/venues/${venue.id}`}>
                      Change {venue.name}
                    </Link>
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
