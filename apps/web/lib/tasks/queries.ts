import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DepartmentTask,
  EventTaskSlot,
  TaskBadge,
  VolunteerTaskCandidate,
} from "./types";

// ─── helpers ────────────────────────────────────────────────────────────────

function computeBadge(opts: {
  volunteerId: string | null;
  requiredSkillId: string | null;
  blockedIds: Set<string>;
  approvedSkillIdsByVolunteer: Map<string, Set<string>>;
}): TaskBadge {
  const { volunteerId, requiredSkillId, blockedIds, approvedSkillIdsByVolunteer } = opts;
  if (!volunteerId) return "unassigned";
  if (blockedIds.has(volunteerId)) return "availability_conflict";
  if (!requiredSkillId) return "skill_match";
  const skills = approvedSkillIdsByVolunteer.get(volunteerId) ?? new Set<string>();
  return skills.has(requiredSkillId) ? "skill_match" : "skill_gap";
}

// ─── getTasksForDepartment ───────────────────────────────────────────────────

/**
 * Returns active tasks for a department, ordered by name.
 * RLS restricts to the caller's accessible departments.
 */
export async function getTasksForDepartment(
  deptId: string,
): Promise<DepartmentTask[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_tasks")
    .select("*, required_skill:department_skills!required_skill_id(name)")
    .eq("department_id", deptId)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error || !data) return [];

  type RawRow = Omit<DepartmentTask, "required_skill_name"> & {
    required_skill: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    required_skill_name: row.required_skill?.name ?? null,
  }));
}

// ─── getEventTaskSlotsWithCandidates ────────────────────────────────────────

/**
 * Combined query: returns task slots for an event+dept and per-task candidate
 * lists for the assignment picker. Fetches blockouts and skills in bulk to
 * avoid per-task DB round trips.
 *
 * @param filterMemberIds - If provided, candidates are scoped to this subset
 *   (used by team_head to limit picker to their own team members).
 */
export async function getEventTaskSlotsWithCandidates(
  eventId: string,
  deptId: string,
  filterMemberIds?: string[],
): Promise<{ slots: EventTaskSlot[]; candidatesByTask: Record<string, VolunteerTaskCandidate[]> }> {
  const supabase = await createSupabaseServerClient();

  // 1. Fetch all active tasks for the department
  const tasks = await getTasksForDepartment(deptId);
  if (tasks.length === 0) {
    return { slots: [], candidatesByTask: {} };
  }

  // 2. Fetch event date
  const { data: eventData } = await supabase
    .from("events")
    .select("event_date")
    .eq("id", eventId)
    .single();
  const eventDate: string | null = eventData?.event_date ?? null;

  // 3. Fetch existing active event_task_assignments for this event+dept
  const { data: assignmentData } = await supabase
    .from("event_task_assignments")
    .select("id, task_id, volunteer_id, volunteer:profiles!volunteer_id(display_name)")
    .eq("event_id", eventId)
    .eq("department_id", deptId)
    .is("deleted_at", null);

  type RawAssignment = {
    id: string;
    task_id: string;
    volunteer_id: string | null;
    volunteer: { display_name: string } | null;
  };
  const assignmentMap = new Map<string, RawAssignment>();
  for (const row of (assignmentData ?? []) as unknown as RawAssignment[]) {
    assignmentMap.set(row.task_id, row);
  }

  // 4. Fetch all volunteers with approved interest in this dept
  const { data: interestData } = await supabase
    .from("volunteer_interests")
    .select("volunteer_id, volunteer:profiles!volunteer_id(id, display_name)")
    .eq("department_id", deptId)
    .eq("status", "approved")
    .is("deleted_at", null);

  type InterestRow = {
    volunteer_id: string;
    volunteer: { id: string; display_name: string } | null;
  };
  const allInterestRows = (interestData ?? []) as unknown as InterestRow[];
  let volunteerIds = allInterestRows
    .map((r) => r.volunteer?.id)
    .filter((id): id is string => !!id);
  const nameMap = new Map<string, string>(
    allInterestRows
      .filter((r) => r.volunteer)
      .map((r) => [r.volunteer!.id, r.volunteer!.display_name]),
  );

  // Apply filterMemberIds constraint if provided (team_head scope)
  if (filterMemberIds !== undefined) {
    const filterSet = new Set(filterMemberIds);
    volunteerIds = volunteerIds.filter((id) => filterSet.has(id));
  }

  // 5. Bulk fetch blockouts on event_date
  const blockedIds = new Set<string>();
  if (eventDate && volunteerIds.length > 0) {
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

  // 6. Bulk fetch approved skill IDs for these volunteers in this dept
  //    Keyed by volunteer_id -> Set<skill_id>
  const approvedSkillIdsByVolunteer = new Map<string, Set<string>>();
  if (volunteerIds.length > 0) {
    const { data: skillData } = await supabase
      .from("volunteer_skills")
      .select("volunteer_id, skill_id")
      .in("volunteer_id", volunteerIds)
      .eq("department_id", deptId)
      .eq("status", "approved")
      .is("deleted_at", null)
      .not("skill_id", "is", null);
    for (const row of (skillData ?? []) as { volunteer_id: string; skill_id: string | null }[]) {
      if (!row.skill_id) continue;
      const existing = approvedSkillIdsByVolunteer.get(row.volunteer_id) ?? new Set<string>();
      existing.add(row.skill_id);
      approvedSkillIdsByVolunteer.set(row.volunteer_id, existing);
    }
  }

  // 7. Build slots (one per task, ordered by task name — already sorted from getTasksForDepartment)
  const slots: EventTaskSlot[] = tasks.map((task) => {
    const assignment = assignmentMap.get(task.id);
    const volunteerId = assignment?.volunteer_id ?? null;
    const volunteerDisplayName =
      (assignment?.volunteer as unknown as { display_name: string } | null)?.display_name ?? null;
    const badge = computeBadge({
      volunteerId,
      requiredSkillId: task.required_skill_id,
      blockedIds,
      approvedSkillIdsByVolunteer,
    });
    return {
      assignment_id: assignment?.id ?? null,
      task_id: task.id,
      task_name: task.name,
      required_skill_id: task.required_skill_id,
      required_skill_name: task.required_skill_name,
      volunteer_id: volunteerId,
      volunteer_display_name: volunteerDisplayName,
      badge,
    };
  });

  // 8. Build candidatesByTask — compute badge per volunteer per task
  //    Sort order: skill_match + available, skill_match + blocked, skill_gap + available, skill_gap + blocked
  const candidatesByTask: Record<string, VolunteerTaskCandidate[]> = {};
  for (const task of tasks) {
    const candidates: VolunteerTaskCandidate[] = volunteerIds.map((id) => {
      const badge = computeBadge({
        volunteerId: id,
        requiredSkillId: task.required_skill_id,
        blockedIds,
        approvedSkillIdsByVolunteer,
      });
      return {
        id,
        display_name: nameMap.get(id) ?? "Unknown",
        badge,
      };
    });

    // Sort: skill_match available, skill_match blocked, skill_gap available, skill_gap blocked
    function sortOrder(c: VolunteerTaskCandidate): number {
      if (c.badge === "skill_match" && !blockedIds.has(c.id)) return 0;
      if (c.badge === "skill_match") return 1;
      if (c.badge === "skill_gap" && !blockedIds.has(c.id)) return 2;
      return 3;
    }
    candidates.sort((a, b) => {
      const diff = sortOrder(a) - sortOrder(b);
      if (diff !== 0) return diff;
      return a.display_name.localeCompare(b.display_name);
    });

    candidatesByTask[task.id] = candidates;
  }

  return { slots, candidatesByTask };
}
