"use client";

import { useActionState, useRef } from "react";
import {
  addPersonAction,
  type AddPersonState,
} from "@/app/admin/bookings/actions";
import {
  FormSection,
  SelectField,
  TextField,
} from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import type { PersonRow } from "@/lib/bookings/people";
import type { GridOption, GridRoom, KnownPersonChoice } from "./people-grid";

function suggestion(person: KnownPersonChoice): string {
  return person.email
    ? `${person.fullName} (${person.email})`
    : person.fullName;
}

/**
 * Adds someone to the event. Start typing a name to pick someone who's been
 * before: their email fills in, and their saved details are kept.
 */
export function AddPersonForm({
  eventId,
  options,
  rooms,
  knownPeople,
  onAdded,
}: {
  eventId: string;
  options: GridOption[];
  rooms: GridRoom[];
  knownPeople: KnownPersonChoice[];
  onAdded: (row: PersonRow) => void;
}) {
  const name = useRef<HTMLInputElement>(null);
  const email = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState(
    async (previous: AddPersonState, formData: FormData) => {
      const result = await addPersonAction(eventId, previous, formData);
      if (result.row) onAdded(result.row);
      return result;
    },
    {},
  );
  const errors = state.fieldErrors ?? {};

  function pickKnownPerson(value: string) {
    const match = knownPeople.find((person) => suggestion(person) === value);
    if (match && name.current && email.current) {
      name.current.value = match.fullName;
      email.current.value = match.email;
    }
  }

  return (
    <form action={formAction} noValidate>
      <FormSection
        title="Add someone"
        description="They're added to the list above. Start typing a name to choose someone who's been before."
      >
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            ref={name}
            name="fullName"
            label="Name"
            list="known-people"
            autoComplete="off"
            error={errors.fullName}
            defaultValue={state.values?.fullName ?? ""}
            onChange={(event) => pickKnownPerson(event.currentTarget.value)}
          />
          <TextField
            ref={email}
            name="email"
            type="email"
            inputMode="email"
            label="Email (optional)"
            spellCheck={false}
            error={errors.email}
            defaultValue={state.values?.email ?? ""}
          />
          <SelectField
            name="optionId"
            label="Option"
            hint="The price and deposit come from the option."
            error={errors.optionId}
            defaultValue={state.values?.optionId ?? options[0]?.id ?? ""}
          >
            <option value="">No option (a free team place)</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="roomId"
            label="Room"
            error={errors.roomId}
            defaultValue={state.values?.roomId ?? rooms[0]?.id ?? ""}
          >
            <option value="">No room yet</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </SelectField>
        </div>
        <datalist id="known-people">
          {knownPeople.map((person) => (
            <option
              key={`${person.fullName}:${person.email}`}
              value={suggestion(person)}
            />
          ))}
        </datalist>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add to this event"}
        </Button>
      </FormSection>
    </form>
  );
}
