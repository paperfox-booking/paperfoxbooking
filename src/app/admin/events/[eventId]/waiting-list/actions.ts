"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { staffWithPermission } from "@/lib/auth/session";
import { addDays, ukToday } from "@/lib/dates";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";
import {
  WAITLIST_ADD_FIELDS,
  bookFromWaitlistSchema,
  offerDaysSchema,
  waitlistAddSchema,
  type WaitlistAddField,
} from "@/lib/validation/waitlist";

const NOT_ALLOWED =
  "You need to be an owner or admin to change the waiting list.";

function listPath(eventId: string): string {
  return `/admin/events/${eventId}/waiting-list`;
}

export type WaitlistAddState = FormState<WaitlistAddField>;

/** Adds someone to the end of the waiting list. */
export async function addToWaitlistAction(
  eventId: string,
  _previous: WaitlistAddState,
  formData: FormData,
): Promise<WaitlistAddState> {
  const values = readForm(formData, WAITLIST_ADD_FIELDS);
  if (!(await staffWithPermission("bookings.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = waitlistAddSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const person = parsed.data;
  const supabase = await createSupabaseServerClient();

  let customerId: string | null = null;
  if (person.email) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("email", person.email)
      .is("deleted_at", null)
      .maybeSingle();
    customerId = existing?.id ?? null;
  }
  if (!customerId) {
    const { data: created, error } = await supabase
      .from("customers")
      .insert({
        full_name: person.fullName,
        email: person.email,
        phone: person.phone,
      })
      .select("id")
      .single();
    if (error) return { values, error: friendlyDatabaseError(error) };
    customerId = created.id;
  }

  const { error } = await supabase.from("waitlist").insert({
    event_id: eventId,
    customer_id: customerId,
    ticket_type_id: person.optionId,
    notes: person.notes,
  });
  if (error) {
    return {
      values,
      error:
        error.code === "23505"
          ? `${person.fullName} is already on the waiting list.`
          : friendlyDatabaseError(error),
    };
  }
  redirect(`${listPath(eventId)}?notice=added`);
}

export type SimpleState = { error?: string };

/** Offers someone a place, until a few days from today. */
export async function offerPlaceAction(
  eventId: string,
  entryId: string,
  _previous: SimpleState,
  formData: FormData,
): Promise<SimpleState> {
  if (!(await staffWithPermission("bookings.manage"))) {
    return { error: NOT_ALLOWED };
  }
  const days = offerDaysSchema.safeParse(formData.get("days"));
  if (!days.success) return { error: days.error.issues[0]!.message };
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("waitlist")
    .update(
      {
        status: "offered",
        offered_at: new Date().toISOString(),
        offer_expires_on: addDays(ukToday(), days.data),
      },
      { count: "exact" },
    )
    .eq("id", entryId)
    .eq("event_id", eventId)
    .in("status", ["waiting", "offered"]);
  if (error) return { error: friendlyDatabaseError(error) };
  if (count === 0) return { error: "They aren't waiting any more." };
  redirect(`${listPath(eventId)}?notice=offered`);
}

/** Moves someone back to waiting, or marks them as having said no, or removes them. */
export async function setWaitlistStatusAction(
  eventId: string,
  entryId: string,
  status: "waiting" | "declined" | "removed",
): Promise<SimpleState> {
  if (!(await staffWithPermission("bookings.manage"))) {
    return { error: NOT_ALLOWED };
  }
  const parsed = z
    .object({
      eventId: z.uuid(),
      entryId: z.uuid(),
      status: z.enum(["waiting", "declined", "removed"]),
    })
    .safeParse({ eventId, entryId, status });
  if (!parsed.success) {
    return { error: "Something went wrong. Refresh the page and try again." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("waitlist")
    .update(
      status === "waiting"
        ? { status, offered_at: null, offer_expires_on: null }
        : { status },
    )
    .eq("id", entryId)
    .eq("event_id", eventId)
    .in("status", ["waiting", "offered"]);
  if (error) return { error: friendlyDatabaseError(error) };
  revalidatePath(listPath(eventId));
  return {};
}

export type BookState = {
  error?: string;
  fieldErrors?: { optionId?: string; roomId?: string };
};

/** Books someone in from the waiting list, then opens their new booking. */
export async function bookFromWaitlistAction(
  eventId: string,
  entryId: string,
  _previous: BookState,
  formData: FormData,
): Promise<BookState> {
  if (!(await staffWithPermission("bookings.manage"))) {
    return { error: NOT_ALLOWED };
  }
  const parsed = bookFromWaitlistSchema.safeParse({
    optionId: formData.get("optionId") ?? "",
    roomId: formData.get("roomId") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_from_waitlist", {
    waitlist_id: entryId,
    option_id: parsed.data.optionId,
    room_id: parsed.data.roomId ?? undefined,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "They're already booked on this event."
          : friendlyDatabaseError(error),
    };
  }
  redirect(`/admin/bookings/${data}?notice=booked-from-waitlist`);
}
