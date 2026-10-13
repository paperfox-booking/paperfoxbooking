"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailSchema, passwordSchema } from "@/lib/validation/auth";

export interface TeamSignInState {
  email: string;
  error?: string;
  fieldErrors?: { email?: string; password?: string };
}

export async function teamSignInAction(
  _previous: TeamSignInState,
  formData: FormData,
): Promise<TeamSignInState> {
  const typedEmail = String(formData.get("email") ?? "");
  const email = emailSchema.safeParse(typedEmail);
  const password = passwordSchema.safeParse(
    String(formData.get("password") ?? ""),
  );
  if (!email.success || !password.success) {
    return {
      email: typedEmail,
      fieldErrors: {
        email: email.error?.issues[0]?.message,
        password: password.error?.issues[0]?.message,
      },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  if (error || !data.user) {
    // Never say whether the email exists: just that the pair didn't match.
    let message =
      "That email and password don't match. Check them and try again. If you've forgotten your password, ask whoever set up your account to reset it.";
    if (error?.status === 429) {
      message =
        "There have been too many attempts. Please wait a few minutes, then try again.";
    } else if (error?.code === "email_not_confirmed") {
      message =
        "This account hasn't been confirmed yet. Whoever set it up needs to confirm it in Supabase.";
    }
    return { email: email.data, error: message };
  }

  redirect(safeNextPath(String(formData.get("next") ?? ""), "/admin"));
}
