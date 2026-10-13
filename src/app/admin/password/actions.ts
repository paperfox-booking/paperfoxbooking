"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { newPasswordSchema } from "@/lib/validation/auth";

export interface ChangePasswordState {
  done?: boolean;
  error?: string;
  fieldErrors?: { password?: string; confirm?: string };
}

export async function changePasswordAction(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  // Check again here: never trust that the form was shown to the right person.
  const user = await getCurrentUser();
  if (!user?.staffRole) {
    return {
      error:
        "You need to be signed in with a team account to change a password.",
    };
  }

  const parsed = newPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    const fieldErrors: ChangePasswordState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        (field === "password" || field === "confirm") &&
        !fieldErrors[field]
      ) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "same_password") {
      return {
        fieldErrors: {
          password:
            "That's the password you already have. Choose a different one.",
        },
      };
    }
    if (error.code === "weak_password") {
      return {
        fieldErrors: {
          password:
            "That password is too easy to guess. Try a longer one, such as a few words strung together.",
        },
      };
    }
    return {
      error:
        "We couldn't change your password just now. Please try again in a minute.",
    };
  }

  return { done: true };
}
