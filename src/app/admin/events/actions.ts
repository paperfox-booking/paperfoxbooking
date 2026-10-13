"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { staffWithPermission } from "@/lib/auth/session";
import { ukDateTimeToUtc } from "@/lib/dates";
import { STANDARD_OPTIONS } from "@/lib/events/defaults";
import { PUBLIC_EVENTS_TAG } from "@/lib/events/public";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  COPY_FIELDS,
  EVENT_FIELDS,
  OPTION_FIELDS,
  copyEventSchema,
  eventFormSchema,
  optionFormSchema,
  type CopyField,
  type EventField,
  type OptionField,
} from "@/lib/validation/events";
import {
  ROOM_FIELDS,
  roomSchema,
  type RoomField,
} from "@/lib/validation/bookings";
import {
  fieldErrorsFrom,
  readForm,
  type FormState,
} from "@/lib/validation/form";

/**
 * Everything the team does to events and their options. Each action checks
 * the person may manage events (the database checks again with row level
 * security), validates every value, then refreshes the public pages.
 */

const NOT_ALLOWED =
  "You need to be signed in as an owner or admin to change events.";

export type EventFormState = FormState<EventField>;
export type OptionFormState = FormState<OptionField>;
export type CopyFormState = FormState<CopyField>;
export type ActionState = { error?: string };

export async function saveEventAction(
  eventId: string | null,
  _previous: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const values = readForm(formData, EVENT_FIELDS);
  if (!(await staffWithPermission("events.manage"))) {
    return { values, error: NOT_ALLOWED };
  }

  const parsed = eventFormSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  let id = eventId;
  let optionsProblem = false;

  if (eventId) {
    const { error, count } = await supabase
      .from("events")
      .update(parsed.data, { count: "exact" })
      .eq("id", eventId)
      .is("deleted_at", null);
    if (error) return { values, error: friendlyDatabaseError(error) };
    if (count === 0) {
      return {
        values,
        error: "That event couldn't be found. It may have been deleted.",
      };
    }
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert(parsed.data)
      .select("id")
      .single();
    if (error) return { values, error: friendlyDatabaseError(error) };
    id = data.id;

    if (formData.get("addStandardOptions") === "on") {
      const { error: optionsError } = await supabase
        .from("ticket_types")
        .insert(
          STANDARD_OPTIONS.map((option) => ({
            event_id: data.id,
            name: option.name,
            description: option.description,
            price_pence: option.pricePence,
            deposit_pence: option.depositPence,
            starts_at: ukDateTimeToUtc(
              values.startDate,
              option.startTime,
            ).toISOString(),
            sort_order: option.sortOrder,
          })),
        );
      optionsProblem = Boolean(optionsError);
    }
  }

  updateTag(PUBLIC_EVENTS_TAG);
  redirect(
    `/admin/events/${id}?${optionsProblem ? "notice=options-not-added" : "notice=saved"}`,
  );
}

const STATUS_CHANGES = ["published", "draft", "sold_out", "cancelled"] as const;
type StatusChange = (typeof STATUS_CHANGES)[number] | "delete";

const STATUS_NOTICES: Record<StatusChange, string> = {
  published: "published",
  draft: "unpublished",
  sold_out: "sold-out",
  cancelled: "cancelled",
  delete: "deleted",
};

export async function changeEventStatusAction(
  eventId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await staffWithPermission("events.manage"))) {
    return { error: NOT_ALLOWED };
  }
  const requested = formData.get("change");
  const change = [...STATUS_CHANGES, "delete"].find(
    (value) => value === requested,
  ) as StatusChange | undefined;
  if (!change) return { error: "That change isn't possible." };

  if (change === "cancelled" && formData.get("confirm") !== "on") {
    return {
      error:
        "Tick the box to confirm you want to cancel this event, then press the button again.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const update =
    change === "delete"
      ? { deleted_at: new Date().toISOString() }
      : { status: change };
  const { error, count } = await supabase
    .from("events")
    .update(update, { count: "exact" })
    .eq("id", eventId)
    .is("deleted_at", null);
  if (error) return { error: friendlyDatabaseError(error) };
  if (count === 0) {
    return { error: "That event couldn't be found. It may have been deleted." };
  }

  updateTag(PUBLIC_EVENTS_TAG);
  if (change === "delete") redirect("/admin/events?notice=deleted");
  redirect(`/admin/events/${eventId}?notice=${STATUS_NOTICES[change]}`);
}

export async function copyEventAction(
  eventId: string,
  _previous: CopyFormState,
  formData: FormData,
): Promise<CopyFormState> {
  const values = readForm(formData, COPY_FIELDS);
  if (!(await staffWithPermission("events.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = copyEventSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("copy_event", {
    source_event_id: eventId,
    new_title: parsed.data.title,
    new_starts_on: parsed.data.startDate,
  });
  if (error || !data) {
    return {
      values,
      error: friendlyDatabaseError(
        error,
        "The event couldn't be copied. Check the dates make sense, then try again.",
      ),
    };
  }

  redirect(`/admin/events/${data}?notice=copied`);
}

export async function saveOptionAction(
  eventId: string,
  optionId: string | null,
  _previous: OptionFormState,
  formData: FormData,
): Promise<OptionFormState> {
  const values = readForm(formData, OPTION_FIELDS);
  if (!(await staffWithPermission("events.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = optionFormSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  if (optionId) {
    if (!parsed.data.on_sale) {
      const problem = await wouldLeavePublishedEventEmpty(eventId, optionId);
      if (problem) return { values, error: problem };
    }
    const { error, count } = await supabase
      .from("ticket_types")
      .update(parsed.data, { count: "exact" })
      .eq("id", optionId)
      .eq("event_id", eventId)
      .is("deleted_at", null);
    if (error) return { values, error: friendlyDatabaseError(error) };
    if (count === 0) {
      return {
        values,
        error: "That option couldn't be found. It may have been removed.",
      };
    }
  } else {
    const { error } = await supabase
      .from("ticket_types")
      .insert({ ...parsed.data, event_id: eventId });
    if (error) return { values, error: friendlyDatabaseError(error) };
  }

  updateTag(PUBLIC_EVENTS_TAG);
  redirect(`/admin/events/${eventId}?notice=option-saved`);
}

export async function removeOptionAction(
  eventId: string,
  optionId: string,
): Promise<ActionState> {
  if (!(await staffWithPermission("events.manage"))) {
    return { error: NOT_ALLOWED };
  }
  const problem = await wouldLeavePublishedEventEmpty(eventId, optionId);
  if (problem) return { error: problem };

  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("ticket_types")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", optionId)
    .eq("event_id", eventId)
    .is("deleted_at", null);
  if (error) return { error: friendlyDatabaseError(error) };
  if (count === 0) {
    return {
      error: "That option couldn't be found. It may have been removed.",
    };
  }

  updateTag(PUBLIC_EVENTS_TAG);
  redirect(`/admin/events/${eventId}?notice=option-removed`);
}

/**
 * A published event must always have something on sale. Returns why the
 * change can't be made, or null if it's fine.
 */
async function wouldLeavePublishedEventEmpty(
  eventId: string,
  optionId: string,
): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data: event } = await supabase
    .from("events")
    .select("status, ticket_types(id, on_sale, deleted_at)")
    .eq("id", eventId)
    .maybeSingle();
  if (!event || !["published", "sold_out"].includes(event.status)) return null;
  const othersOnSale = event.ticket_types.some(
    (option) => option.id !== optionId && option.on_sale && !option.deleted_at,
  );
  return othersOnSale
    ? null
    : "This is the only option on sale for a published event. Add another option, or unpublish the event first.";
}

export type RoomFormState = FormState<RoomField> & { done?: boolean };

/** Adds a room to an event, or changes one. */
export async function saveRoomAction(
  eventId: string,
  roomId: string | null,
  _previous: RoomFormState,
  formData: FormData,
): Promise<RoomFormState> {
  const values = readForm(formData, ROOM_FIELDS);
  if (!(await staffWithPermission("events.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = roomSchema.safeParse(values);
  if (!parsed.success) {
    return { values, fieldErrors: fieldErrorsFrom(parsed.error) };
  }
  const supabase = await createSupabaseServerClient();
  const room = {
    name: parsed.data.name,
    capacity: parsed.data.capacity,
    notes: parsed.data.notes,
  };
  const { error } = roomId
    ? await supabase
        .from("event_rooms")
        .update(room)
        .eq("id", roomId)
        .eq("event_id", eventId)
    : await supabase.from("event_rooms").insert({
        ...room,
        event_id: eventId,
        sort_order: Number(formData.get("sortOrder") ?? 0) || 0,
      });
  if (error) {
    return {
      values,
      error:
        error.code === "23505"
          ? "There's already a room with that name."
          : friendlyDatabaseError(error),
    };
  }
  redirect(`/admin/events/${eventId}/rooms?notice=saved`);
}

/** Removes a room nobody is in. */
export async function removeRoomAction(
  eventId: string,
  roomId: string,
): Promise<ActionState> {
  if (!(await staffWithPermission("events.manage"))) {
    return { error: NOT_ALLOWED };
  }
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId)
    .is("cancelled_at", null);
  if (count) {
    return {
      error: `${count === 1 ? "1 person is" : `${count} people are`} in this room. Move them to another room first.`,
    };
  }
  const { error } = await supabase
    .from("event_rooms")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", roomId)
    .eq("event_id", eventId);
  if (error) return { error: friendlyDatabaseError(error) };
  redirect(`/admin/events/${eventId}/rooms?notice=removed`);
}
