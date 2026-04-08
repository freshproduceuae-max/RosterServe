export type DepartmentMember = {
  id: string;
  volunteer_id: string;
  department_id: string;
  team_id: string | null;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

// For leader view: member enriched with volunteer display name and team name
export type MemberWithProfile = DepartmentMember & {
  display_name: string;
  team_name: string | null;
};

// For volunteer view: membership enriched with department name and team name
export type MemberWithDepartment = DepartmentMember & {
  department_name: string;
  team_name: string | null;
};
