"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STAFF_ROLES } from "@/lib/auth/permissions";
import { getCurrentUser, staffWithPermission } from "@/lib/auth/session";
import { friendlyDatabaseError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalEmail } from "@/lib/validation/bookings";

const PATH = "/admin/settings/team";
const NOT_ALLOWED = "Only owners can change the team.";

export type TeamState = {
  error?: string;
  fieldErrors?: { email?: string; role?: string };
  values?: { email?: string; role?: string };
  done?: string;
};

const addSchema = z.object({
  email: optionalEmail.pipe(z.string({ error: "Enter their email address" })),
  role: z.enum(STAFF_ROLES, { error: "Choose what they can do" }),
});

/** Gives an existing account a team role. */
export async function addTeamMemberAction(
  _previous: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const values = {
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? ""),
  };
  if (!(await staffWithPermission("team.manage"))) {
    return { values, error: NOT_ALLOWED };
  }
  const parsed = addSchema.safeParse(values);
  if (!parsed.success) {
    const errors: TeamState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as "email" | "role";
      errors[field] ??= issue.message;
    }
    return { values, fieldErrors: errors };
  }
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (!profile) {
    return {
      values,
      fieldErrors: {
        email:
          "There's no account with that email yet. Create it in Supabase first (see the steps above), then add them here.",
      },
    };
  }
  const user = await getCurrentUser();
  const { error } = await supabase.from("staff").insert({
    user_id: profile.id,
    role: parsed.data.role,
    created_by: user?.id ?? null,
  });
  if (error) {
    return {
      values,
      error:
        error.code === "23505"
          ? "They're already on the team. Change their role in the list."
          : friendlyDatabaseError(error),
    };
  }
  revalidatePath(PATH);
  return { done: `${parsed.data.email} is now on the team.` };
}

export type MemberResult = { ok: true } | { ok: false; error: string };

/** Changes someone's role. */
export async function changeRoleAction(
  userId: string,
  role: string,
): Promise<MemberResult> {
  if (!(await staffWithPermission("team.manage"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  const parsed = z.enum(STAFF_ROLES).safeParse(role);
  if (!parsed.success || !z.uuid().safeParse(userId).success) {
    return { ok: false, error: "Choose a role from the list." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("staff")
    .update({ role: parsed.data })
    .eq("user_id", userId);
  if (error) return { ok: false, error: friendlyDatabaseError(error) };
  revalidatePath(PATH);
  return { ok: true };
}

/** Takes someone off the team. Their account stays, as a customer account. */
export async function removeTeamMemberAction(
  userId: string,
): Promise<MemberResult> {
  if (!(await staffWithPermission("team.manage"))) {
    return { ok: false, error: NOT_ALLOWED };
  }
  if (!z.uuid().safeParse(userId).success) {
    return { ok: false, error: "That person couldn't be found." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("staff").delete().eq("user_id", userId);
  if (error) return { ok: false, error: friendlyDatabaseError(error) };
  revalidatePath(PATH);
  return { ok: true };
}
