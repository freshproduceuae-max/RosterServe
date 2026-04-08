export type Department = {
  id: string;
  name: string;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Team = {
  id: string;
  department_id: string;
  name: string;
  rotation_label: "A" | "B" | "C" | null;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DepartmentWithTeams = Department & {
  teams: Team[];
};

export type TeamHeadcountRequirement = {
  id: string;
  team_id: string;
  event_type: string;
  required_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type OwnerProfile = {
  id: string;
  display_name: string;
  role: string;
};
