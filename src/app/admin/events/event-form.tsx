"use client";

import { useActionState, useRef } from "react";
import {
  DateTimeFields,
  FormSection,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { addDays, isIsoDate } from "@/lib/dates";
import { BALANCE_DUE_WEEKS_BEFORE } from "@/lib/events/rules";
import type { EventField } from "@/lib/validation/events";
import type { EventFormState } from "./actions";

type Values = Record<EventField, string>;

/**
 * The form for adding or changing an event. For a new event, picking the
 * start date fills in the end date (2 days later) and the balance due date
 * (6 weeks before), until they're changed by hand.
 */
export function EventForm({
  action,
  defaults,
  venues,
  isNew,
}: {
  action: (
    state: EventFormState,
    formData: FormData,
  ) => Promise<EventFormState>;
  defaults: Values;
  venues: { id: string; name: string }[];
  isNew: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const errors = state.fieldErrors ?? {};
  const value = (field: EventField) => state.values?.[field] ?? defaults[field];

  const endDate = useRef<HTMLInputElement>(null);
  const balanceDueOn = useRef<HTMLInputElement>(null);
  const suggested = useRef({
    endDate: isNew ? defaults.endDate : "",
    balanceDueOn: isNew ? defaults.balanceDueOn : "",
  });

  function suggestFromStart(startDate: string) {
    if (!isNew || !isIsoDate(startDate)) return;
    const fill = (
      input: HTMLInputElement | null,
      key: "endDate" | "balanceDueOn",
      next: string,
    ) => {
      if (!input) return;
      if (input.value === "" || input.value === suggested.current[key]) {
        input.value = next;
        suggested.current[key] = next;
      }
    };
    fill(endDate.current, "endDate", addDays(startDate, 2));
    fill(
      balanceDueOn.current,
      "balanceDueOn",
      addDays(startDate, -7 * BALANCE_DUE_WEEKS_BEFORE),
    );
  }

  return (
    <form action={formAction} className="mt-6 max-w-4xl space-y-6" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {Object.keys(errors).length ? (
        <Notice tone="error">
          Some details need changing. Each problem is explained below.
        </Notice>
      ) : null}

      <FormSection title="About the event">
        <TextField
          name="title"
          label="Event name"
          hint="For example, Coventry Crop Weekend March 2027. This also makes the event's web address."
          error={errors.title}
          defaultValue={value("title")}
          maxLength={120}
        />
        <TextField
          name="summary"
          label="Summary (optional)"
          hint="A sentence for the events list and when the link is shared."
          error={errors.summary}
          defaultValue={value("summary")}
          maxLength={300}
        />
        <TextareaField
          name="description"
          label="Description (optional)"
          hint="Shown on the event page. Leave a blank line between paragraphs."
          error={errors.description}
          defaultValue={value("description")}
          rows={6}
        />
        <TextareaField
          name="included"
          label="What everyone gets (optional)"
          hint="One item per line. They're shown as a list."
          error={errors.included}
          defaultValue={value("included")}
          rows={6}
        />
        <SelectField
          name="venueId"
          label="Venue"
          hint="To add a venue, go to Venues in the menu."
          error={errors.venueId}
          defaultValue={value("venueId")}
        >
          {venues.length === 0 ? <option value="">No venues yet</option> : null}
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </SelectField>
      </FormSection>

      <FormSection
        title="Dates and times"
        description="In UK time. The options (such as the 9am and 4pm starts) can have their own start times."
      >
        <DateTimeFields
          legend="Starts"
          date={{
            name: "startDate",
            label: "Start date",
            error: errors.startDate,
            defaultValue: value("startDate"),
            onChange: (event) => suggestFromStart(event.currentTarget.value),
          }}
          time={{
            name: "startTime",
            label: "Start time",
            error: errors.startTime,
            defaultValue: value("startTime"),
          }}
        />
        <DateTimeFields
          legend="Ends"
          date={{
            name: "endDate",
            label: "End date",
            error: errors.endDate,
            defaultValue: value("endDate"),
            ref: endDate,
          }}
          time={{
            name: "endTime",
            label: "End time",
            error: errors.endTime,
            defaultValue: value("endTime"),
          }}
        />
      </FormSection>

      <FormSection title="Places and payments">
        <TextField
          name="capacity"
          label="Places"
          hint="The most people the event can take, including free places for the team."
          error={errors.capacity}
          defaultValue={value("capacity")}
          inputMode="numeric"
          className="max-w-32"
        />
        <TextField
          name="balanceDueOn"
          type="date"
          label="Balance due by"
          hint={`Usually ${BALANCE_DUE_WEEKS_BEFORE} weeks before the event. Anyone booking on or after this date pays in full.`}
          error={errors.balanceDueOn}
          defaultValue={value("balanceDueOn")}
          ref={balanceDueOn}
          className="max-w-56"
        />
        <TextField
          name="depositHoldDays"
          label="Days to hold a place for its deposit"
          hint="When someone books but hasn't paid their deposit yet, their place is kept for this many days."
          error={errors.depositHoldDays}
          defaultValue={value("depositHoldDays")}
          inputMode="numeric"
          className="max-w-32"
        />
      </FormSection>

      <FormSection
        title="Booking online"
        description="Online booking is coming in a later stage. Leave these empty to allow booking from when the event is published until it starts."
      >
        <DateTimeFields
          legend="Booking opens (optional)"
          date={{
            name: "bookingOpensDate",
            label: "Opening date",
            error: errors.bookingOpensDate,
            defaultValue: value("bookingOpensDate"),
          }}
          time={{
            name: "bookingOpensTime",
            label: "Opening time",
            hint: "Leave empty for 9am.",
            error: errors.bookingOpensTime,
            defaultValue: value("bookingOpensTime"),
          }}
        />
        <DateTimeFields
          legend="Booking closes (optional)"
          date={{
            name: "bookingClosesDate",
            label: "Closing date",
            error: errors.bookingClosesDate,
            defaultValue: value("bookingClosesDate"),
          }}
          time={{
            name: "bookingClosesTime",
            label: "Closing time",
            hint: "Leave empty for 23:59.",
            error: errors.bookingClosesTime,
            defaultValue: value("bookingClosesTime"),
          }}
        />
      </FormSection>

      <FormSection
        title="For people who've booked"
        description="Sent to people once they've booked. Not shown on the public page."
      >
        <TextField
          name="facebookGroupUrl"
          type="url"
          label="Facebook group for this event (optional)"
          hint="Each event has its own private group, so this isn't copied to new events."
          error={errors.facebookGroupUrl}
          defaultValue={value("facebookGroupUrl")}
          inputMode="url"
          spellCheck={false}
        />
        <TextareaField
          name="hotelInfo"
          label="Hotel rooms (optional)"
          hint="How to book a room at Paper Fox's rate, and the prices. Shown on the event page too."
          error={errors.hotelInfo}
          defaultValue={value("hotelInfo")}
          rows={5}
        />
      </FormSection>

      <FormSection
        title="Emails before the event"
        description="Filled into the class kits and joining details emails, so they're right for this event. Only people who've booked see them. Leave a blank line between paragraphs, and start lines with “- ” for bullet points."
      >
        <TextareaField
          name="classKitsInfo"
          label="Class kits (optional)"
          hint="The kits on offer, what's in each one, the prices and how to order."
          error={errors.classKitsInfo}
          defaultValue={value("classKitsInfo")}
          rows={6}
        />
        <TextareaField
          name="joiningInfo"
          label="Joining details (optional)"
          hint="Arrival times and where to go, the timetable for the weekend, what's nearby, and the usual questions and answers."
          error={errors.joiningInfo}
          defaultValue={value("joiningInfo")}
          rows={10}
        />
      </FormSection>

      {isNew ? (
        <Checkbox
          id="addStandardOptions"
          name="addStandardOptions"
          defaultChecked
          label="Add the usual two options"
          hint="Weekend (4pm start) at £195 with a £60 deposit, and Friday Kick Starter (9am start) at £245 with an £85 deposit. You can change them afterwards."
        />
      ) : null}

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Saving…" : isNew ? "Add event" : "Save changes"}
      </Button>
    </form>
  );
}
