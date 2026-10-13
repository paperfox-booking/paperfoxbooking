import { z } from "zod";

/** Shared by the sign-in form (browser) and the sign-in actions (server). */

export const emailSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your email address" })
  .max(254, { error: "That email address is too long" })
  .pipe(
    z.email({
      error:
        "Enter an email address in the right format, like name@example.com",
    }),
  )
  .transform((email) => email.toLowerCase());

export const signInCodeSchema = z
  .string()
  .transform((code) => code.replace(/\s+/g, ""))
  .pipe(
    z
      .string()
      .min(1, { error: "Enter the 6-digit code from the email" })
      .regex(/^\d{6}$/, { error: "The code is 6 numbers, like 123456" }),
  );

// Passwords are only for the Paper Fox team. bcrypt (which Supabase uses)
// ignores anything after 72 bytes, so longer passwords aren't allowed.
const PASSWORD_MAX = 72;
export const PASSWORD_MIN = 12;

/** A password typed in to sign in: just needs to be there. */
export const passwordSchema = z
  .string()
  .min(1, { error: "Enter your password" })
  .max(PASSWORD_MAX, { error: "That password is too long" });

/** A new password, typed twice. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, {
        error: `Use at least ${PASSWORD_MIN} characters. A few words strung together works well.`,
      })
      .max(PASSWORD_MAX, { error: "Use 72 characters or fewer" }),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    error:
      "The two passwords don't match. Type the same password in both boxes.",
  });
