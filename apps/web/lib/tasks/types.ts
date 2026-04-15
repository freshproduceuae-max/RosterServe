export type DepartmentTask = {
  id: string;
  department_id: string;
  name: string;
  required_skill_id: string | null;
  required_skill_name: string | null; // joined from department_skills
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type EventTaskAssignment = {
  id: string;
  event_id: string;
  department_id: string;
  task_id: string;
  volunteer_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// A task slot for a specific event, ready for the assignment UI
export type EventTaskSlot = {
  // from event_task_assignments (null if slot not yet created)
  assignment_id: string | null;
  task_id: string;
  task_name: string;
  required_skill_id: string | null;
  required_skill_name: string | null;
  volunteer_id: string | null;
  volunteer_display_name: string | null;
  badge: TaskBadge; // computed on the volunteer currently assigned
};

export type TaskBadge = "skill_match" | "skill_gap" | "availability_conflict" | "unassigned";

// A volunteer candidate enriched for the task assignment picker
export type VolunteerTaskCandidate = {
  id: string;
  display_name: string;
  badge: TaskBadge; // computed against the specific task's required_skill_id
};
