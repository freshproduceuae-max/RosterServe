"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLeaderRole } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/auth/types";

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", show: true },
    { label: "Events", href: "/events", show: isLeaderRole(role) },
    { label: "Departments", href: "/departments", show: isLeaderRole(role) },
    { label: "Service requests", href: "/assignments", show: role === "volunteer" || role === "team_head" || role === "supporter" },
    { label: "Availability", href: "/availability", show: true },
    { label: "Join Requests", href: "/interests", show: role !== "team_head" && role !== "supporter" },
    { label: "Skills", href: "/skills", show: role !== "team_head" },
    { label: "Admin", href: "/admin", show: role === "super_admin" },
  ] satisfies { label: string; href: string; show: boolean }[];

  const visibleItems = navItems.filter((item) => item.show);

  return (
    <nav className="flex items-center gap-200">
      {/* Hamburger button — mobile only */}
      <button
        type="button"
        aria-label="Open navigation menu"
        onClick={() => setMenuOpen(true)}
        className="flex items-center justify-center rounded-100 p-100 text-neutral-950 hover:bg-neutral-100 md:hidden"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Horizontal nav — desktop only */}
      <div className="hidden md:flex items-center gap-200">
        {visibleItems.map(({ label, href }) => {
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
      </div>

      {/* Mobile overlay drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-0 flex flex-col px-400 pt-500 pb-400 gap-300 md:hidden">
          <div className="flex items-center justify-end">
            <button
              type="button"
              aria-label="Close navigation menu"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center rounded-100 p-100 text-neutral-950 hover:bg-neutral-100"
            >
              ✕
            </button>
          </div>
          {visibleItems.map(({ label, href }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`text-body transition-colors duration-fast ${
                  active
                    ? "font-semibold text-brand-calm-600"
                    : "text-neutral-600 hover:text-neutral-950"
                }`}
              >
                {label}
              </Link>
            );
          })}
          <form action="/auth/sign-out" method="POST">
            <button type="submit" className="text-body-sm text-neutral-600">
              Sign out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
