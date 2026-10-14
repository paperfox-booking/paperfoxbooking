"use client";

import { useActionState, useState, useTransition } from "react";
import { SelectField, TextField } from "@/components/admin/form-fields";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { ROLE_LABELS, STAFF_ROLES } from "@/lib/auth/permissions";
import {
  addTeamMemberAction,
  changeRoleAction,
  removeTeamMemberAction,
  type TeamState,
} from "./actions";

export function AddTeamMemberForm() {
  const [state, formAction, pending] = useActionState<TeamState, FormData>(
    addTeamMemberAction,
    {},
  );
  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.done ? <Notice tone="success">{state.done}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="email"
          type="email"
          label="Their email address"
          error={state.fieldErrors?.email}
          defaultValue={state.values?.email ?? ""}
          autoComplete="off"
        />
        <SelectField
          name="role"
          label="What they can do"
          error={state.fieldErrors?.role}
          defaultValue={state.values?.role ?? "admin"}
        >
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </SelectField>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add to the team"}
      </Button>
    </form>
  );
}

export function MemberControls({
  userId,
  email,
  role,
  isYou,
}: {
  userId: string;
  email: string;
  role: string;
  isYou: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="space-y-2">
      {error ? <Notice tone="error">{error}</Notice> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={`role-${userId}`} className="block font-bold">
            Role<span className="sr-only"> for {email}</span>
          </label>
          <Select
            id={`role-${userId}`}
            defaultValue={role}
            disabled={pending}
            onChange={(event) => {
              const next = event.currentTarget.value;
              startTransition(async () => {
                const result = await changeRoleAction(userId, next);
                setError(result.ok ? "" : result.error);
              });
            }}
          >
            {STAFF_ROLES.map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        </div>
        {isYou ? null : confirming ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeTeamMemberAction(userId);
                  setError(result.ok ? "" : result.error);
                  setConfirming(false);
                })
              }
            >
              Yes, remove {email}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Keep them
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirming(true)}
          >
            Remove<span className="sr-only"> {email} from the team</span>
          </Button>
        )}
      </div>
    </div>
  );
}
