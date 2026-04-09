import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import type { DepartmentWithTeams, Team, OwnerProfile, TeamHeadcountRequirement } from "./types";

export async function getAllDepartments(): Promise<DepartmentWithTeams[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("departments")
    .select("*, teams(*)")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((dept) => ({
    ...dept,
    teams: (dept.teams as Team[]).filter((t) => t.deleted_at === null),
  })) as DepartmentWithTeams[];
}

export async function getDepartmentById(
  id: string
): Promise<DepartmentWithTeams | null> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("departments")
    .select("*, teams(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    teams: (data.teams as Team[]).filter((t) => t.deleted_at === null),
  } as DepartmentWithTeams;
}

export async function getTeamById(id: string): Promise<Team | null> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single<Team>();

  if (error || !data) return null;
  return data;
}

export async function getTeamHeadcountRequirements(
  teamId: string
): Promise<TeamHeadcountRequirement[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("team_headcount_requirements")
    .select("*")
    .eq("team_id", teamId)
    .order("event_type", { ascending: true });

  if (error || !data) return [];
  return data as TeamHeadcountRequirement[];
}

export async function getProfilesByRole(
  role: "dept_head" | "team_head"
): Promise<OwnerProfile[]> {
  const session = await getSessionWithProfile();
  if (
    !session ||
    (!hasMinimumRole(session.profile.role, "super_admin") &&
      session.profile.role !== "dept_head")
  ) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // dept_head may only browse team_head profiles (for assigning team owners).
  // Prevent a dept_head from enumerating all other dept_heads by role.
  const effectiveRole =
    hasMinimumRole(session.profile.role, "super_admin") ? role : "team_head";

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("role", effectiveRole)
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  if (error || !data) return [];
  return data as OwnerProfile[];
}

export async function getOwnerDisplayNames(
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return {};

  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids)
    .is("deleted_at", null);

  if (!data) return {};
  return Object.fromEntries(data.map((p) => [p.id, p.display_name as string]));
}

// ---------------------------------------------------------------------------
// RS-F016: Rotation schedule
// ---------------------------------------------------------------------------

export type RotatableTeamRecord = { id: string; name: string; rotation_label: "A" | "B" | "C" };

export type RotationScheduleResult = {
  entries: import("./types").RotationEntry[];
  /** Plain record (JSON-safe) — teams per dept_id with rotation labels. */
  teamsByDept: Record<string, RotatableTeamRecord[]>;
};

export async function getRotationSchedule(
  deptIds: string[],
): Promise<RotationScheduleResult> {
  const empty: RotationScheduleResult = { entries: [], teamsByDept: {} };
  if (deptIds.length === 0) return empty;

  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().split("T")[0];
  const windowEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // 1. Teams with rotation labels, grouped by department_id
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, department_id, name, rotation_label")
    .in("department_id", deptIds)
    .is("deleted_at", null)
    .not("rotation_label", "is", null);

  type RawTeam = {
    id: string;
    department_id: string;
    name: string;
    rotation_label: "A" | "B" | "C";
  };
  const teamsWithLabel = (teamRows ?? []) as RawTeam[];

  // Build plain-object teamsByDept (JSON-serialisable — no Map)
  const teamsByDeptInternal: Record<string, RawTeam[]> = {};
  for (const t of teamsWithLabel) {
    if (!teamsByDeptInternal[t.department_id]) teamsByDeptInternal[t.department_id] = [];
    teamsByDeptInternal[t.department_id].push(t);
  }

  // teamsByDept for export (strip department_id — caller doesn't need it)
  const teamsByDeptExport: Record<string, RotatableTeamRecord[]> = {};
  for (const [deptId, teams] of Object.entries(teamsByDeptInternal)) {
    teamsByDeptExport[deptId] = teams.map((t) => ({
      id: t.id,
      name: t.name,
      rotation_label: t.rotation_label,
    }));
  }

  // Departments that have at least one rotatable team
  const activeDeptIds = deptIds.filter((id) => (teamsByDeptInternal[id]?.length ?? 0) > 0);
  if (activeDeptIds.length === 0) return { entries: [], teamsByDept: teamsByDeptExport };

  // 2. Upcoming published events in the 30-day window that have assignments
  //    touching these departments
  const { data: assignRows } = await supabase
    .from("assignments")
    .select(
      "event_id, department_id, events!inner(id, title, event_date, event_type, status)",
    )
    .in("department_id", activeDeptIds)
    .is("deleted_at", null)
    .gte("events.event_date", today)
    .lte("events.event_date", windowEnd)
    .eq("events.status", "published");

  type RawAssignRow = {
    event_id: string;
    department_id: string;
    events: { id: string; title: string; event_date: string; event_type: string; status: string };
  };
  const assignRows_ = (assignRows ?? []) as unknown as RawAssignRow[];

  // Collect unique event+dept combos
  const eventDeptSet = new Set<string>();
  type EventInfo = { id: string; title: string; event_date: string; event_type: string };
  const eventInfoMap = new Map<string, EventInfo>();

  for (const row of assignRows_) {
    const key = `${row.event_id}::${row.department_id}`;
    if (!eventDeptSet.has(key)) {
      eventDeptSet.add(key);
      if (!eventInfoMap.has(row.event_id)) {
        eventInfoMap.set(row.event_id, {
          id: row.events.id,
          title: row.events.title,
          event_date: row.events.event_date,
          event_type: row.events.event_type,
        });
      }
    }
  }

  if (eventDeptSet.size === 0) return { entries: [], teamsByDept: teamsByDeptExport };

  // 3. Existing overrides for these event+dept combos
  const eventIds = [...new Set(assignRows_.map((r) => r.event_id))];
  const { data: overrideRows } = await supabase
    .from("dept_rotation_overrides")
    .select("event_id, department_id, team_id")
    .in("department_id", activeDeptIds)
    .in("event_id", eventIds);

  type RawOverride = { event_id: string; department_id: string; team_id: string };
  const overrides = (overrideRows ?? []) as RawOverride[];

  // Key: `eventId::deptId` → override team_id
  const overrideMap = new Map<string, string>();
  for (const o of overrides) {
    overrideMap.set(`${o.event_id}::${o.department_id}`, o.team_id);
  }

  // 4. History — join events to sort by event_date (not created_at wall-clock)
  //    so rotation cycle respects chronological event order.
  const { data: historyRows } = await supabase
    .from("dept_rotation_overrides")
    .select("department_id, team_id, events!inner(event_date)")
    .in("department_id", activeDeptIds);

  type RawHistory = {
    department_id: string;
    team_id: string;
    events: { event_date: string };
  };
  // Sort descending by event_date in JS (small dataset — < 100 rows typical)
  const history = ((historyRows ?? []) as unknown as RawHistory[]).sort(
    (a, b) => b.events.event_date.localeCompare(a.events.event_date),
  );

  // Build a team lookup: team_id → rotation_label
  const teamLabelMap = new Map<string, "A" | "B" | "C">();
  for (const t of teamsWithLabel) teamLabelMap.set(t.id, t.rotation_label);

  // Last used label per dept (first hit per dept after descending sort = most recent event)
  const lastUsedLabelByDept = new Map<string, "A" | "B" | "C">();
  for (const h of history) {
    if (lastUsedLabelByDept.has(h.department_id)) continue;
    const label = teamLabelMap.get(h.team_id);
    if (label) lastUsedLabelByDept.set(h.department_id, label);
  }

  // Rotation cycle helper
  const ROTATION_CYCLE: ("A" | "B" | "C")[] = ["A", "B", "C"];
  function nextLabel(current: "A" | "B" | "C" | undefined): "A" | "B" | "C" {
    if (!current) return "A";
    const idx = ROTATION_CYCLE.indexOf(current);
    return ROTATION_CYCLE[(idx + 1) % ROTATION_CYCLE.length];
  }

  // 5. Dept name map
  const { data: deptRows } = await supabase
    .from("departments")
    .select("id, name")
    .in("id", activeDeptIds)
    .is("deleted_at", null);
  const deptNameMap = new Map<string, string>(
    ((deptRows ?? []) as { id: string; name: string }[]).map((d) => [d.id, d.name]),
  );

  // 6. Compute RotationEntry for each event+dept combo
  const entries: import("./types").RotationEntry[] = [];

  for (const key of eventDeptSet) {
    const [eventId, deptId] = key.split("::");
    const eventInfo = eventInfoMap.get(eventId);
    if (!eventInfo) continue;

    const deptTeams = teamsByDeptInternal[deptId] ?? [];
    const lastLabel = lastUsedLabelByDept.get(deptId);
    const suggestedLabel = nextLabel(lastLabel);

    const suggestedTeam = deptTeams.find((t) => t.rotation_label === suggestedLabel) ?? null;

    const overrideTeamId = overrideMap.get(key) ?? null;
    let overrideEntry: import("./types").RotationEntry["override"] = null;
    if (overrideTeamId) {
      const t = deptTeams.find((t) => t.id === overrideTeamId);
      if (t) {
        overrideEntry = {
          teamId: t.id,
          teamName: t.name,
          teamLabel: t.rotation_label,
        };
      }
    }

    entries.push({
      eventId,
      eventTitle: eventInfo.title,
      eventDate: eventInfo.event_date,
      eventType: eventInfo.event_type,
      departmentId: deptId,
      departmentName: deptNameMap.get(deptId) ?? deptId,
      suggestedTeam: suggestedTeam
        ? { id: suggestedTeam.id, name: suggestedTeam.name, label: suggestedTeam.rotation_label }
        : null,
      override: overrideEntry,
    });
  }

  entries.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return { entries, teamsByDept: teamsByDeptExport };
}
