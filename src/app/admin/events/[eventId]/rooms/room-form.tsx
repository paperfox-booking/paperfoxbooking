"use client";

import { useActionState } from "react";
import { TextField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import type { RoomField } from "@/lib/validation/bookings";
import type { ActionState, RoomFormState } from "../../actions";

/** One room's name, place guide and notes, or a new room. */
export function RoomForm({
  idPrefix,
  action,
  removeAction,
  defaults,
  sortOrder,
}: {
  idPrefix: string;
  action: (state: RoomFormState, formData: FormData) => Promise<RoomFormState>;
  removeAction?: () => Promise<ActionState>;
  defaults: Record<RoomField, string>;
  sortOrder?: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [removeState, removeFormAction, removing] = useActionState<ActionState>(
    async () => (removeAction ? removeAction() : {}),
    {},
  );
  const errors = state.fieldErrors ?? {};
  const value = (field: RoomField) => state.values?.[field] ?? defaults[field];
  const isNew = !removeAction;

  return (
    <div className="space-y-3">
      <form action={formAction} className="space-y-4" noValidate>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
        {sortOrder !== undefined ? (
          <input type="hidden" name="sortOrder" value={sortOrder} />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <TextField
            id={`${idPrefix}-name`}
            name="name"
            label="Room name"
            error={errors.name}
            defaultValue={value("name")}
            maxLength={60}
          />
          <TextField
            id={`${idPrefix}-capacity`}
            name="capacity"
            label="Places (optional)"
            hint="A guide, shown against how many are in the room."
            error={errors.capacity}
            defaultValue={value("capacity")}
            inputMode="numeric"
            className="max-w-32"
          />
        </div>
        <TextField
          id={`${idPrefix}-notes`}
          name="notes"
          label="Notes (optional)"
          hint="For example, prefer 74."
          error={errors.notes}
          defaultValue={value("notes")}
          maxLength={300}
        />
        <Button
          type="submit"
          variant={isNew ? "primary" : "secondary"}
          disabled={pending}
        >
          {pending ? "Saving…" : isNew ? "Add room" : "Save room"}
        </Button>
      </form>
      {removeAction ? (
        <form action={removeFormAction}>
          {removeState.error ? (
            <Notice tone="error">{removeState.error}</Notice>
          ) : null}
          <Button
            type="submit"
            variant="link"
            disabled={removing}
            className="px-0"
          >
            Remove this room
          </Button>
        </form>
      ) : null}
    </div>
  );
}
