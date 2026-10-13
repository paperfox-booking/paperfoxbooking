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
import { saveOptionAction } from "../../../actions";
import { OptionForm } from "../../../option-form";

export const metadata: Metadata = { title: "Add an option" };

export default function NewOptionPage(
  props: PageProps<"/admin/events/[eventId]/options/new">,
) {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <NewOption params={props.params} />
    </Suspense>
  );
}

async function NewOption({
  params,
}: Pick<PageProps<"/admin/events/[eventId]/options/new">, "params">) {
  const { eventId } = await params;
  const access = await requireStaff(
    `/admin/events/${eventId}/options/new`,
    "events.manage",
  );
  if (!access.allowed) return <NotAllowed access={access} />;
  if (!isUuid(eventId)) notFound();

  const event = await getEvent(eventId);
  if (!event) notFound();

  return (
    <>
      <p>
        <Link href={`/admin/events/${event.id}`}>Back to {event.title}</Link>
      </p>
      <h1 className="mt-2 text-5xl">Add an option</h1>
      <Card className="mt-6 max-w-2xl">
        <OptionForm
          action={saveOptionAction.bind(null, event.id, null)}
          defaults={optionFormValues(null, event.starts_at)}
          isNew
        />
      </Card>
    </>
  );
}
