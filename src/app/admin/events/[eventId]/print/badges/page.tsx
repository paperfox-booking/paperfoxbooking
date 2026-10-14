import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { loadSheet } from "../load";
import { SheetHeader } from "../sheet-header";

export const metadata: Metadata = { title: "Name badges" };

const PER_PAGE = 8;

export default function BadgesPage(
  props: PageProps<"/admin/events/[eventId]/print/badges">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Badges params={props.params} />
    </Suspense>
  );
}

async function Badges({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/print/badges">, "params">) {
  const { eventId } = await params;
  const result = await loadSheet(
    eventId,
    `/admin/events/${eventId}/print/badges`,
  );
  if (!result.allowed) return <NotAllowed access={result.access} />;
  const { event, people } = result.sheet;
  const pages: (typeof people)[] = [];
  for (let index = 0; index < people.length; index += PER_PAGE) {
    pages.push(people.slice(index, index + PER_PAGE));
  }

  return (
    <div>
      <div className="print:hidden">
        <SheetHeader
          eventId={event.id}
          title="Name badges"
          eventTitle={event.title}
          startsAt={event.starts_at}
          endsAt={event.ends_at}
        >
          <p>
            {people.length} badges, {PER_PAGE} to an A4 page. Print at actual
            size (100%), on card or badge inserts.
          </p>
        </SheetHeader>
      </div>
      {pages.map((page, pageIndex) => (
        <div
          key={pageIndex}
          className="grid break-after-page grid-cols-1 gap-[4mm] sm:grid-cols-2 print:grid-cols-2"
        >
          {page.map((person) => (
            <div
              key={person.bookingId}
              className="flex h-[62mm] break-inside-avoid flex-col items-center justify-center gap-1 rounded-2xl border-2 border-coral bg-white p-4 text-center"
            >
              <Image
                src="/brand/fox-mark.png"
                alt=""
                width={36}
                height={36}
                className="rounded-lg"
              />
              <p className="font-display text-6xl leading-none">
                {person.firstName}
              </p>
              {person.lastName ? (
                <p className="text-xl">{person.lastName}</p>
              ) : null}
              <p className="text-sm text-stone">
                {person.isTeam ? "Paper Fox team" : event.title}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
