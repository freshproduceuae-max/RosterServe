export const APP_ROLES = [
  "super_admin",
  "all_depts_leader",
  "dept_head",
  "team_head",
  "supporter",
  "volunteer",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type Profile = {
  id: string;
  role: AppRole;
  display_name: string;
  onboarding_complete: boolean;
  supporter_of: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SessionWithProfile = {
  user: { id: string; email: string };
  profile: Profile;
};
