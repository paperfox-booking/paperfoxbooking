import { z } from "zod";
import { isIsoDate } from "@/lib/dates";
import { parsePoundsToPence } from "@/lib/money";

/**
 * Building blocks for the team's forms. Every message says what's wrong and
 * how to put it right, in plain English. Form values arrive as strings.
 */

/** What a form action sends back to its form. */
export interface FormState<Field extends string = string> {
  /** A problem with the whole form, shown at the top. */
  error?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  /** What was typed, so it's kept when the form is shown again. */
  values?: Partial<Record<Field, string>>;
}

/** Reads the named fields from a form as strings (missing ones are empty). */
export function readForm<Field extends string>(
  formData: FormData,
  fields: readonly Field[],
): Record<Field, string> {
  const values = {} as Record<Field, string>;
  for (const field of fields) {
    const value = formData.get(field);
    values[field] = typeof value === "string" ? value : "";
  }
  return values;
}

/** The first problem with each field, for showing next to it. */
export function fieldErrorsFrom<Field extends string>(
  error: z.ZodError,
): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as Field] = issue.message;
    }
  }
  return errors;
}

export function requiredText(max: number, missing: string) {
  return z
    .string()
    .trim()
    .min(1, { error: missing })
    .max(max, { error: `Use ${max} characters or fewer` });
}

export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, { error: `Use ${max} characters or fewer` });
}

export function requiredDate(missing: string) {
  return z
    .string()
    .trim()
    .min(1, { error: missing })
    .refine(isIsoDate, { error: "Enter a real date, like 19/03/2027" });
}

export const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || isIsoDate(value), {
    error: "Enter a real date, like 19/03/2027",
  });

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function requiredTime(missing: string) {
  return z
    .string()
    .trim()
    .min(1, { error: missing })
    .regex(TIME, { error: "Enter a time like 09:00 or 16:00" });
}

export const optionalTime = z
  .string()
  .trim()
  .refine((value) => value === "" || TIME.test(value), {
    error: "Enter a time like 09:00 or 16:00",
  });

export function wholeNumber(
  min: number,
  max: number,
  { missing, example }: { missing: string; example: string },
) {
  return z
    .string()
    .trim()
    .min(1, { error: missing })
    .regex(/^\d+$/, { error: `Enter a whole number, like ${example}` })
    .transform(Number)
    .pipe(
      z
        .number()
        .min(min, { error: `Enter ${min} or more` })
        .max(max, { error: `Enter ${max} or fewer` }),
    );
}

export function optionalWholeNumber(min: number, max: number, example: string) {
  return z
    .string()
    .trim()
    .regex(/^\d*$/, { error: `Enter a whole number, like ${example}` })
    .transform((value) => (value === "" ? null : Number(value)))
    .pipe(
      z
        .number()
        .min(min, { error: `Enter ${min} or more` })
        .max(max, { error: `Enter ${max} or fewer` })
        .nullable(),
    );
}

/** An amount in pounds ("195", "£195.50"), turned into whole pence. */
export function requiredPounds(missing: string) {
  return z
    .string()
    .trim()
    .min(1, { error: missing })
    .transform((value, context) => {
      const pence = parsePoundsToPence(value);
      if (pence === null) {
        context.addIssue({
          code: "custom",
          message: "Enter an amount in pounds, like 195 or 195.50",
        });
        return z.NEVER;
      }
      return pence;
    });
}

/** An optional amount in pounds. Empty means none (null). */
export const optionalPounds = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;
    const pence = parsePoundsToPence(value);
    if (pence === null) {
      context.addIssue({
        code: "custom",
        message: "Enter an amount in pounds, like 60 or 60.50",
      });
      return z.NEVER;
    }
    return pence;
  });

/**
 * An optional https web address. Adds "https://" if it was left off, as
 * people often paste "www.facebook.com/…". Empty means none (null).
 */
export const optionalWebAddress = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;
    const withScheme = /^https?:\/\//i.test(value)
      ? value.replace(/^http:\/\//i, "https://")
      : `https://${value}`;
    try {
      const url = new URL(withScheme);
      if (!url.hostname.includes(".")) throw new Error("No domain");
      return url.toString();
    } catch {
      context.addIssue({
        code: "custom",
        message:
          "Enter a full web address, like https://www.facebook.com/groups/…",
      });
      return z.NEVER;
    }
  })
  .pipe(
    z.string().max(500, { error: "That web address is too long" }).nullable(),
  );

/** A tick box: present means ticked. */
export const checkbox = z
  .string()
  .transform((value) => value === "on" || value === "true");
