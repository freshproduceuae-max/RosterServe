import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RosterGapSummary, GapState } from "./gap-types";

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

    if (requiredError || !requiredSkills || requiredSkills.length === 0) {
      return { required: [], covered: [], gaps: [], state: "no_requirements" };
    }

    const required = requiredSkills
      .map((s) => s.name as string)
      .sort((a, b) => a.localeCompare(b));

    // 2. Fetch active assignment volunteer_ids for this event + department
    const { data: assignments, error: assignmentsError } = await supabase
      .from("assignments")
      .select("volunteer_id")
      .eq("event_id", eventId)
      .eq("department_id", deptId)
      .is("deleted_at", null);

    if (assignmentsError) {
      return { required, covered: [], gaps: required, state: "uncovered" };
    }

    const volunteerIds = (assignments ?? [])
      .map((a) => a.volunteer_id as string)
      .filter(Boolean);

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
        .map((vs) => vs.name as string)
        .filter((name) => requiredSet.has(name)),
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
  } catch {
    return { required: [], covered: [], gaps: [], state: "no_requirements" };
  }
}
