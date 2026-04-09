import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import type {
  Assignment,
  AssignmentForVolunteer,
  AssignmentWithContext,
  TeamHeadOption,
  VolunteerForAssignment,
} from "./types";

/**
 * getAssignmentsForRoster
 * Dept_head: all active assignments for event+dept with volunteer display name
 * and sub-team name. RLS restricts to caller's owned departments.
 */
export async function getAssignmentsForRoster(
  eventId: string,
  deptId: string,
): Promise<AssignmentWithContext[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), sub_team:teams!sub_team_id(name)",
    )
    .eq("event_id", eventId)
    .eq("department_id", deptId)
    .is("deleted_at", null)
    .order("sub_team_id", { ascending: true, nullsFirst: false })
    .order("volunteer_id", { ascending: true });
  if (error || !data) return [];

  type RawRow = Omit<AssignmentWithContext, "volunteer_display_name" | "sub_team_name"> & {
    volunteer: { display_name: string } | null;
    sub_team: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    volunteer_display_name: row.volunteer?.display_name ?? "Unknown",
    sub_team_name: row.sub_team?.name ?? null,
  }));
}

/**
 * getTeamHeadAssignments
 * Team head: active assignments for event+dept where sub_team_id is in the
 * caller's owned sub-teams. Caller must pass all owned sub-team IDs.
 * RLS restricts to caller's owned sub-teams.
 */
export async function getTeamHeadAssignments(
  eventId: string,
  deptId: string,
  subTeamIds: string[],
): Promise<AssignmentWithContext[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), sub_team:teams!sub_team_id(name)",
    )
    .eq("event_id", eventId)
    .eq("department_id", deptId)
    .in("sub_team_id", subTeamIds)
    .is("deleted_at", null)
    .order("sub_team_id", { ascending: true })
    .order("volunteer_id", { ascending: true });
  if (error || !data) return [];

  type RawRow = Omit<AssignmentWithContext, "volunteer_display_name" | "sub_team_name"> & {
    volunteer: { display_name: string } | null;
    sub_team: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    volunteer_display_name: row.volunteer?.display_name ?? "Unknown",
    sub_team_name: row.sub_team?.name ?? null,
  }));
}

/**
 * getAllAssignmentsForEventDept
 * Super_admin: all active assignments for event+dept.
 * RLS restricts to super_admin callers only.
 */
export async function getAllAssignmentsForEventDept(
  eventId: string,
  deptId: string,
): Promise<AssignmentWithContext[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), sub_team:teams!sub_team_id(name)",
    )
    .eq("event_id", eventId)
    .eq("department_id", deptId)
    .is("deleted_at", null)
    .order("sub_team_id", { ascending: true, nullsFirst: false })
    .order("volunteer_id", { ascending: true });
  if (error || !data) return [];

  type RawRow = Omit<AssignmentWithContext, "volunteer_display_name" | "sub_team_name"> & {
    volunteer: { display_name: string } | null;
    sub_team: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    volunteer_display_name: row.volunteer?.display_name ?? "Unknown",
    sub_team_name: row.sub_team?.name ?? null,
  }));
}

/**
 * getVolunteersForAssignment
 * Multi-step query to avoid over-joining. Returns VolunteerForAssignment[]
 * sorted: available first, not-yet-assigned first, then alphabetical.
 *
 * Steps:
 *  1. Fetch event_date for the event
 *  2. Fetch volunteers with approved interest in deptId
 *  3. Fetch blockouts for those volunteers on event_date
 *  4. Fetch approved skills for those volunteers in deptId
 *  5. Fetch existing active assignments for event+dept
 *  6. Merge in JS
 */
export async function getVolunteersForAssignment(
  deptId: string,
  eventId: string,
): Promise<VolunteerForAssignment[]> {
  const supabase = await createSupabaseServerClient();

  // Step 1: event_date
  const { data: eventData } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", eventId)
    .single();
  const eventDate: string | null = eventData?.event_date ?? null;

  // Step 2: volunteers with approved interest in this dept
  const { data: interestData } = await supabase
    .from("volunteer_interests")
    .select("volunteer_id, volunteer:profiles!volunteer_id(id, display_name)")
    .eq("department_id", deptId)
    .eq("status", "approved")
    .is("deleted_at", null);
  if (!interestData || interestData.length === 0) return [];

  type InterestRow = {
    volunteer_id: string;
    volunteer: { id: string; display_name: string } | null;
  };
  const rows = interestData as unknown as InterestRow[];
  const volunteerIds = rows
    .map((r) => r.volunteer?.id)
    .filter((id): id is string => !!id);
  const nameMap = new Map<string, string>(
    rows
      .filter((r) => r.volunteer)
      .map((r) => [r.volunteer!.id, r.volunteer!.display_name]),
  );

  // Step 3: blockouts on event_date for these volunteers
  const blockedIds = new Set<string>();
  if (eventDate) {
    const { data: blockoutData } = await supabase
      .from("availability_blockouts")
      .select("volunteer_id")
      .in("volunteer_id", volunteerIds)
      .eq("date", eventDate)
      .is("deleted_at", null);
    (blockoutData ?? []).forEach((b: { volunteer_id: string }) =>
      blockedIds.add(b.volunteer_id),
    );
  }

  // Step 4: approved skills in this dept for these volunteers
  const { data: skillData } = await supabase
    .from("volunteer_skills")
    .select("volunteer_id, name")
    .in("volunteer_id", volunteerIds)
    .eq("department_id", deptId)
    .eq("status", "approved")
    .is("deleted_at", null);
  const skillMap = new Map<string, string[]>();
  (skillData ?? []).forEach((s: { volunteer_id: string; name: string }) => {
    const existing = skillMap.get(s.volunteer_id) ?? [];
    existing.push(s.name);
    skillMap.set(s.volunteer_id, existing);
  });

  // Step 5: existing active assignments for event+dept
  const { data: existingData } = await supabase
    .from("assignments")
    .select("volunteer_id")
    .eq("event_id", eventId)
    .eq("department_id", deptId)
    .is("deleted_at", null);
  const assignedIds = new Set(
    (existingData ?? []).map(
      (a: { volunteer_id: string }) => a.volunteer_id,
    ),
  );

  // Step 6: merge + sort (available first, not-yet-assigned first, then alpha)
  const volunteers: VolunteerForAssignment[] = volunteerIds.map((id) => ({
    id,
    display_name: nameMap.get(id) ?? "Unknown",
    is_available: !blockedIds.has(id),
    already_assigned: assignedIds.has(id),
    approved_skills: skillMap.get(id) ?? [],
  }));

  volunteers.sort((a, b) => {
    if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
    if (a.already_assigned !== b.already_assigned)
      return a.already_assigned ? 1 : -1;
    return a.display_name.localeCompare(b.display_name);
  });

  return volunteers;
}

/**
 * getAssignmentsForVolunteer
 * Returns all non-deleted assignments for the authenticated user, with event
 * title, event date, department name, and team name. Ordered newest first.
 * RLS restricts to rows where volunteer_id = auth.uid() — works for any role.
 */
export async function getAssignmentsForVolunteer(): Promise<
  AssignmentForVolunteer[]
> {
  const session = await getSessionWithProfile();
  if (!session) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "*, event:events!event_id(title, event_date), department:departments!department_id(name), sub_team:teams!sub_team_id(name)",
    )
    .is("deleted_at", null)
    .eq("volunteer_id", session.profile.id)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  type RawRow = Assignment & {
    event: { title: string; event_date: string } | null;
    department: { name: string } | null;
    sub_team: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    event_title: row.event?.title ?? "Unknown event",
    event_date: row.event?.event_date ?? "",
    department_name: row.department?.name ?? "Unknown department",
    sub_team_name: row.sub_team?.name ?? null,
  }));
}

/**
 * getTeamHeadsInDept
 * Returns team heads (team owners) from all teams in deptId except excludeTeamId.
 * Used by the DeptHeadRosterView to populate the substitute team head selector.
 * RLS on departments + teams restricts to the dept_head's owned department.
 */
export async function getTeamHeadsInDept(
  deptId: string,
  excludeTeamId: string,
): Promise<TeamHeadOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, owner_id, owner:profiles!owner_id(display_name)",
    )
    .eq("department_id", deptId)
    .neq("id", excludeTeamId)
    .not("owner_id", "is", null)
    .is("deleted_at", null);
  if (error || !data) return [];

  type RawRow = {
    id: string;
    name: string;
    owner_id: string | null;
    owner: { display_name: string } | null;
  };

  return (data as unknown as RawRow[])
    .filter(
      (row): row is RawRow & { owner_id: string; owner: { display_name: string } } =>
        row.owner_id !== null && row.owner !== null,
    )
    .map((row) => ({
      volunteerId: row.owner_id,
      displayName: row.owner.display_name,
      teamId: row.id,
      teamName: row.name,
    }));
}

// ---------------------------------------------------------------------------
// RS-F017 — Cross-team auto-suggestions
// ---------------------------------------------------------------------------

export type CrossTeamSuggestion = {
  volunteerId: string;
  displayName: string;
  currentTeamId: string;
  currentTeamName: string;
  matchedSkills: string[]; // approved, dept-required skills this volunteer has
  skillScore: number;      // count of matchedSkills
};

/**
 * getCrossTeamSuggestions
 * Returns up to 20 volunteers from OTHER teams in the same department who are
 * not yet assigned to the given event, ranked by how many of the department's
 * required skills they hold (approved).
 */
export async function getCrossTeamSuggestions(
  eventId: string,
  deptId: string,
): Promise<CrossTeamSuggestion[]> {
  const supabase = await createSupabaseServerClient();

  // 1. Required skill names for this department
  const { data: requiredSkillRows } = await supabase
    .from("department_skills")
    .select("name")
    .eq("department_id", deptId)
    .eq("is_required", true)
    .is("deleted_at", null);

  const requiredSkillNames = new Set<string>(
    (requiredSkillRows ?? [])
      .map((r: { name: string | null }) => r.name)
      .filter((n): n is string => n !== null),
  );

  // 2. Volunteer IDs already assigned to this event+dept (any status, not deleted)
  const { data: existingAssignments } = await supabase
    .from("assignments")
    .select("volunteer_id")
    .eq("event_id", eventId)
    .eq("department_id", deptId)
    .is("deleted_at", null);

  const assignedIds = new Set<string>(
    (existingAssignments ?? []).map(
      (a: { volunteer_id: string }) => a.volunteer_id,
    ),
  );

  // 3. Active members of OTHER teams in this dept (team_id IS NOT NULL)
  const { data: memberRows } = await supabase
    .from("department_members")
    .select(
      "volunteer_id, team_id, volunteer:profiles!volunteer_id(display_name), team:teams!team_id(name)",
    )
    .eq("department_id", deptId)
    .not("team_id", "is", null)
    .is("deleted_at", null);

  if (!memberRows || memberRows.length === 0) return [];

  type MemberRow = {
    volunteer_id: string;
    team_id: string;
    volunteer: { display_name: string } | null;
    team: { name: string } | null;
  };

  // Exclude already-assigned volunteers
  const candidates = (memberRows as unknown as MemberRow[]).filter(
    (row) => !assignedIds.has(row.volunteer_id),
  );

  if (candidates.length === 0) return [];

  const candidateIds = candidates.map((c) => c.volunteer_id);

  // 4. Approved skills for candidates scoped to this dept
  const skillMap = new Map<string, string[]>(); // volunteerId → matched required skill names
  if (requiredSkillNames.size > 0) {
    const { data: skillRows } = await supabase
      .from("volunteer_skills")
      .select("volunteer_id, name")
      .in("volunteer_id", candidateIds)
      .eq("department_id", deptId)
      .eq("status", "approved")
      .is("deleted_at", null);

    (skillRows ?? []).forEach(
      (s: { volunteer_id: string; name: string | null }) => {
        if (!s.name || !requiredSkillNames.has(s.name)) return;
        const existing = skillMap.get(s.volunteer_id) ?? [];
        existing.push(s.name);
        skillMap.set(s.volunteer_id, existing);
      },
    );
  }

  // 5. Build and rank suggestions
  const suggestions: CrossTeamSuggestion[] = candidates.map((c) => {
    const matchedSkills = skillMap.get(c.volunteer_id) ?? [];
    return {
      volunteerId: c.volunteer_id,
      displayName: c.volunteer?.display_name ?? "Unknown",
      currentTeamId: c.team_id,
      currentTeamName: c.team?.name ?? "Unknown team",
      matchedSkills,
      skillScore: matchedSkills.length,
    };
  });

  suggestions.sort((a, b) => {
    if (b.skillScore !== a.skillScore) return b.skillScore - a.skillScore;
    return a.displayName.localeCompare(b.displayName);
  });

  return suggestions.slice(0, 20);
}
