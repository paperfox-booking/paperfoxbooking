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
