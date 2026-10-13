"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import type { EventStatus } from "@/lib/events/rules";
import { changeEventStatusAction, type ActionState } from "../actions";

const EXPLANATIONS: Record<EventStatus, string> = {
  draft:
    "This event is a draft, so only the team can see it. Publish it to show it on the website.",
  published: "This event is on the website.",
  sold_out:
    "This event is on the website, marked as sold out. Reopen it if places become free.",
  cancelled:
    "This event has been cancelled. It shows as cancelled on the website until its dates pass.",
  finished: "This event has finished.",
};

/** Publishing, unpublishing, sold out, cancelling and deleting a draft. */
export function EventStatusActions({
  eventId,
  status,
  hasOptionOnSale,
}: {
  eventId: string;
  status: EventStatus;
  hasOptionOnSale: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    changeEventStatusAction.bind(null, eventId),
    {},
  );

  return (
    <section aria-labelledby="status-heading">
      <h2 id="status-heading" className="text-3xl">
        On the website
      </h2>
      <Card className="mt-3 space-y-4">
        <p>{EXPLANATIONS[status]}</p>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}

        {status === "draft" && !hasOptionOnSale ? (
          <p className="font-bold">
            Add an option that&apos;s on sale before publishing.
          </p>
        ) : null}

        <form action={formAction} className="flex flex-wrap gap-3">
          {status === "draft" ? (
            <Button
              type="submit"
              name="change"
              value="published"
              disabled={pending}
            >
              Publish
            </Button>
          ) : null}
          {status === "published" ? (
            <Button
              type="submit"
              name="change"
              value="sold_out"
              variant="secondary"
              disabled={pending}
            >
              Mark as sold out
            </Button>
          ) : null}
          {status === "sold_out" ? (
            <Button
              type="submit"
              name="change"
              value="published"
              variant="secondary"
              disabled={pending}
            >
              Reopen bookings
            </Button>
          ) : null}
          {status === "published" || status === "sold_out" ? (
            <Button
              type="submit"
              name="change"
              value="draft"
              variant="secondary"
              disabled={pending}
            >
              Unpublish
            </Button>
          ) : null}
        </form>

        {status === "published" || status === "sold_out" ? (
          <details className="rounded-lg border-2 border-cream p-4">
            <summary className="cursor-pointer font-bold">
              Cancel this event
            </summary>
            <form action={formAction} className="mt-3 space-y-4">
              <p>
                Cancelling can&apos;t be undone. The event stays on the website
                marked as cancelled. Anyone already booked needs contacting
                about refunds.
              </p>
              <input type="hidden" name="change" value="cancelled" />
              <Checkbox
                id="confirm-cancel"
                name="confirm"
                label="Yes, cancel this event"
              />
              <Button type="submit" variant="secondary" disabled={pending}>
                Cancel the event
              </Button>
            </form>
          </details>
        ) : null}

        {status === "draft" ? (
          <details className="rounded-lg border-2 border-cream p-4">
            <summary className="cursor-pointer font-bold">
              Delete this draft
            </summary>
            <form action={formAction} className="mt-3 space-y-4">
              <p>
                The draft and its options will be removed from the admin area.
              </p>
              <input type="hidden" name="change" value="delete" />
              <Button type="submit" variant="secondary" disabled={pending}>
                Delete the draft
              </Button>
            </form>
          </details>
        ) : null}
      </Card>
    </section>
  );
}
