import type { Metadata } from "next";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { cateringNumbers } from "@/lib/bookings/sheets";
import { SheetHeader } from "../print/sheet-header";
import { loadSheet } from "../print/load";

export const metadata: Metadata = { title: "Catering sheet" };

export default function CateringPage(
  props: PageProps<"/admin/events/[eventId]/catering">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <Catering params={props.params} />
    </Suspense>
  );
}

async function Catering({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/catering">, "params">) {
  const { eventId } = await params;
  const result = await loadSheet(eventId, `/admin/events/${eventId}/catering`);
  if (!result.allowed) return <NotAllowed access={result.access} />;
  const { event, options, people } = result.sheet;
  const numbers = cateringNumbers(people, options);
  const included = event.included
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="max-w-4xl">
      <SheetHeader
        eventId={event.id}
        title="Catering sheet"
        eventTitle={event.title}
        startsAt={event.starts_at}
        endsAt={event.ends_at}
      >
        <Notice className="print:hidden">
          The dietary column can include health information. Before sending this
          to the hotel, check it only shares what they need to know.
        </Notice>
        <p className="print:hidden">
          <Button asChild variant="secondary">
            <a href={`/admin/events/${event.id}/catering/export`} download>
              Download as a spreadsheet (CSV)
            </a>
          </Button>
        </p>
      </SheetHeader>

      <section aria-labelledby="numbers-heading" className="space-y-2">
        <h2 id="numbers-heading" className="text-3xl print:text-2xl">
          Numbers: {numbers.total} people
        </h2>
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">People on each option</caption>
          <thead>
            <tr className="border-b-2 border-ink">
              <th scope="col" className="py-1 pr-2">
                Option
              </th>
              <th scope="col" className="py-1 pr-2 text-right">
                People
              </th>
              <th scope="col" className="py-1">
                Includes
              </th>
            </tr>
          </thead>
          <tbody>
            {numbers.byOption.map((option) => (
              <tr
                key={option.id ?? "team"}
                className="border-b border-cream print:border-stone"
              >
                <th scope="row" className="py-1 pr-2 font-bold">
                  {option.name}
                </th>
                <td className="py-1 pr-2 text-right text-lg font-bold">
                  {option.count}
                </td>
                <td className="py-1">{option.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {included.length ? (
          <div className="pt-2">
            <h3 className="text-2xl print:text-xl">Everyone gets</h3>
            <ul className="list-disc pl-5">
              {included.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="needs-heading" className="mt-8 space-y-2">
        <h2 id="needs-heading" className="text-3xl print:text-2xl">
          Dietary needs: {numbers.withNeeds.length}{" "}
          {numbers.withNeeds.length === 1 ? "person" : "people"}
        </h2>
        {numbers.withNeeds.length ? (
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Dietary needs</caption>
            <thead>
              <tr className="border-b-2 border-ink">
                <th scope="col" className="py-1 pr-2">
                  Name
                </th>
                <th scope="col" className="py-1 pr-2">
                  Option
                </th>
                <th scope="col" className="py-1 pr-2">
                  Room
                </th>
                <th scope="col" className="py-1">
                  Needs
                </th>
              </tr>
            </thead>
            <tbody>
              {numbers.withNeeds.map((person) => (
                <tr
                  key={person.bookingId}
                  className="break-inside-avoid border-b border-cream print:border-stone"
                >
                  <th scope="row" className="py-1 pr-2 font-bold">
                    {person.fullName}
                  </th>
                  <td className="py-1 pr-2">{person.optionName}</td>
                  <td className="py-1 pr-2">{person.roomName}</td>
                  <td className="py-1">{person.dietaryHealth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Nobody has told us about dietary needs.</p>
        )}
      </section>
    </div>
  );
}
