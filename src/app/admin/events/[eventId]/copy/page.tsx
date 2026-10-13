import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { formatUkDateRange } from "@/lib/dates";
import { getEvent } from "@/lib/events/admin";
import { suggestedCopyStart, suggestedCopyTitle } from "@/lib/events/rules";
import { isUuid } from "@/lib/validation/ids";
import { copyEventAction } from "../../actions";
import { CopyEventForm } from "./copy-form";

export const metadata: Metadata = { title: "Copy an event" };

export default function CopyEventPage(
  props: PageProps<"/admin/events/[eventId]/copy">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <CopyEvent params={props.params} />
    </Suspense>
  );
}

async function CopyEvent({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/copy">, "params">) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/copy`,
    "events.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const event = await getEvent(eventId);
  if (!event) notFound();
  const startDate = suggestedCopyStart(event.starts_at);

  return (
    <>
      <p>
        <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
      </p>
      <h1 className="mt-2 text-5xl">Copy {event.title}</h1>
      <p className="mt-2 max-w-2xl">
        Copying makes a new draft with the same details and options (
        {event.options.length === 1
          ? "1 option"
          : `${event.options.length} options`}
        ), prices and deposits. The current event isn&apos;t changed.
      </p>
      <ul className="mt-2 max-w-2xl list-disc pl-5">
        <li>
          Every date moves on by the same number of days, including the balance
          due date and when booking opens. Start times stay the same, even when
          the clocks change.
        </li>
        <li>
          The Facebook group isn&apos;t copied, because each event has its own.
        </li>
        <li>Nobody&apos;s booking is copied.</li>
      </ul>
      <Card className="mt-6 max-w-2xl">
        <p className="mb-6">
          Copying from: <strong>{event.title}</strong>,{" "}
          {formatUkDateRange(event.starts_at, event.ends_at)}.
        </p>
        <CopyEventForm
          action={copyEventAction.bind(null, event.id)}
          defaults={{
            title: suggestedCopyTitle(event.title, event.starts_at, startDate),
            startDate,
          }}
        />
      </Card>
    </>
  );
}
