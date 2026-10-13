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

export function signInPath(returnTo: string): string {
  const next = safeNextPath(returnTo, "");
  return next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in";
}
