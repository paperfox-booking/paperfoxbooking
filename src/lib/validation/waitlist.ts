import { z } from "zod";
import { optionalEmail } from "./bookings";
import { optionalText, requiredText } from "./form";

/** The waiting list's forms. */

const optionalId = z
  .union([z.literal(""), z.uuid({ error: "Choose from the list" })])
  .transform((value) => (value === "" ? null : value));

export const WAITLIST_ADD_FIELDS = [
  "fullName",
  "email",
  "phone",
  "optionId",
  "notes",
] as const;
export type WaitlistAddField = (typeof WAITLIST_ADD_FIELDS)[number];

export const waitlistAddSchema = z.object({
  fullName: requiredText(200, "Enter their name"),
  email: optionalEmail,
  phone: optionalText(40),
  optionId: optionalId,
  notes: optionalText(500),
});

export const offerDaysSchema = z.coerce
  .number({ error: "Enter a number of days" })
  .int({ error: "Enter a whole number of days" })
  .min(1, { error: "Give them at least 1 day" })
  .max(30, { error: "Use 30 days or fewer" });

export const bookFromWaitlistSchema = z.object({
  optionId: z.uuid({ error: "Choose which option they're booking" }),
  roomId: optionalId,
});

export const WAITLIST_STATUS_LABELS = {
  waiting: "Waiting",
  offered: "Offered a place",
  booked: "Booked",
  declined: "Said no",
  removed: "Removed",
} as const;
