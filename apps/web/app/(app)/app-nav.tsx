"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLeaderRole } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/auth/types";

export function AppNav({ role }: { role: AppRole }) {
  const pathname = usePathname();

  const navItems = [
    { label: "Dashboard", href: "/dashboard", show: true },
    { label: "Events", href: "/events", show: isLeaderRole(role) },
    { label: "Departments", href: "/departments", show: isLeaderRole(role) },
    { label: "Assignments", href: "/assignments", show: role === "volunteer" || role === "team_head" || role === "supporter" },
    { label: "Availability", href: "/availability", show: true },
    { label: "Interests", href: "/interests", show: role !== "team_head" },
    { label: "Skills", href: "/skills", show: role !== "team_head" },
    { label: "Admin", href: "/admin", show: role === "super_admin" },
  ] satisfies { label: string; href: string; show: boolean }[];

  return (
    <nav className="flex items-center gap-200">
      {navItems
        .filter((item) => item.show)
        .map(({ label, href }) => {
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
