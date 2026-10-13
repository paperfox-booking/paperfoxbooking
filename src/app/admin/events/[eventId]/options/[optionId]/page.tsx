import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { NotAllowed } from "@/components/admin/not-allowed";
import { Card } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth/session";
import { getEvent } from "@/lib/events/admin";
import { optionFormValues } from "@/lib/events/form-values";
import { isUuid } from "@/lib/validation/ids";
import { removeOptionAction, saveOptionAction } from "../../../actions";
import { OptionForm } from "../../../option-form";

export const metadata: Metadata = { title: "Change an option" };

export default function EditOptionPage(
  props: PageProps<"/admin/events/[eventId]/options/[optionId]">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <EditOption params={props.params} />
    </Suspense>
  );
}

async function EditOption({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/options/[optionId]">, "params">) {
  const { eventId, optionId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/options/${optionId}`,
    "events.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId) || !isUuid(optionId)) notFound();

  const event = await getEvent(eventId);
  const option = event?.options.find((candidate) => candidate.id === optionId);
  if (!event || !option) notFound();

  return (
    <>
      <p>
        <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
      </p>
      <h1 className="mt-2 text-5xl">Change {option.name}</h1>
      <p className="mt-2 max-w-2xl">
        Changing a price only affects new bookings. Anyone already booked keeps
        the price they booked at.
      </p>
      <Card className="mt-6 max-w-2xl">
        <OptionForm
          action={saveOptionAction.bind(null, event.id, option.id)}
          removeAction={removeOptionAction.bind(null, event.id, option.id)}
          defaults={optionFormValues(option, event.starts_at)}
          isNew={false}
        />
      </Card>
    </>
  );
}
