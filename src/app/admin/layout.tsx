import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/site/brand-mark";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Paper Fox admin" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/password", label: "Change password" },
  { href: "/", label: "Public site" },
] as const;

/**
 * The admin area's frame. It shows no data, so it can load instantly; each
 * admin page checks the person's role on the server before showing anything.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <header className="border-b-4 border-coral bg-white">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <BrandMark href="/admin" suffix="Admin" />
          <nav aria-label="Admin">
            <ul className="flex flex-wrap items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-12 items-center rounded-lg px-3 font-bold text-ink no-underline hover:bg-cream-light"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1 bg-cream-light">
        <div className="mx-auto max-w-[110rem] px-4 py-8">{children}</div>
      </main>
    </>
  );
}
