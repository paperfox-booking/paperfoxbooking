import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  can,
  isStaffRole,
  type Permission,
  type StaffRole,
} from "./permissions";
import { signInPath } from "./redirects";

/**
 * The one place that reads who is signed in (the "data access layer").
 * It reads the session cookie, so call it only inside a <Suspense> boundary,
 * in a Server Action, or in a Route Handler.
 */

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  staffRole: StaffRole | null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return null;

  // Row level security only returns the person's own profile and staff row.
  const [profile, staff] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("staff").select("role").eq("user_id", userId).maybeSingle(),
  ]);

  const claimEmail =
    typeof data.claims.email === "string" ? data.claims.email : "";

  return {
    id: userId,
    email: profile.data?.email ?? claimEmail,
    fullName: profile.data?.full_name ?? null,
    staffRole: isStaffRole(staff.data?.role) ? staff.data.role : null,
  };
});

/** The signed-in person, or a redirect to sign in (and back here after). */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(signInPath(returnTo));
  return user;
}

export type StaffAccess =
  | { allowed: true; user: CurrentUser & { staffRole: StaffRole } }
  | { allowed: false; user: CurrentUser };

/**
 * Checks the signed-in person is on the Paper Fox team, and optionally has a
 * permission. People who aren't signed in are sent to sign in. Signed-in
 * people without access get `allowed: false`, so the page can say so.
 */
export async function requireStaff(
  returnTo: string,
  permission?: Permission,
): Promise<StaffAccess> {
  const user = await requireUser(returnTo);
  const role = user.staffRole;
  if (!role || (permission && !can(role, permission))) {
    return { allowed: false, user };
  }
  return { allowed: true, user: { ...user, staffRole: role } };
}
