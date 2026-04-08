import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  RosterGapSummary,
  GapState,
  HeadcountGapSummary,
  TeamHeadcountGap,
} from "./gap-types";

/**
 * getSkillGapsForDepartmentRoster
 * Computes the skill gap summary for a department's roster on a given event.
 */
export async function getSkillGapsForDepartmentRoster(
  eventId: string,
  deptId: string,
): Promise<RosterGapSummary> {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Fetch required skill names for this department
    const { data: requiredSkills, error: requiredError } = await supabase
      .from("department_skills")
      .select("name")
      .eq("department_id", deptId)
      .eq("is_required", true)
      .is("deleted_at", null);

    if (requiredError) {
      console.error("[getSkillGapsForDepartmentRoster] failed to fetch required skills", requiredError);
      return { required: [], covered: [], gaps: [], state: "uncovered" };
    }
    if (!requiredSkills || requiredSkills.length === 0) {
      return { required: [], covered: [], gaps: [], state: "no_requirements" };
    }

    const required = requiredSkills
      .map((s) => s.name)
      .filter((n): n is string => n !== null)
      .sort((a, b) => a.localeCompare(b));

    // 2. Fetch non-declined assignment volunteer_ids for this event + department.
    // Declined volunteers are no longer expected to serve, so they should not
    // contribute to skill coverage. invited, accepted, and served all count.
    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select("volunteer_id")
      .eq("event_id", eventId)
      .eq("department_id", deptId)
      .neq("status", "declined")
      .is("deleted_at", null);

    if (assignmentsError) {
      return { required, covered: [], gaps: required, state: "uncovered" };
    }

    const volunteerIds = (assignments ?? [])
      .map((a) => a.volunteer_id)
      .filter((id): id is string => id !== null);

    // 3. If no assignments, all required skills are gaps
    if (volunteerIds.length === 0) {
      return {
        required,
        covered: [],
        gaps: required,
        state: required.length > 0 ? "uncovered" : "no_requirements",
      };
    }

    // 4. Fetch approved skill names for those volunteers in this department
    const { data: volunteerSkills, error: vsError } = await supabase
      .from("volunteer_skills")
      .select("name")
      .in("volunteer_id", volunteerIds)
      .eq("department_id", deptId)
      .eq("status", "approved")
      .is("deleted_at", null)
      .not("department_id", "is", null);

    if (vsError) {
      return { required, covered: [], gaps: required, state: "uncovered" };
    }

    // Build a set of approved skill names that intersect with required
    const requiredSet = new Set(required);
    const approvedNamesInRequired = new Set<string>(
      (volunteerSkills ?? [])
        .map((vs) => vs.name)
        .filter((name): name is string => name !== null && requiredSet.has(name)),
    );

    // 5. Derive covered and gaps
    const covered = required
      .filter((name) => approvedNamesInRequired.has(name))
      .sort((a, b) => a.localeCompare(b));

    const gaps = required
      .filter((name) => !approvedNamesInRequired.has(name))
      .sort((a, b) => a.localeCompare(b));

    // 6. Derive state
    let state: GapState;
    if (covered.length === 0) {
      state = "uncovered";
    } else if (gaps.length === 0) {
      state = "fully_covered";
    } else {
      state = "partial";
    }

    return { required, covered, gaps, state };
  } catch (err) {
    console.error("[getSkillGapsForDepartmentRoster] unexpected error", err);
    return { required: [], covered: [], gaps: [], state: "uncovered" };
  }
}

/**
 * getHeadcountGapsForRoster
 * Computes per-team headcount gap for a department roster on a given event.
 *
 * filterTeamIds — when provided, only teams in this list are included.
 *                 Used by the team_head branch to scope to their own teams.
 */
export async function getHeadcountGapsForRoster(
  eventId: string,
  deptId: string,
  filterTeamIds?: string[],
): Promise<HeadcountGapSummary> {
  const noRequirements: HeadcountGapSummary = { teams: [], state: "no_requirements" };
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Get event_type for this event
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("event_type")
      .eq("id", eventId)
      .single();
    if (eventError || !eventData) return noRequirements;
    const eventType = eventData.event_type as string;

    // 2. Get active teams in this department (optionally filtered)
    let teamsQuery = supabase
      .from("teams")
      .select("id, name")
      .eq("department_id", deptId)
      .is("deleted_at", null);
    if (filterTeamIds !== undefined) {
      if (filterTeamIds.length === 0) return noRequirements;
      teamsQuery = teamsQuery.in("id", filterTeamIds);
    }
    const { data: teamsData, error: teamsError } = await teamsQuery;
    if (teamsError || !teamsData || teamsData.length === 0) return noRequirements;

    const teamIds = teamsData.map((t: { id: string }) => t.id);

    // 3. Get headcount requirements for these teams + this event type
    const { data: reqData, error: reqError } = await supabase
      .from("team_headcount_requirements")
      .select("team_id, required_count")
      .in("team_id", teamIds)
      .eq("event_type", eventType);
    if (reqError || !reqData || reqData.length === 0) return noRequirements;

    const reqTeamIds = reqData.map((r: { team_id: string; required_count: number }) => r.team_id);

    // 4. Count non-declined assignments per team (invited + accepted + served count as confirmed)
    const { data: assignData, error: assignError } = await supabase
      .from("assignments")
      .select("sub_team_id")
      .eq("event_id", eventId)
      .eq("department_id", deptId)
      .in("sub_team_id", reqTeamIds)
      .neq("status", "declined")
      .is("deleted_at", null);
    if (assignError) return noRequirements;

    const countByTeam = new Map<string, number>();
    (assignData ?? []).forEach((a: { sub_team_id: string | null }) => {
      if (a.sub_team_id) {
        countByTeam.set(a.sub_team_id, (countByTeam.get(a.sub_team_id) ?? 0) + 1);
      }
    });

    // 5. Build per-team gap rows
    const teamNameMap = new Map(
      teamsData.map((t: { id: string; name: string }) => [t.id, t.name]),
    );

    const teams: TeamHeadcountGap[] = reqData.map(
      (req: { team_id: string; required_count: number }) => {
        const confirmed = countByTeam.get(req.team_id) ?? 0;
        const required = req.required_count;
        const gap = Math.max(0, required - confirmed);
        return {
          team_id: req.team_id,
          team_name: teamNameMap.get(req.team_id) ?? "Unknown team",
          required,
          confirmed,
          gap,
          state: gap === 0 ? "met" : "short",
        };
      },
    );

    const hasGaps = teams.some((t) => t.state === "short");
    return { teams, state: hasGaps ? "gaps" : "all_met" };
  } catch (err) {
    console.error("[getHeadcountGapsForRoster] unexpected error", err);
    return noRequirements;
  }
}
