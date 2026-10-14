"use client";

import { useActionState, useTransition, useState } from "react";
import {
  SelectField,
  TextField,
  TextareaField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import {
  addToWaitlistAction,
  bookFromWaitlistAction,
  offerPlaceAction,
  setWaitlistStatusAction,
  type BookState,
  type SimpleState,
  type WaitlistAddState,
} from "./actions";

interface Choice {
  id: string;
  name: string;
}

export function AddToWaitlistForm({
  eventId,
  options,
}: {
  eventId: string;
  options: Choice[];
}) {
  const [state, formAction, pending] = useActionState(
    (previous: WaitlistAddState, formData: FormData) =>
      addToWaitlistAction(eventId, previous, formData),
    {},
  );
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="fullName"
          label="Name"
          error={errors.fullName}
          defaultValue={state.values?.fullName ?? ""}
          autoComplete="off"
        />
        <TextField
          name="email"
          type="email"
          label="Email (optional)"
          hint="If they've booked before, their record is reused."
          error={errors.email}
          defaultValue={state.values?.email ?? ""}
          autoComplete="off"
        />
        <TextField
          name="phone"
          type="tel"
          label="Mobile (optional)"
          error={errors.phone}
          defaultValue={state.values?.phone ?? ""}
          autoComplete="off"
        />
        <SelectField
          name="optionId"
          label="Option they'd like (optional)"
          error={errors.optionId}
          defaultValue={state.values?.optionId ?? ""}
        >
          <option value="">Either</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </SelectField>
      </div>
      <TextareaField
        name="notes"
        label="Notes (optional)"
        hint="For example, coming with a friend who's already booked."
        error={errors.notes}
        defaultValue={state.values?.notes ?? ""}
        rows={2}
        maxLength={500}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to the waiting list"}
      </Button>
    </form>
  );
}

export function OfferForm({
  eventId,
  entryId,
  name,
}: {
  eventId: string;
  entryId: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: SimpleState, formData: FormData) =>
      offerPlaceAction(eventId, entryId, previous, formData),
    {},
  );
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <TextField
        id={`days-${entryId}`}
        name="days"
        type="number"
        inputMode="numeric"
        min={1}
        max={30}
        label="Days they have to accept"
        hint="Contact them to tell them. If they don't accept in time, offer the place to the next person."
        defaultValue="3"
        className="max-w-28"
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        Offer {name} a place
      </Button>
    </form>
  );
}

export function BookForm({
  eventId,
  entryId,
  name,
  options,
  rooms,
  wantedOptionId,
}: {
  eventId: string;
  entryId: string;
  name: string;
  options: Choice[];
  rooms: Choice[];
  wantedOptionId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    (previous: BookState, formData: FormData) =>
      bookFromWaitlistAction(eventId, entryId, previous, formData),
    {},
  );
  return (
    <form action={formAction} className="space-y-3" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`option-${entryId}`}
          name="optionId"
          label="Option"
          error={state.fieldErrors?.optionId}
          defaultValue={wantedOptionId ?? ""}
        >
          <option value="">Choose…</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          id={`room-${entryId}`}
          name="roomId"
          label="Room (optional)"
          error={state.fieldErrors?.roomId}
          defaultValue=""
        >
          <option value="">No room yet</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </SelectField>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Booking…" : `Book ${name} in`}
      </Button>
    </form>
  );
}

export function StatusButtons({
  eventId,
  entryId,
  name,
  offered,
}: {
  eventId: string;
  entryId: string;
  name: string;
  offered: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const set = (status: "waiting" | "declined" | "removed") =>
    startTransition(async () => {
      const result = await setWaitlistStatusAction(eventId, entryId, status);
      setError(result.error ?? "");
    });
  return (
    <div className="space-y-2">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap gap-2">
        {offered ? (
          <Button
            type="button"
            variant="secondary"
            size="small"
            disabled={pending}
            onClick={() => set("waiting")}
          >
            Back to waiting<span className="sr-only">: {name}</span>
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="small"
          disabled={pending}
          onClick={() => set("declined")}
        >
          They said no<span className="sr-only">: {name}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="small"
          disabled={pending}
          onClick={() => set("removed")}
        >
          Remove<span className="sr-only"> {name} from the list</span>
        </Button>
      </div>
    </div>
  );
}
