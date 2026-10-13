"use server";

import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/universal";
import { staffWithPermission } from "@/lib/auth/session";
import { toUkTimeInput, ukToday } from "@/lib/dates";
import { getEvent } from "@/lib/events/admin";
import {
  readBookingSheet,
  SheetLayoutError,
  type Cell,
  type SheetReport,
} from "@/lib/import/booking-sheet";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validation/ids";

/**
 * Importing an event's spreadsheet: first a preview of what will be brought
 * in (with anything to check), then the import itself, which reads the same
 * file again and saves everyone in one go, or nothing at all.
 */

export interface ImportState {
  error?: string;
  report?: SheetReport;
}

const MAX_BYTES = 2_000_000;

async function readUpload(
  eventId: string,
  formData: FormData,
): Promise<{ error: string } | { report: SheetReport }> {
  if (!(await staffWithPermission("bookings.manage"))) {
    return {
      error:
        "You need to be signed in as an owner or admin to import bookings.",
    };
  }
  if (!isUuid(eventId)) return { error: "That event couldn't be found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the spreadsheet to upload." };
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return {
      error:
        "Upload an Excel file whose name ends in .xlsx. If it's an older .xls file, open it in Excel and save it as .xlsx first.",
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      error:
        "That file is too big. One event's spreadsheet is usually much smaller than 2MB: check it's the right file.",
    };
  }

  const event = await getEvent(eventId);
  if (!event) return { error: "That event couldn't be found." };
  if (event.options.length === 0) {
    return {
      error:
        "Add the event's options (such as the 4pm and 9am starts) before importing, so everyone can be matched to one.",
    };
  }

  let rows: Cell[][];
  try {
    rows = (await readSheet(file)) as Cell[][];
  } catch {
    return {
      error:
        "We couldn't open that file. Check it's an Excel spreadsheet (.xlsx) and try again.",
    };
  }

  let report: SheetReport;
  try {
    report = readBookingSheet(
      rows,
      event.options.map((option) => ({
        id: option.id,
        name: option.name,
        pricePence: option.price_pence,
        startTime: option.starts_at ? toUkTimeInput(option.starts_at) : null,
      })),
      ukToday(),
    );
  } catch (error) {
    if (error instanceof SheetLayoutError) return { error: error.message };
    throw error;
  }

  if (report.people.length === 0) {
    return { error: "We couldn't find anyone in that spreadsheet." };
  }
  if (report.people.length > event.capacity) {
    return {
      error: `The spreadsheet has ${report.people.length} people, but the event only has ${event.capacity} places. Increase the event's places first (Change details), then try again.`,
    };
  }
  return { report };
}

export async function previewImportAction(
  eventId: string,
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  return readUpload(eventId, formData);
}

export async function importAction(
  eventId: string,
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const result = await readUpload(eventId, formData);
  if ("error" in result) return result;
  const { report } = result;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("import_bookings", {
    target_event_id: eventId,
    rooms: report.rooms,
    people: report.people.map((person) => ({
      full_name: person.fullName,
      email: person.email,
      is_team: person.isTeam,
      phone: person.phone,
      emergency_contact: person.emergencyContact,
      dietary_health: person.dietaryHealth,
      notes: person.notes,
      ticket_type_id: person.optionId,
      room_name: person.room,
      price_pence: person.pricePence,
      price_note: person.priceNote,
      received_pence: person.receivedPence,
      email_template: person.lastEmail?.template ?? null,
      email_sent_on: person.lastEmail?.sentOn ?? null,
      email_note: person.lastEmail?.note ?? "",
    })),
  });
  if (error) {
    return {
      report,
      error: friendlyDatabaseError(
        error,
        "The import didn't work, so nothing was saved. Please try again in a minute.",
      ),
    };
  }
  redirect(`/admin/events/${eventId}/people?notice=imported&count=${data}`);
}
