import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/types";
import { getSoftDeletedCount } from "@/lib/admin/queries";
import type {
  AssignmentWithEventContext,
  DeptHeadDashboardData,
  DeptRosterHealth,
  EventOverview,
  EventWithDeptHealth,
  TeamHeadDashboardData,
  SubTeamRosterSummary,
  VolunteerDashboardData,
  AllDeptsLeaderDashboardData,
  SupporterDashboardData,
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
         teams(name)`,
      )
      .eq("volunteer_id", userId)
      .in("status", ["invited", "accepted"])
      .is("deleted_at", null)
      .gte("events.event_date", today)
      .lte("events.event_date", windowEnd),

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
    teams: { name: string } | null;
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
    sub_team_name: row.teams?.name ?? null,
  })).sort((a, b) => a.event_date.localeCompare(b.event_date));

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

  // 1. Owned departments (RLS enforces ownership)
  const { data: deptRows } = await supabase
    .from("departments")
    .select("id, name")
    .eq("owner_id", userId)
    .is("deleted_at", null);

  if (!deptRows || deptRows.length === 0) {
    return { eventSummaries: [], pendingInterests: 0, pendingSkillApprovals: 0 };
  }
  const depts = deptRows as { id: string; name: string }[];
  const deptIds = depts.map((d) => d.id);
  const deptNameMap = new Map(depts.map((d) => [d.id, d.name]));

  // 2. Assignments in those depts for upcoming events, including event context
  const { data: assignRows } = await supabase
    .from("assignments")
    .select(
      "event_id, department_id, volunteer_id, status, role, events!inner(id, title, event_date)",
    )
    .in("department_id", deptIds)
    .is("deleted_at", null)
    .gte("events.event_date", today)
    .lte("events.event_date", windowEnd);

  type RawAssignRow = {
    event_id: string;
    department_id: string;
    volunteer_id: string;
    status: string;
    role: string;
    events: { id: string; title: string; event_date: string };
  };
  const rows = (assignRows ?? []) as unknown as RawAssignRow[];

  // Build event info map and count statuses per event+dept
  const eventInfoMap = new Map<string, { title: string; event_date: string }>();
  type StatusCount = {
    invited: number;
    accepted: number;
    declined: number;
    pending_team_heads: number;
  };
  const statusKey = (eventId: string, deptId: string) => `${eventId}::${deptId}`;
  const statusMap = new Map<string, StatusCount>();

  for (const row of rows) {
    const eId = row.event_id;
    const dId = row.department_id;
    if (!eventInfoMap.has(eId)) {
      eventInfoMap.set(eId, { title: row.events.title, event_date: row.events.event_date });
    }
    const key = statusKey(eId, dId);
    if (!statusMap.has(key)) {
      statusMap.set(key, { invited: 0, accepted: 0, declined: 0, pending_team_heads: 0 });
    }
    const counts = statusMap.get(key)!;
    if (row.status === "invited") counts.invited++;
    else if (row.status === "accepted") counts.accepted++;
    else if (row.status === "declined") counts.declined++;
    if (
      row.role === "team_head" &&
      (row.status === "invited" || row.status === "declined")
    ) {
      counts.pending_team_heads++;
    }
  }

  // 3. Skill gap counts (keep existing bulk approach — it works on dept scope)
  const { data: requiredSkillRows } = await supabase
    .from("department_skills")
    .select("department_id, name")
    .in("department_id", deptIds)
    .eq("is_required", true)
    .is("deleted_at", null);

  const requiredByDept = new Map<string, Set<string>>();
  for (const row of requiredSkillRows ?? []) {
    if (!requiredByDept.has(row.department_id))
      requiredByDept.set(row.department_id, new Set());
    if (row.name) requiredByDept.get(row.department_id)!.add(row.name);
  }

  const nonDeclinedVolunteers = rows.filter(
    (r) => r.status !== "declined" && r.volunteer_id,
  );
  const allVolunteerIds = [
    ...new Set(nonDeclinedVolunteers.map((r) => r.volunteer_id).filter(Boolean)),
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
    if (!coveredByDept.has(row.department_id))
      coveredByDept.set(row.department_id, new Set());
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

  // 4. Aggregate into EventWithDeptHealth[]
  const eventMap = new Map<string, EventWithDeptHealth>();
  for (const [key, counts] of statusMap.entries()) {
    const [eId, dId] = key.split("::");
    if (!eventMap.has(eId)) {
      const info = eventInfoMap.get(eId)!;
      eventMap.set(eId, {
        event_id: eId,
        event_title: info.title,
        event_date: info.event_date,
        departments: [],
      });
    }
    const health: DeptRosterHealth = {
      department_id: dId,
      department_name: deptNameMap.get(dId) ?? dId,
      invited: counts.invited,
      accepted: counts.accepted,
      declined: counts.declined,
      gap_count: gapCountByDept.get(dId) ?? 0,
      pending_team_heads: counts.pending_team_heads,
    };
    eventMap.get(eId)!.departments.push(health);
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
// All Depts Leader
// ---------------------------------------------------------------------------

export async function getAllDeptsLeaderDashboardData(): Promise<AllDeptsLeaderDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const windowEnd = plusDaysIso(14);

  // 1. All departments (RLS allows all_depts_leader to see all)
  const { data: deptRows } = await supabase
    .from("departments")
    .select("id, name")
    .is("deleted_at", null);

  if (!deptRows || deptRows.length === 0) return { eventSummaries: [] };

  const depts = deptRows as { id: string; name: string }[];
  const deptIds = depts.map((d) => d.id);
  const deptNameMap = new Map(depts.map((d) => [d.id, d.name]));

  // 2. Assignments in those depts for upcoming events
  const { data: assignRows } = await supabase
    .from("assignments")
    .select(
      "event_id, department_id, volunteer_id, status, role, events!inner(id, title, event_date)",
    )
    .in("department_id", deptIds)
    .is("deleted_at", null)
    .gte("events.event_date", today)
    .lte("events.event_date", windowEnd);

  type RawAssignRow = {
    event_id: string;
    department_id: string;
    volunteer_id: string;
    status: string;
    role: string;
    events: { id: string; title: string; event_date: string };
  };
  const rows = (assignRows ?? []) as unknown as RawAssignRow[];

  const eventInfoMap = new Map<string, { title: string; event_date: string }>();
  type StatusCount = {
    invited: number;
    accepted: number;
    declined: number;
    pending_team_heads: number;
  };
  const statusKey = (eventId: string, deptId: string) => `${eventId}::${deptId}`;
  const statusMap = new Map<string, StatusCount>();

  for (const row of rows) {
    const eId = row.event_id;
    const dId = row.department_id;
    if (!eventInfoMap.has(eId)) {
      eventInfoMap.set(eId, { title: row.events.title, event_date: row.events.event_date });
    }
    const key = statusKey(eId, dId);
    if (!statusMap.has(key)) {
      statusMap.set(key, { invited: 0, accepted: 0, declined: 0, pending_team_heads: 0 });
    }
    const counts = statusMap.get(key)!;
    if (row.status === "invited") counts.invited++;
    else if (row.status === "accepted") counts.accepted++;
    else if (row.status === "declined") counts.declined++;
    if (
      row.role === "team_head" &&
      (row.status === "invited" || row.status === "declined")
    ) {
      counts.pending_team_heads++;
    }
  }

  // Skill gaps (same bulk approach)
  const { data: requiredSkillRows } = await supabase
    .from("department_skills")
    .select("department_id, name")
    .in("department_id", deptIds)
    .eq("is_required", true)
    .is("deleted_at", null);

  const requiredByDept = new Map<string, Set<string>>();
  for (const row of requiredSkillRows ?? []) {
    if (!requiredByDept.has(row.department_id))
      requiredByDept.set(row.department_id, new Set());
    if (row.name) requiredByDept.get(row.department_id)!.add(row.name);
  }

  const nonDeclinedVolunteers = rows.filter(
    (r) => r.status !== "declined" && r.volunteer_id,
  );
  const allVolunteerIds = [
    ...new Set(nonDeclinedVolunteers.map((r) => r.volunteer_id).filter(Boolean)),
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
    if (!coveredByDept.has(row.department_id))
      coveredByDept.set(row.department_id, new Set());
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

  const eventMap = new Map<string, EventWithDeptHealth>();
  for (const [key, counts] of statusMap.entries()) {
    const [eId, dId] = key.split("::");
    if (!eventMap.has(eId)) {
      const info = eventInfoMap.get(eId)!;
      eventMap.set(eId, {
        event_id: eId,
        event_title: info.title,
        event_date: info.event_date,
        departments: [],
      });
    }
    const health: DeptRosterHealth = {
      department_id: dId,
      department_name: deptNameMap.get(dId) ?? dId,
      invited: counts.invited,
      accepted: counts.accepted,
      declined: counts.declined,
      gap_count: gapCountByDept.get(dId) ?? 0,
      pending_team_heads: counts.pending_team_heads,
    };
    eventMap.get(eId)!.departments.push(health);
  }

  return {
    eventSummaries: [...eventMap.values()].sort(
      (a, b) => a.event_date.localeCompare(b.event_date),
    ),
  };
}

// ---------------------------------------------------------------------------
// Team head
// ---------------------------------------------------------------------------

export async function getTeamHeadDashboardData(
  userId: string,
): Promise<TeamHeadDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const windowEnd = plusDaysIso(14);

  // 1. Fetch owned sub-teams with their parent dept and event
  const { data: subTeamRows, error: stError } = await supabase
    .from("teams")
    .select(
      `id, name, department_id,
       departments!inner(name, event_id, events!inner(title, event_date))`,
    )
    .eq("owner_id", userId)
    .is("deleted_at", null)
    .gte("departments.events.event_date", today)
    .lte("departments.events.event_date", windowEnd);

  if (stError || !subTeamRows || subTeamRows.length === 0) {
    return { subTeamSummaries: [], myInvitations: [] };
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

  // 5. Fetch own team_head service requests (invited/accepted/declined)
  const { data: myInvitationRows } = await supabase
    .from("assignments")
    .select(
      "id, status, role, event_id, department_id, sub_team_id, events!inner(title, event_date), departments!inner(name), teams(name)",
    )
    .eq("volunteer_id", userId)
    .eq("role", "team_head")
    .in("status", ["invited", "accepted", "declined"])
    .is("deleted_at", null);

  type RawInvRow = {
    id: string;
    status: string;
    role: string;
    event_id: string;
    department_id: string;
    sub_team_id: string | null;
    events: { title: string; event_date: string };
    departments: { name: string };
    teams: { name: string } | null;
  };

  const myInvitations: AssignmentWithEventContext[] = (
    (myInvitationRows ?? []) as unknown as RawInvRow[]
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
    sub_team_name: row.teams?.name ?? null,
  })).sort((a, b) => a.event_date.localeCompare(b.event_date));

  return { subTeamSummaries, myInvitations };
}

// ---------------------------------------------------------------------------
// Super admin
// ---------------------------------------------------------------------------

export async function getSuperAdminDashboardData(): Promise<{ upcomingEvents: EventOverview[]; pendingDeletions: number }> {
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
    const pendingDeletions = await getSoftDeletedCount();
    return { upcomingEvents: [], pendingDeletions };
  }

  const eventIds = eventRows.map((e) => e.id);

  // Dept counts and assigned volunteer counts in two bulk queries
  const [deptRes, assignRes, pendingDeletions] = await Promise.all([
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
    getSoftDeletedCount(),
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

  return { upcomingEvents, pendingDeletions };
}

// ---------------------------------------------------------------------------
// Supporter
// ---------------------------------------------------------------------------

export async function getSupporterDashboardData(
  userId: string,
): Promise<SupporterDashboardData> {
  const supabase = await createSupabaseServerClient();
  const today = todayIso();
  const windowEnd = plusDaysIso(14);

  // 1. Look up the supporter's assigned leader via profiles.supporter_of
  const { data: supporterProfile } = await supabase
    .from("profiles")
    .select("supporter_of")
    .eq("id", userId)
    .single();

  let leaderName: string | null = null;
  let leaderRole: AppRole | null = null;

  if (supporterProfile?.supporter_of) {
    const { data: leaderProfile } = await supabase
      .from("profiles")
      .select("display_name, role")
      .eq("id", supporterProfile.supporter_of)
      .single();
    if (leaderProfile) {
      leaderName = leaderProfile.display_name;
      leaderRole = leaderProfile.role as AppRole;
    }
  }

  // 2. Fetch own service requests (invited/accepted) in the 14-day window
  const { data: assignmentRes } = await supabase
    .from("assignments")
    .select(
      `id, status, role, event_id, department_id, sub_team_id,
       events!inner(title, event_date),
       departments!inner(name),
       teams(name)`,
    )
    .eq("volunteer_id", userId)
    .in("status", ["invited", "accepted"])
    .is("deleted_at", null)
    .gte("events.event_date", today)
    .lte("events.event_date", windowEnd);

  type RawAssignment = {
    id: string;
    status: string;
    role: string;
    event_id: string;
    department_id: string;
    sub_team_id: string | null;
    events: { title: string; event_date: string };
    departments: { name: string };
    teams: { name: string } | null;
  };

  const upcomingAssignments: AssignmentWithEventContext[] = (
    (assignmentRes ?? []) as unknown as RawAssignment[]
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
    sub_team_name: row.teams?.name ?? null,
  })).sort((a, b) => a.event_date.localeCompare(b.event_date));

  return { leaderName, leaderRole, upcomingAssignments };
}
