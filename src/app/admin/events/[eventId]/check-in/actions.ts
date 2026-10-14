"use server";

import { staffWithPermission } from "@/lib/auth/session";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CheckInResult =
  { ok: true; checkedInAt: string | null } | { ok: false; error: string };

/** Marks someone as arrived, or undoes it. */
export async function checkInAction(
  bookingId: string,
  arrived: boolean,
): Promise<CheckInResult> {
  if (!(await staffWithPermission("checkin.use"))) {
    return { ok: false, error: "You need a team account to check people in." };
  }
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("set_checked_in", {
    booking_id: bookingId,
    arrived,
  });
  if (error) return { ok: false, error: friendlyDatabaseError(error) };
  return { ok: true, checkedInAt: data ?? null };
}
