"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Events", href: "/events" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-200">
      {NAV_ITEMS.map(({ label, href }) => {
        const active =
          href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={`text-body-sm transition-colors duration-fast ${
              active
                ? "font-semibold text-brand-calm-600 underline decoration-brand-calm-600 decoration-2 underline-offset-4"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
