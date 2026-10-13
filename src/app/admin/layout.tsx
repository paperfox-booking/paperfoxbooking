import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Paper Fox admin" },
  robots: { index: false, follow: false },
};

/**
 * The admin area's frame. It shows no data, so it can load instantly; each
 * admin page checks the person's role on the server before showing anything.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b-4 border-coral bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <BrandMark href="/admin" suffix="Admin" />
          <nav aria-label="Admin">
            <ul className="flex flex-wrap items-center gap-1">
              <li>
                <Link
                  href="/admin"
                  className="inline-flex min-h-12 items-center rounded-lg px-3 font-bold text-ink no-underline hover:bg-cream-light"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/password"
                  className="inline-flex min-h-12 items-center rounded-lg px-3 font-bold text-ink no-underline hover:bg-cream-light"
                >
                  Change password
                </Link>
              </li>
              <li>
                <Link
                  href="/"
                  className="inline-flex min-h-12 items-center rounded-lg px-3 font-bold text-ink no-underline hover:bg-cream-light"
                >
                  Public site
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1 bg-cream-light">
        <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
      </main>
    </>
  );
}
