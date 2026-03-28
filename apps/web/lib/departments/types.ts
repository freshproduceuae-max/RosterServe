export type Department = {
  id: string;
  event_id: string;
  name: string;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type SubTeam = {
  id: string;
  department_id: string;
  name: string;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DepartmentWithSubTeams = Department & {
  sub_teams: SubTeam[];
};

export type OwnerProfile = {
  id: string;
  display_name: string;
  role: string;
};
