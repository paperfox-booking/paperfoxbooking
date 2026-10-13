/**
 * Turns a database error into something the team can act on. The database's
 * own rules (in the migrations) raise plain English messages with the code
 * P0001, so those are shown as they are.
 */
export function friendlyDatabaseError(
  error: { code?: string; message?: string } | null,
  fallback = "Something went wrong saving that. Please try again in a minute.",
): string {
  if (!error) return fallback;
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") {
    return "You don't have permission to do that. If you need to, ask an owner to change your role.";
  }
  if (error.code === "23505") {
    return "That's already been saved. Refresh the page to see it.";
  }
  return fallback;
}
