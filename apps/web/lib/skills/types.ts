// DepartmentSkill — maps department_skills row
export type DepartmentSkill = {
  id: string;
  department_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  deleted_at: string | null;
};

// VolunteerSkillClaim — maps full volunteer_skills row (all columns including new ones)
export type VolunteerSkillClaim = {
  id: string;
  volunteer_id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  department_id: string | null;
  skill_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// SkillClaimWithDepartment — for volunteer view: claim + department_name + skill_name
export type SkillClaimWithDepartment = VolunteerSkillClaim & {
  department_name: string | null;
  skill_name: string | null; // null for legacy rows where skill_id is null
};

// SkillClaimWithVolunteer — for leader view: claim + volunteer_display_name + skill_name + department_name
export type SkillClaimWithVolunteer = VolunteerSkillClaim & {
  volunteer_display_name: string;
  skill_name: string;
  department_name: string;
};
