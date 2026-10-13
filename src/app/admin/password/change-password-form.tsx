"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input, describedBy } from "@/components/ui/form";
import { PASSWORD_MIN } from "@/lib/validation/auth";
import { changePasswordAction, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    initialState,
  );
  const passwordError = state.fieldErrors?.password;
  const confirmError = state.fieldErrors?.confirm;
  const hint = `At least ${PASSWORD_MIN} characters. A few words strung together is easy to remember and hard to guess.`;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.done ? (
        <Notice tone="success">
          Your password has been changed. Use the new one next time you sign in.
        </Notice>
      ) : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      <Field
        id="password"
        label="New password"
        hint={hint}
        error={passwordError}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={describedBy("password", {
            hint: true,
            error: passwordError,
          })}
        />
      </Field>

      <Field id="confirm" label="Type it again" error={confirmError}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={describedBy("confirm", { error: confirmError })}
        />
      </Field>

      <Button type="submit" size="large" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
