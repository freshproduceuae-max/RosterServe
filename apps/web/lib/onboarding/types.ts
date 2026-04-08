export type AvailabilityPreferences = {
  id: string;
  volunteer_id: string;
  preferred_days: string[];
  preferred_times: string[];
  created_at: string;
  updated_at: string;
};

export type VolunteerInterest = {
  id: string;
  volunteer_id: string;
  department_id: string;
  created_at: string;
};

export type VolunteerSkill = {
  id: string;
  volunteer_id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type DepartmentForInterests = {
  id: string;
  name: string;
};

export type OnboardingState = {
  availability: AvailabilityPreferences | null;
  interests: VolunteerInterest[];
  skills: VolunteerSkill[];
};
