export type AssignmentRole = 'volunteer' | 'sub_leader' | 'dept_head';
export type AssignmentStatus = 'invited' | 'accepted' | 'declined' | 'served';

export type Assignment = {
  id: string;
  event_id: string;
  department_id: string;
  sub_team_id: string | null;
  volunteer_id: string;
  role: AssignmentRole;
  status: AssignmentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AssignmentWithContext = Assignment & {
  volunteer_display_name: string;
  sub_team_name: string | null;
};

export type VolunteerForAssignment = {
  id: string;
  display_name: string;
  is_available: boolean;
  already_assigned: boolean;
  approved_skills: string[];
};
