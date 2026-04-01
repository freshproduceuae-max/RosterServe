"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AssignmentRole } from "./types";

function rosterPath(eventId: string, deptId: string) {
  return `/events/${eventId}/departments/${deptId}/roster`;
}

/**
 * createAssignment
 * Dept_head: assigns a volunteer to their department (sub-team optional).
 * Sub_leader: assigns a volunteer to one of their owned sub-teams (required).
 * Both: volunteer must have an approved interest in the department.
 */
export async function createAssignment(
  eventId: string,
  deptId: string,
  volunteerId: string,
  role: AssignmentRole,
  subTeamId?: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const callerRole = session.profile.role;
  if (callerRole !== "dept_head" && callerRole !== "sub_leader") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  if (callerRole === "dept_head") {
    // Verify dept ownership
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", deptId)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!dept) return { error: "Department not found or unauthorized" };

    // If sub-team provided, verify it belongs to this dept
    if (subTeamId) {
      const { data: st } = await supabase
        .from("sub_teams")
        .select("id")
        .eq("id", subTeamId)
        .eq("department_id", deptId)
        .is("deleted_at", null)
        .maybeSingle();
      if (!st) return { error: "Sub-team not found or does not belong to this department" };
    }
  } else {
    // sub_leader
    if (!subTeamId) return { error: "Sub-team is required for sub-leader assignments" };
    if (role === "dept_head") return { error: "Sub-leaders cannot assign the dept_head role" };

    // Verify sub-team ownership and that it belongs to this dept
    const { data: st } = await supabase
      .from("sub_teams")
      .select("id")
      .eq("id", subTeamId)
      .eq("department_id", deptId)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!st) return { error: "Sub-team not found or unauthorized" };
  }

  // Verify volunteer has an approved interest in this department
  const { data: interest } = await supabase
    .from("volunteer_interests")
    .select("id")
    .eq("volunteer_id", volunteerId)
    .eq("department_id", deptId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();
  if (!interest) {
    return { error: "This volunteer does not have an approved interest in this department" };
  }

  const { error } = await supabase.from("assignments").insert({
    event_id: eventId,
    department_id: deptId,
    sub_team_id: subTeamId ?? null,
    volunteer_id: volunteerId,
    role,
    status: "invited",
    created_by: session.profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "This volunteer is already assigned in this department for this event" };
    }
    return { error: "Failed to create assignment. Please try again." };
  }

  revalidatePath(rosterPath(eventId, deptId));
  return { success: true };
}

/**
 * updateAssignment
 * Dept_head: update role and/or sub-team placement for an assignment in an owned dept.
 * Sub_leader: update role (not to dept_head) and/or sub-team in an owned sub-team.
 */
export async function updateAssignment(
  assignmentId: string,
  updates: { role?: AssignmentRole; subTeamId?: string | null },
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const callerRole = session.profile.role;
  if (callerRole !== "dept_head" && callerRole !== "sub_leader") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch the assignment
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, event_id, department_id, sub_team_id, deleted_at")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.deleted_at !== null) {
    return { error: "Assignment not found" };
  }

  if (callerRole === "dept_head") {
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", assignment.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!dept) return { error: "Unauthorized" };

    // If updating sub-team, verify it belongs to this dept
    if (updates.subTeamId) {
      const { data: st } = await supabase
        .from("sub_teams")
        .select("id")
        .eq("id", updates.subTeamId)
        .eq("department_id", assignment.department_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!st) return { error: "Sub-team not found or does not belong to this department" };
    }
  } else {
    // sub_leader
    if (updates.role === "dept_head") {
      return { error: "Sub-leaders cannot assign the dept_head role" };
    }
    if (!assignment.sub_team_id) {
      return { error: "Unauthorized" };
    }
    const { data: st } = await supabase
      .from("sub_teams")
      .select("id")
      .eq("id", assignment.sub_team_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!st) return { error: "Unauthorized" };
  }

  const patch: Record<string, unknown> = {};
  if (updates.role !== undefined) patch.role = updates.role;
  if (updates.subTeamId !== undefined) patch.sub_team_id = updates.subTeamId;

  const { error } = await supabase
    .from("assignments")
    .update(patch)
    .eq("id", assignmentId);

  if (error) {
    return { error: "Failed to update assignment. Please try again." };
  }

  revalidatePath(rosterPath(assignment.event_id, assignment.department_id));
  return { success: true };
}

/**
 * removeAssignment
 * Dept_head: soft-delete an assignment in an owned department.
 * Sub_leader: soft-delete an assignment in one of their owned sub-teams
 *   (sub_team_id must not be NULL).
 * Confirmation is enforced in the UI; this action performs the soft-delete
 * unconditionally once called.
 */
export async function removeAssignment(
  assignmentId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const callerRole = session.profile.role;
  if (callerRole !== "dept_head" && callerRole !== "sub_leader") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, event_id, department_id, sub_team_id, deleted_at")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignment || assignment.deleted_at !== null) {
    return { error: "Assignment not found" };
  }

  if (callerRole === "dept_head") {
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", assignment.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!dept) return { error: "Unauthorized" };
  } else {
    // sub_leader
    if (!assignment.sub_team_id) {
      return { error: "Unauthorized" };
    }
    const { data: st } = await supabase
      .from("sub_teams")
      .select("id")
      .eq("id", assignment.sub_team_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!st) return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignmentId);

  if (error) {
    return { error: "Failed to remove assignment. Please try again." };
  }

  revalidatePath(rosterPath(assignment.event_id, assignment.department_id));
  return { success: true };
}
