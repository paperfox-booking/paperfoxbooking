"use client";

import { useActionState, useEffect, useRef, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, Input, describedBy } from "@/components/ui/form";
import { safeNextPath } from "@/lib/auth/redirects";
import { signInAction, type SignInState } from "./actions";

const initialState: SignInState = { step: "email", email: "" };

/**
 * Two steps on one screen: enter your email, then the 6-digit code we email
 * you. Works without JavaScript too, because both steps are plain forms.
 */
export function SignInForm() {
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const next = useReturnPath();
  const returnPathField = next ? (
    <input type="hidden" name="next" value={next} />
  ) : null;

  // Move focus to the new step so screen reader users know it changed.
  useEffect(() => {
    if (state.step === "code") headingRef.current?.focus();
  }, [state.step, state.email]);

  if (state.step === "code") {
    const codeError = state.fieldErrors?.code;
    return (
      <div className="space-y-6">
        <h2 ref={headingRef} tabIndex={-1} className="text-4xl outline-none">
          Check your email
        </h2>
        {state.notice ? <Notice>{state.notice}</Notice> : null}
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}

        <form action={formAction} className="space-y-6" noValidate>
          <input type="hidden" name="email" value={state.email} />
          {returnPathField}
          <Field
            id="code"
            label="6-digit code"
            hint="It's in the email we just sent. Check your junk folder if you can't see it."
            error={codeError}
          >
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              className="max-w-48 text-2xl tracking-[0.3em]"
              aria-invalid={codeError ? true : undefined}
              aria-describedby={describedBy("code", {
                hint: true,
                error: codeError,
              })}
            />
          </Field>
          <Button
            type="submit"
            name="intent"
            value="verify"
            size="large"
            width="full"
            disabled={pending}
          >
            {pending ? "Checking…" : "Sign in"}
          </Button>
        </form>

        <form action={formAction} className="flex flex-wrap gap-x-6 gap-y-2">
          <input type="hidden" name="email" value={state.email} />
          <Button
            type="submit"
            name="intent"
            value="resend"
            variant="link"
            className="px-0"
            disabled={pending}
          >
            Send a new code
          </Button>
          <Button
            type="submit"
            name="intent"
            value="change-email"
            variant="link"
            className="px-0"
            disabled={pending}
          >
            Use a different email
          </Button>
        </form>
      </div>
    );
  }

  const emailError = state.fieldErrors?.email;
  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {returnPathField}
      <Field
        id="email"
        label="Email address"
        hint="We'll email you a 6-digit code. You don't need a password."
        error={emailError}
      >
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          required
          defaultValue={state.email}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={describedBy("email", {
            hint: true,
            error: emailError,
          })}
        />
      </Field>
      <Button
        type="submit"
        name="intent"
        value="send"
        size="large"
        width="full"
        disabled={pending}
      >
        {pending ? "Sending…" : "Email me a code"}
      </Button>
    </form>
  );
}

/**
 * Where to go after signing in, from ?next= in the address. Read in the
 * browser so the page itself can stay static (the server render uses "").
 * Without it, the server sends the team to the admin area and customers to
 * their account.
 */
function useReturnPath(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () =>
      safeNextPath(new URLSearchParams(window.location.search).get("next"), ""),
    () => "",
  );
}

// The address doesn't change while this page is open, so there's nothing to
// listen for.
function subscribeToNothing(): () => void {
  return () => {};
}
