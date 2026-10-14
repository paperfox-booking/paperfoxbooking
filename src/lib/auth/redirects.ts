/**
 * Where to send people after signing in. Only paths on this site are allowed,
 * so a link like /sign-in?next=https://evil.example can't send anyone away.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/account",
): string {
  if (!next) return fallback;
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  // Reject anything a browser might read as another site, such as /%2F%2Fevil.
  try {
    const url = new URL(next, "https://paper-fox.invalid");
    if (url.origin !== "https://paper-fox.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * The `next` path from the address of the page a form was sent from. A
 * sign-in form only adds its own `next` field once the page has finished
 * loading, so someone quick (or on a slow phone) can send it without one.
 */
export function nextFromAddress(address: string | null | undefined): string {
  if (!address) return "";
  try {
    return safeNextPath(new URL(address).searchParams.get("next"), "");
  } catch {
    return "";
  }
}

export const CUSTOMER_SIGN_IN = "/sign-in";
export const TEAM_SIGN_IN = "/sign-in/team";

/** True for the admin area, which the team reach by signing in with a password. */
export function isTeamArea(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

/**
 * The sign-in page for a private page, remembering where to come back to.
 * The team sign in with a password; customers get an emailed code.
 */
export function signInPath(returnTo: string): string {
  const next = safeNextPath(returnTo, "");
  const page = isTeamArea(next) ? TEAM_SIGN_IN : CUSTOMER_SIGN_IN;
  return next ? `${page}?next=${encodeURIComponent(next)}` : page;
}
