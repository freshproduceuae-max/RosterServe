import type { AppRole, Profile } from "./types";

export const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 60,
  all_depts_leader: 50,
  dept_head: 40,
  team_head: 30,
  supporter: 20,
  volunteer: 10,
};

export function hasMinimumRole(userRole: AppRole, requiredRole: AppRole): boolean {
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export const ROLE_HOME_PATH: Record<AppRole, string> = {
  super_admin: "/dashboard",
  all_depts_leader: "/dashboard",
  dept_head: "/dashboard",
  team_head: "/dashboard",
  supporter: "/dashboard",
  volunteer: "/dashboard",
};

// Returns true for roles that have structural leader access (scoped data reads,
// planning pages, etc.). supporter is excluded because their access is derived
// from supporter_of, not their own structural scope (RS-F018).
export function isLeaderRole(role: AppRole): boolean {
  return role !== "volunteer" && role !== "supporter";
}

// Returns true if the user has any event-creation/management capability.
// Used for list/new page gates and action-layer entry checks.
export function canManageEvents(profile: Profile): boolean {
  if (hasMinimumRole(profile.role, "all_depts_leader")) return true;
  if (
    (profile.role === "dept_head" || profile.role === "team_head") &&
    profile.can_create_events
  )
    return true;
  return false;
}

// Returns true if the user can manage this specific event.
// super_admin and all_depts_leader can manage any event.
// Granted dept_head / team_head can only manage events they created.
// Used for the detail card and edit page to gate action controls.
export function canManageThisEvent(
  profile: Profile,
  event: { created_by: string }
): boolean {
  if (hasMinimumRole(profile.role, "all_depts_leader")) return true;
  if (
    (profile.role === "dept_head" || profile.role === "team_head") &&
    profile.can_create_events &&
    event.created_by === profile.id
  )
    return true;
  return false;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  all_depts_leader: "All Departments Leader",
  dept_head: "Department Head",
  team_head: "Team Head",
  supporter: "Supporter",
  volunteer: "Volunteer",
};
