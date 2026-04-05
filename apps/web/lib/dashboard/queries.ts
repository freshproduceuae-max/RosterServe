import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AssignmentWithEventContext,
  DeptHeadDashboardData,
  DeptRosterHealth,
  EventOverview,
  EventWithDeptHealth,
  SubLeaderDashboardData,
  SubTeamRosterSummary,
  VolunteerDashboardData,
} from "./types";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Volunteer
// ---------------------------------------------------------------------------

export async function getVolunteerDashboardData(
  userId: string,
): Promise<VolunteerDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const windowEnd = plusDaysIso(14);

  const [assignmentRes, skillClaimRes, interestRes] = await Promise.all([
    supabase
      .from("assignments")
      .select(
        `id, status, role, event_id, department_id, sub_team_id,
         events!inner(title, event_date),
         departments!inner(name),
         sub_teams(name)`,
      )
      .eq("volunteer_id", userId)
      .in("status", ["invited", "accepted"])
      .is("deleted_at", null)
      .gte("events.event_date", today)
      .lte("events.event_date", windowEnd)
      .order("events.event_date", { ascending: true }),

    supabase
      .from("volunteer_skills")
      .select("id", { count: "exact", head: true })
      .eq("volunteer_id", userId)
      .eq("status", "pending")
      .is("deleted_at", null),

    supabase
      .from("volunteer_interests")
      .select("id", { count: "exact", head: true })
      .eq("volunteer_id", userId)
      .eq("status", "pending")
      .is("deleted_at", null),
  ]);

  type RawAssignment = {
    id: string;
    status: string;
    role: string;
    event_id: string;
    department_id: string;
    sub_team_id: string | null;
    events: { title: string; event_date: string };
    departments: { name: string };
    sub_teams: { name: string } | null;
  };

  const upcomingAssignments: AssignmentWithEventContext[] = (
    (assignmentRes.data ?? []) as unknown as RawAssignment[]
  ).map((row) => ({
    id: row.id,
    status: row.status as AssignmentWithEventContext["status"],
    role: row.role as AssignmentWithEventContext["role"],
    event_id: row.event_id,
    event_title: row.events.title,
    event_date: row.events.event_date,
    department_id: row.department_id,
    department_name: row.departments.name,
    sub_team_id: row.sub_team_id,
    sub_team_name: row.sub_teams?.name ?? null,
  }));

  return {
    upcomingAssignments,
    pendingSkillClaims: skillClaimRes.count ?? 0,
    pendingInterests: interestRes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Dept head
// ---------------------------------------------------------------------------

export async function getDeptHeadDashboardData(
  userId: string,
): Promise<DeptHeadDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const windowEnd = plusDaysIso(14);

  // 1. Fetch owned departments with their event (filtered to 14-day window)
  const { data: deptRows, error: deptError } = await supabase
    .from("departments")
    .select("id, name, event_id, events!inner(title, event_date)")
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .gte("events.event_date", today)
    .lte("events.event_date", windowEnd)
    .order("events.event_date", { ascending: true });

  if (deptError || !deptRows || deptRows.length === 0) {
    const [interestRes, skillRes] = await Promise.all([
      supabase
        .from("volunteer_interests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("deleted_at", null),
      supabase
        .from("volunteer_skills")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .is("deleted_at", null),
    ]);
    return {
      eventSummaries: [],
      pendingInterests: interestRes.count ?? 0,
      pendingSkillApprovals: skillRes.count ?? 0,
    };
  }

  type RawDeptRow = {
    id: string;
    name: string;
    event_id: string;
    events: { title: string; event_date: string };
  };
  const depts = deptRows as unknown as RawDeptRow[];
  const deptIds = depts.map((d) => d.id);

  // 2. Fetch all non-deleted assignments for these depts — all statuses needed
  // so that declined counts render correctly for dept heads.
  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("department_id, volunteer_id, status")
    .in("department_id", deptIds)
    .is("deleted_at", null);

  // Count by dept + status
  type StatusCount = { invited: number; accepted: number; declined: number };
  const statusByDept = new Map<string, StatusCount>();
  for (const deptId of deptIds) {
    statusByDept.set(deptId, { invited: 0, accepted: 0, declined: 0 });
  }
  for (const row of assignmentRows ?? []) {
    const counts = statusByDept.get(row.department_id);
    if (!counts) continue;
    if (row.status === "invited") counts.invited++;
    else if (row.status === "accepted") counts.accepted++;
    else if (row.status === "declined") counts.declined++;
  }

  // 3. Bulk gap count: required skills vs approved coverage across all depts
  const { data: requiredSkillRows } = await supabase
    .from("department_skills")
    .select("department_id, name")
    .in("department_id", deptIds)
    .eq("is_required", true)
    .is("deleted_at", null);

  // Group required skill names by dept
  const requiredByDept = new Map<string, Set<string>>();
  for (const row of requiredSkillRows ?? []) {
    if (!requiredByDept.has(row.department_id)) {
      requiredByDept.set(row.department_id, new Set());
    }
    if (row.name) requiredByDept.get(row.department_id)!.add(row.name);
  }

  // Derive non-declined volunteer IDs from the already-fetched assignment rows
  // (declined volunteers are excluded from skill coverage per the RS-F009 interim coverage rule).
  const assignedVolunteers = (assignmentRows ?? []).filter(
    (r) => r.status !== "declined" && r.volunteer_id,
  );

  const volunteersByDept = new Map<string, string[]>();
  for (const row of assignedVolunteers ?? []) {
    if (!volunteersByDept.has(row.department_id)) {
      volunteersByDept.set(row.department_id, []);
    }
    if (row.volunteer_id) volunteersByDept.get(row.department_id)!.push(row.volunteer_id);
  }

  // Fetch approved skills for all relevant volunteer+dept combos in one query
  const allVolunteerIds = [
    ...new Set((assignedVolunteers ?? []).map((r) => r.volunteer_id).filter(Boolean)),
  ];
  const { data: approvedSkillRows } = allVolunteerIds.length > 0
    ? await supabase
        .from("volunteer_skills")
        .select("volunteer_id, department_id, name")
        .in("volunteer_id", allVolunteerIds)
        .in("department_id", deptIds)
        .eq("status", "approved")
        .is("deleted_at", null)
        .not("department_id", "is", null)
    : { data: [] };

  // Build covered set per dept: skill names covered by any assigned volunteer
  const coveredByDept = new Map<string, Set<string>>();
  for (const row of approvedSkillRows ?? []) {
    if (!row.department_id || !row.name) continue;
    if (!coveredByDept.has(row.department_id)) {
      coveredByDept.set(row.department_id, new Set());
    }
    coveredByDept.get(row.department_id)!.add(row.name);
  }

  // Compute gap count per dept
  const gapCountByDept = new Map<string, number>();
  for (const deptId of deptIds) {
    const required = requiredByDept.get(deptId) ?? new Set();
    const covered = coveredByDept.get(deptId) ?? new Set();
    let gaps = 0;
    for (const skill of required) {
      if (!covered.has(skill)) gaps++;
    }
    gapCountByDept.set(deptId, gaps);
  }

  // 4. Aggregate into event summaries
  const eventMap = new Map<string, EventWithDeptHealth>();
  for (const dept of depts) {
    const eventId = dept.event_id;
    if (!eventMap.has(eventId)) {
      eventMap.set(eventId, {
        event_id: eventId,
        event_title: dept.events.title,
        event_date: dept.events.event_date,
        departments: [],
      });
    }
    const counts = statusByDept.get(dept.id) ?? { invited: 0, accepted: 0, declined: 0 };
    const health: DeptRosterHealth = {
      department_id: dept.id,
      department_name: dept.name,
      invited: counts.invited,
      accepted: counts.accepted,
      declined: counts.declined,
      gap_count: gapCountByDept.get(dept.id) ?? 0,
    };
    eventMap.get(eventId)!.departments.push(health);
  }

  const eventSummaries = [...eventMap.values()].sort(
    (a, b) => a.event_date.localeCompare(b.event_date),
  );

  // 5. Pending queues — RLS scopes these to the caller's owned departments
  const [interestRes, skillRes] = await Promise.all([
    supabase
      .from("volunteer_interests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),
    supabase
      .from("volunteer_skills")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .is("deleted_at", null),
  ]);

  return {
    eventSummaries,
    pendingInterests: interestRes.count ?? 0,
    pendingSkillApprovals: skillRes.count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Sub-leader
// ---------------------------------------------------------------------------

export async function getSubLeaderDashboardData(
  userId: string,
): Promise<SubLeaderDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const windowEnd = plusDaysIso(14);

  // 1. Fetch owned sub-teams with their parent dept and event
  const { data: subTeamRows, error: stError } = await supabase
    .from("sub_teams")
    .select(
      `id, name, department_id,
       departments!inner(name, event_id, events!inner(title, event_date))`,
    )
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .gte("departments.events.event_date", today)
    .lte("departments.events.event_date", windowEnd)
    .order("departments.events.event_date", { ascending: true });

  if (stError || !subTeamRows || subTeamRows.length === 0) {
    return { subTeamSummaries: [] };
  }

  type RawSubTeam = {
    id: string;
    name: string;
    department_id: string;
    departments: {
      name: string;
      event_id: string;
      events: { title: string; event_date: string };
    };
  };
  const subTeams = subTeamRows as unknown as RawSubTeam[];
  const subTeamIds = subTeams.map((st) => st.id);
  const deptIds = [...new Set(subTeams.map((st) => st.department_id))];

  // 2. Fetch assignments for these sub-teams in one query
  const { data: assignmentRows } = await supabase
    .from("assignments")
    .select("sub_team_id, status")
    .in("sub_team_id", subTeamIds)
    .is("deleted_at", null);

  type STCounts = { invited: number; accepted: number; declined: number };
  const countsBySubTeam = new Map<string, STCounts>();
  for (const stId of subTeamIds) {
    countsBySubTeam.set(stId, { invited: 0, accepted: 0, declined: 0 });
  }
  for (const row of assignmentRows ?? []) {
    if (!row.sub_team_id) continue;
    const counts = countsBySubTeam.get(row.sub_team_id);
    if (!counts) continue;
    if (row.status === "invited") counts.invited++;
    else if (row.status === "accepted") counts.accepted++;
    else if (row.status === "declined") counts.declined++;
  }

  // 3. Bulk gap count for owned depts (same bulk approach as dept_head)
  const { data: requiredSkillRows } = await supabase
    .from("department_skills")
    .select("department_id, name")
    .in("department_id", deptIds)
    .eq("is_required", true)
    .is("deleted_at", null);

  const requiredByDept = new Map<string, Set<string>>();
  for (const row of requiredSkillRows ?? []) {
    if (!requiredByDept.has(row.department_id)) {
      requiredByDept.set(row.department_id, new Set());
    }
    if (row.name) requiredByDept.get(row.department_id)!.add(row.name);
  }

  const { data: assignedVolunteers } = await supabase
    .from("assignments")
    .select("department_id, volunteer_id")
    .in("sub_team_id", subTeamIds)
    .neq("status", "declined")
    .is("deleted_at", null);

  const allVolunteerIds = [
    ...new Set((assignedVolunteers ?? []).map((r) => r.volunteer_id).filter(Boolean)),
  ];
  const { data: approvedSkillRows } = allVolunteerIds.length > 0
    ? await supabase
        .from("volunteer_skills")
        .select("volunteer_id, department_id, name")
        .in("volunteer_id", allVolunteerIds)
        .in("department_id", deptIds)
        .eq("status", "approved")
        .is("deleted_at", null)
        .not("department_id", "is", null)
    : { data: [] };

  const coveredByDept = new Map<string, Set<string>>();
  for (const row of approvedSkillRows ?? []) {
    if (!row.department_id || !row.name) continue;
    if (!coveredByDept.has(row.department_id)) {
      coveredByDept.set(row.department_id, new Set());
    }
    coveredByDept.get(row.department_id)!.add(row.name);
  }

  const gapCountByDept = new Map<string, number>();
  for (const deptId of deptIds) {
    const required = requiredByDept.get(deptId) ?? new Set();
    const covered = coveredByDept.get(deptId) ?? new Set();
    let gaps = 0;
    for (const skill of required) {
      if (!covered.has(skill)) gaps++;
    }
    gapCountByDept.set(deptId, gaps);
  }

  // 4. Build summaries
  const subTeamSummaries: SubTeamRosterSummary[] = subTeams.map((st) => {
    const counts = countsBySubTeam.get(st.id) ?? { invited: 0, accepted: 0, declined: 0 };
    return {
      sub_team_id: st.id,
      sub_team_name: st.name,
      department_id: st.department_id,
      department_name: st.departments.name,
      event_id: st.departments.event_id,
      event_title: st.departments.events.title,
      event_date: st.departments.events.event_date,
      invited: counts.invited,
      accepted: counts.accepted,
      declined: counts.declined,
      gap_count: gapCountByDept.get(st.department_id) ?? 0,
    };
  });

  subTeamSummaries.sort((a, b) => a.event_date.localeCompare(b.event_date));

  return { subTeamSummaries };
}

// ---------------------------------------------------------------------------
// Super admin
// ---------------------------------------------------------------------------

export async function getSuperAdminDashboardData(): Promise<{ upcomingEvents: EventOverview[] }> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const windowEnd = plusDaysIso(14);

  const { data: eventRows, error } = await supabase
    .from("events")
    .select("id, title, event_date, status")
    .is("deleted_at", null)
    .gte("event_date", today)
    .lte("event_date", windowEnd)
    .order("event_date", { ascending: true });

  if (error || !eventRows || eventRows.length === 0) {
    return { upcomingEvents: [] };
  }

  const eventIds = eventRows.map((e) => e.id);

  // Dept counts and assigned volunteer counts in two bulk queries
  const [deptRes, assignRes] = await Promise.all([
    supabase
      .from("departments")
      .select("event_id")
      .in("event_id", eventIds)
      .is("deleted_at", null),
    supabase
      .from("assignments")
      .select("event_id, volunteer_id")
      .in("event_id", eventIds)
      .neq("status", "declined")
      .is("deleted_at", null),
  ]);

  const deptCountByEvent = new Map<string, number>();
  for (const row of deptRes.data ?? []) {
    deptCountByEvent.set(row.event_id, (deptCountByEvent.get(row.event_id) ?? 0) + 1);
  }

  // Count distinct volunteers per event
  const volunteerSetByEvent = new Map<string, Set<string>>();
  for (const row of assignRes.data ?? []) {
    if (!row.volunteer_id) continue;
    if (!volunteerSetByEvent.has(row.event_id)) {
      volunteerSetByEvent.set(row.event_id, new Set());
    }
    volunteerSetByEvent.get(row.event_id)!.add(row.volunteer_id);
  }

  const upcomingEvents: EventOverview[] = eventRows.map((e) => ({
    event_id: e.id,
    event_title: e.title,
    event_date: e.event_date,
    event_status: e.status,
    department_count: deptCountByEvent.get(e.id) ?? 0,
    assigned_count: volunteerSetByEvent.get(e.id)?.size ?? 0,
  }));

  return { upcomingEvents };
}
