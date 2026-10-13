"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input, describedBy } from "@/components/ui/form";
import { useReturnPath } from "@/lib/auth/use-return-path";
import { teamSignInAction, type TeamSignInState } from "./actions";

const initialState: TeamSignInState = { email: "" };

export function TeamSignInForm() {
  const [state, formAction, pending] = useActionState(
    teamSignInAction,
    initialState,
  );
  const next = useReturnPath();
  const emailError = state.fieldErrors?.email;
  const passwordError = state.fieldErrors?.password;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Field id="email" label="Email address" error={emailError}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          spellCheck={false}
          required
          defaultValue={state.email}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy("email", { error: emailError })}
        />
      </Field>

      <Field id="password" label="Password" error={passwordError}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={describedBy("password", { error: passwordError })}
        />
      </Field>

      <Button type="submit" size="large" width="full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
