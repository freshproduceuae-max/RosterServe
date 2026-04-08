export type InterestStatus = "pending" | "approved" | "rejected";

export type InterestRequest = {
  id: string;
  volunteer_id: string;
  department_id: string;
  status: InterestStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  deleted_at: string | null;
  created_at: string;
};

// For the volunteer view: interest row joined with department name
export type InterestWithDepartment = InterestRequest & {
  department_name: string;
};

// For the leader/admin view: interest row joined with volunteer display name and department name
export type InterestWithVolunteer = InterestRequest & {
  display_name: string;
  department_name: string;
};

// For the submit-interest form: available departments the volunteer can still join
export type DepartmentForInterestSubmit = {
  id: string;
  name: string;
};

// Lightweight team record for the inline approval team selector
export type DeptTeam = {
  id: string;
  name: string;
};
