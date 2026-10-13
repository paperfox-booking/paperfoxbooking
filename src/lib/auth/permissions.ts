/**
 * What each staff role may do (section 2 of CLAUDE.md). These checks decide
 * what the admin area shows and allows, and server code must call them before
 * acting. The database enforces the same rules with row level security, so a
 * missed check here still can't leak or change data.
 */

export const STAFF_ROLES = ["owner", "admin", "door"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "settings.manage",
  "team.manage",
  "events.manage",
  "bookings.view",
  "bookings.manage",
  "payments.view",
  "payments.record",
  "refunds.make",
  "attendees.message",
  "checkin.use",
  "reports.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: [
    "events.manage",
    "bookings.view",
    "bookings.manage",
    "payments.view",
    "payments.record",
    "refunds.make",
    "attendees.message",
    "checkin.use",
    "reports.view",
  ],
  door: ["bookings.view", "checkin.use"],
};

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    typeof value === "string" &&
    (STAFF_ROLES as readonly string[]).includes(value)
  );
}

/** True when someone with this role (or no role at all) may do this. */
export function can(
  role: StaffRole | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Admin",
  door: "Door staff",
};
