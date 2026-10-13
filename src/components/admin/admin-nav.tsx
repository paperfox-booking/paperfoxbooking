"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The admin menu. On a phone it folds away behind a Menu button, so pages
 * like Check in start at the top of the screen; it closes again after
 * choosing a page. On bigger screens it's always shown.
 */
type NavItems = readonly { href: string; label: string }[];

export function AdminNav({ items }: { items: NavItems }) {
  return <Menu items={items} pathname={usePathname()} />;
}

/** The menu before the page knows its address (shown for a moment at most). */
export function AdminNavFallback({ items }: { items: NavItems }) {
  return <Menu items={items} pathname="" />;
}

function Menu({ items, pathname }: { items: NavItems; pathname: string }) {
  const [open, setOpen] = useState(false);
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }
  const isCurrent = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : href !== "/" && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav
      aria-label="Admin"
      className={cn(
        "flex flex-col items-end sm:w-auto sm:items-center",
        open && "w-full",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="admin-menu"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-12 items-center rounded-lg border-2 border-ink px-4 font-bold sm:hidden"
      >
        {open ? "Close menu" : "Menu"}
      </button>
      <ul
        id="admin-menu"
        className={cn(
          "w-full flex-col gap-1 pt-2 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:pt-0",
          open ? "flex" : "hidden",
        )}
      >
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className="inline-flex min-h-12 w-full items-center rounded-lg px-3 font-bold text-ink no-underline hover:bg-cream-light aria-[current=page]:bg-cream-light aria-[current=page]:underline sm:w-auto"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
