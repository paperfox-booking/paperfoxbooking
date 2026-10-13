"use client";

import { useSyncExternalStore } from "react";
import { safeNextPath } from "./redirects";

/**
 * Where to go after signing in, from ?next= in the address. Read in the
 * browser so sign-in pages can stay fully static (the server render uses "").
 * Without it, the server sends the team to the admin area and customers to
 * their account.
 */
export function useReturnPath(): string {
  return useSyncExternalStore(
    subscribeToNothing,
    () =>
      safeNextPath(new URLSearchParams(window.location.search).get("next"), ""),
    () => "",
  );
}

// The address doesn't change while a sign-in page is open, so there's nothing
// to listen for.
function subscribeToNothing(): () => void {
  return () => {};
}
