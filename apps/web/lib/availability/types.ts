export type AvailabilityBlockout = {
  id: string;
  volunteer_id: string;
  date: string; // ISO date string YYYY-MM-DD
  reason: string | null;
  created_at: string;
  deleted_at: string | null;
};

export type BlockoutWithVolunteer = AvailabilityBlockout & {
  display_name: string;
  department_name: string;
};

export type VolunteerInScope = {
  id: string;
  display_name: string;
  department_name: string;
};
