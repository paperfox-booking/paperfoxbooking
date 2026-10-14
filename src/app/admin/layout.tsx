import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminNav, AdminNavFallback } from "@/components/admin/admin-nav";
import { BrandMark } from "@/components/site/brand-mark";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Paper Fox admin" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/bank", label: "Bank statement" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/emails", label: "Emails" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/settings", label: "Settings" },
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
      <header className="border-b-4 border-coral bg-white print:hidden">
        <div className="mx-auto flex max-w-[110rem] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <BrandMark href="/admin" suffix="Admin" />
          <Suspense fallback={<AdminNavFallback items={NAV} />}>
            <AdminNav items={NAV} />
          </Suspense>
        </div>
      </header>
      <main id="main" className="flex-1 bg-cream-light print:bg-white">
        <div className="mx-auto max-w-[110rem] px-4 py-8 print:max-w-none print:p-0">
          {children}
        </div>
      </main>
    </>
  );
}
