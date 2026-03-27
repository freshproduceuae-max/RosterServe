import type { AppRole } from "./types";

export const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 40,
  dept_head: 30,
  sub_leader: 20,
  volunteer: 10,
};

export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export const ROLE_HOME_PATH: Record<AppRole, string> = {
  super_admin: "/dashboard",
  dept_head: "/dashboard",
  sub_leader: "/dashboard",
  volunteer: "/dashboard",
};

export function isLeaderRole(role: AppRole): boolean {
  return role !== "volunteer";
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  dept_head: "Department Head",
  sub_leader: "Sub-Leader",
  volunteer: "Volunteer",
};
