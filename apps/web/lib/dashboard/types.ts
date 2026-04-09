import type { AssignmentStatus, AssignmentRole } from "@/lib/assignments/types";
import type { AppRole } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

export type AssignmentWithEventContext = {
  id: string;
  status: AssignmentStatus;
  role: AssignmentRole;
  event_id: string;
  event_title: string;
  event_date: string; // ISO date string
  department_id: string;
  department_name: string;
  sub_team_id: string | null;
  sub_team_name: string | null;
};

export type DeptRosterHealth = {
  department_id: string;
  department_name: string;
  invited: number;
  accepted: number;
  declined: number;
  gap_count: number;
  /** Team head role assignments with status 'invited' or 'declined' */
  pending_team_heads: number;
};

export type EventWithDeptHealth = {
  event_id: string;
  event_title: string;
  event_date: string; // ISO date string
  departments: DeptRosterHealth[];
};

export type SubTeamRosterSummary = {
  sub_team_id: string;
  sub_team_name: string;
  department_id: string;
  department_name: string;
  event_id: string;
  event_title: string;
  event_date: string; // ISO date string
  invited: number;
  accepted: number;
  declined: number;
  gap_count: number;
};

export type EventOverview = {
  event_id: string;
  event_title: string;
  event_date: string; // ISO date string
  event_status: string;
  department_count: number;
  assigned_count: number;
};

// ---------------------------------------------------------------------------
// Per-role data shapes
// ---------------------------------------------------------------------------

export type VolunteerDashboardData = {
  upcomingAssignments: AssignmentWithEventContext[];
  pendingSkillClaims: number;
  pendingInterests: number;
};

export type DeptHeadDashboardData = {
  eventSummaries: EventWithDeptHealth[];
  pendingInterests: number;
  pendingSkillApprovals: number;
  rotationEntries: import("@/lib/departments/types").RotationEntry[];
  /** Plain object (JSON-safe, RSC-serialisable) — rotatable teams per dept_id. */
  rotationTeamsByDept: Record<string, import("@/lib/departments/queries").RotatableTeamRecord[]>;
};

export type TeamHeadDashboardData = {
  subTeamSummaries: SubTeamRosterSummary[];
  /** The team_head's own invited/accepted/declined service requests */
  myInvitations: AssignmentWithEventContext[];
};

export type SuperAdminDashboardData = {
  upcomingEvents: EventOverview[];
  pendingDeletions: number;
};

export type AllDeptsLeaderDashboardData = {
  eventSummaries: EventWithDeptHealth[];
};

export type SupporterDashboardData = {
  leaderName: string | null;
  leaderRole: AppRole | null;
  upcomingAssignments: AssignmentWithEventContext[];
};
