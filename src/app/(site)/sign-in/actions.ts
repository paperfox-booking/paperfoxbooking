"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emailSchema, signInCodeSchema } from "@/lib/validation/auth";

export interface SignInState {
  step: "email" | "code";
  email: string;
  notice?: string;
  error?: string;
  fieldErrors?: { email?: string; code?: string };
}

export async function signInAction(
  previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const intent = formData.get("intent");
  if (intent === "change-email") {
    return { step: "email", email: previous.email };
  }
  if (intent === "verify") {
    return verifyCode(formData);
  }
  return sendCode(formData);
}

async function sendCode(formData: FormData): Promise<SignInState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = emailSchema.safeParse(typed);
  if (!parsed.success) {
    return {
      step: "email",
      email: typed,
      fieldErrors: { email: parsed.error.issues[0]?.message },
    };
  }

  const email = parsed.data;
  const supabase = await createSupabaseServerClient();
  // Creates the account the first time someone signs in.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    const tooMany =
      error.status === 429 || error.code === "over_email_send_rate_limit";
    return {
      step: formData.get("intent") === "resend" ? "code" : "email",
      email,
      error: tooMany
        ? "You've asked for several codes in a short time. Please wait a minute, then try again."
        : "We couldn't send your code just now. Please try again in a minute.",
    };
  }

  return {
    step: "code",
    email,
    notice: `We've emailed a 6-digit code to ${email}. It works for 10 minutes.`,
  };
}

async function verifyCode(formData: FormData): Promise<SignInState> {
  const email = emailSchema.safeParse(String(formData.get("email") ?? ""));
  if (!email.success) {
    return {
      step: "email",
      email: "",
      error: "Please enter your email address again.",
    };
  }

  const code = signInCodeSchema.safeParse(String(formData.get("code") ?? ""));
  if (!code.success) {
    return {
      step: "code",
      email: email.data,
      fieldErrors: { code: code.error.issues[0]?.message },
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "email",
  });

  if (error || !data.user) {
    return {
      step: "code",
      email: email.data,
      fieldErrors: {
        code: "That code didn't work. It may have a typo, or be more than 10 minutes old. Check the email, or send a new code.",
      },
    };
  }

  const next = safeNextPath(String(formData.get("next") ?? ""), "");
  if (next) redirect(next);

  // With nowhere to go back to, the team go to the admin area and customers
  // to their account. Row level security only returns their own staff row.
  const { data: staff } = await supabase
    .from("staff")
    .select("role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  redirect(staff ? "/admin" : "/account");
}
