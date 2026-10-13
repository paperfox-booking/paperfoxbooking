import Link from "next/link";
import { BrandMark } from "./brand-mark";

/**
 * The public header. It doesn't read the session, so it's part of the static
 * shell and appears instantly; "My account" sends people to sign in if needed.
 */
export function SiteHeader() {
  return (
    <header className="border-b-4 border-teal bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <BrandMark />
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 sm:gap-4">
            <li>
              <Link
                href="/#events"
                className="hidden min-h-12 items-center px-2 font-bold text-ink no-underline hover:underline sm:inline-flex"
              >
                Events
              </Link>
            </li>
            <li>
              <Link
                href="/account"
                className="inline-flex min-h-12 items-center rounded-lg px-3 font-bold text-ink no-underline hover:bg-cream-light"
              >
                My account
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
