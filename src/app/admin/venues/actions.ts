"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { staffWithPermission } from "@/lib/auth/session";
import { PUBLIC_EVENTS_TAG } from "@/lib/events/public";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  VENUE_FIELDS,
  venueFormSchema,
  type VenueField,
} from "@/lib/validation/events";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";

export type VenueFormState = FormState<VenueField>;

const NOT_ALLOWED =
  "You need to be signed in as an owner or admin to change venues.";

export async function saveVenueAction(
  venueId: string | null,
  _previous: VenueFormState,
  formData: FormData,
): Promise<VenueFormState> {
  const values = readForm(formData, VENUE_FIELDS);
  if (!(await staffWithPermission("events.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = venueFormSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  if (venueId) {
    const { error, count } = await supabase
      .from("venues")
      .update(parsed.data, { count: "exact" })
      .eq("id", venueId)
      .is("deleted_at", null);
    if (error) return { values, error: friendlyDatabaseError(error) };
    if (count === 0) {
      return { values, error: "That venue couldn't be found." };
    }
  } else {
    const { error } = await supabase.from("venues").insert(parsed.data);
    if (error) return { values, error: friendlyDatabaseError(error) };
  }

  // Venue details appear on the public event pages.
  updateTag(PUBLIC_EVENTS_TAG);
  redirect("/admin/venues?notice=saved");
}
