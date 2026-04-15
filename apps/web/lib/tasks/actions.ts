"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createTaskSchema, updateTaskSchema } from "./schemas";

// ─── createTask ──────────────────────────────────────────────────────────────

export async function createTask(
  deptId: string,
  name: string,
  requiredSkillId?: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };
  if (session.profile.role !== "dept_head") return { error: "Unauthorized" };

  const supabase = await createSupabaseServerClient();

  // Verify dept ownership
  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("id", deptId)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!dept) return { error: "Department not found or unauthorized" };

  // Zod validation
  const parsed = createTaskSchema.safeParse({
    departmentId: deptId,
    name,
    requiredSkillId: requiredSkillId ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const skillId =
    parsed.data.requiredSkillId && parsed.data.requiredSkillId !== ""
      ? parsed.data.requiredSkillId
      : null;

  // If skill provided, verify it belongs to this dept
  if (skillId) {
    const { data: skill } = await supabase
      .from("department_skills")
      .select("id")
      .eq("id", skillId)
      .eq("department_id", deptId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!skill) return { error: "Skill not found in this department" };
  }

  const { error: insertError } = await supabase.from("department_tasks").insert({
    department_id: deptId,
    name: parsed.data.name,
    required_skill_id: skillId,
    created_by: session.profile.id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: "A task with this name already exists in this department" };
    }
    return { error: insertError.message };
  }

  revalidatePath("/departments/" + deptId);
  return { success: true };
}

// ─── updateTask ──────────────────────────────────────────────────────────────

export async function updateTask(
  taskId: string,
  name: string,
  requiredSkillId?: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };
  if (session.profile.role !== "dept_head") return { error: "Unauthorized" };

  const supabase = await createSupabaseServerClient();

  // Fetch task to verify existence and get dept
  const { data: task } = await supabase
    .from("department_tasks")
    .select("id, department_id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  // Ownership check
  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("id", task.department_id)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!dept) return { error: "Department not found or unauthorized" };

  // Zod validation
  const parsed = updateTaskSchema.safeParse({
    id: taskId,
    name,
    requiredSkillId: requiredSkillId ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const skillId =
    parsed.data.requiredSkillId && parsed.data.requiredSkillId !== ""
      ? parsed.data.requiredSkillId
      : null;

  // Verify skill belongs to same dept
  if (skillId) {
    const { data: skill } = await supabase
      .from("department_skills")
      .select("id")
      .eq("id", skillId)
      .eq("department_id", task.department_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!skill) return { error: "Skill not found in this department" };
  }

  const { error: updateError } = await supabase
    .from("department_tasks")
    .update({ name: parsed.data.name, required_skill_id: skillId })
    .eq("id", taskId)
    .is("deleted_at", null);

  if (updateError) {
    if (updateError.code === "23505") {
      return { error: "A task with this name already exists in this department" };
    }
    return { error: updateError.message };
  }

  revalidatePath("/departments/" + task.department_id);
  return { success: true };
}

// ─── deleteTask ──────────────────────────────────────────────────────────────

export async function deleteTask(
  taskId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };
  if (session.profile.role !== "dept_head") return { error: "Unauthorized" };

  const supabase = await createSupabaseServerClient();

  // Fetch task
  const { data: task } = await supabase
    .from("department_tasks")
    .select("id, department_id")
    .eq("id", taskId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) return { error: "Task not found" };

  // Ownership check
  const { data: dept } = await supabase
    .from("departments")
    .select("id")
    .eq("id", task.department_id)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!dept) return { error: "Department not found or unauthorized" };

  const now = new Date().toISOString();

  // Soft-delete event_task_assignments first (FK hard cascade does not fire on soft-delete)
  const { error: childError } = await supabase
    .from("event_task_assignments")
    .update({ deleted_at: now })
    .eq("task_id", taskId)
    .is("deleted_at", null);
  if (childError) return { error: childError.message };

  // Soft-delete the task
  const { error: taskError } = await supabase
    .from("department_tasks")
    .update({ deleted_at: now })
    .eq("id", taskId)
    .is("deleted_at", null);
  if (taskError) return { error: taskError.message };

  revalidatePath("/departments/" + task.department_id);
  return { success: true };
}

// ─── upsertEventTaskAssignment ───────────────────────────────────────────────

export async function upsertEventTaskAssignment(
  eventId: string,
  deptId: string,
  taskId: string,
  volunteerId: string | null,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const callerRole = session.profile.role;
  if (callerRole !== "dept_head" && callerRole !== "team_head") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  // Auth / ownership check
  if (callerRole === "dept_head") {
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", deptId)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!dept) return { error: "Department not found or unauthorized" };
  } else {
    // team_head: must own a team in this dept
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("department_id", deptId)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!team) return { error: "No owned team in this department" };
  }

  // Verify task belongs to dept and is not deleted
  const { data: task } = await supabase
    .from("department_tasks")
    .select("id")
    .eq("id", taskId)
    .eq("department_id", deptId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!task) return { error: "Task not found in this department" };

  // If assigning a volunteer, verify approved interest
  if (volunteerId) {
    const { data: interest } = await supabase
      .from("volunteer_interests")
      .select("id")
      .eq("volunteer_id", volunteerId)
      .eq("department_id", deptId)
      .eq("status", "approved")
      .is("deleted_at", null)
      .maybeSingle();
    if (!interest) return { error: "Volunteer does not have an approved interest in this department" };
  }

  // Fetch-then-write pattern to avoid partial-index upsert edge case
  const { data: existing } = await supabase
    .from("event_task_assignments")
    .select("id")
    .eq("event_id", eventId)
    .eq("task_id", taskId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from("event_task_assignments")
      .update({ volunteer_id: volunteerId })
      .eq("id", existing.id);
    if (updateError) return { error: updateError.message };
  } else {
    const { error: insertError } = await supabase
      .from("event_task_assignments")
      .insert({
        event_id: eventId,
        department_id: deptId,
        task_id: taskId,
        volunteer_id: volunteerId,
        created_by: session.profile.id,
      });
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/events/${eventId}/departments/${deptId}/roster`);
  return { success: true };
}

// ─── removeEventTaskAssignment ───────────────────────────────────────────────

export async function removeEventTaskAssignment(
  assignmentId: string,
  eventId: string,
  deptId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const callerRole = session.profile.role;
  if (callerRole !== "dept_head" && callerRole !== "team_head") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch assignment
  const { data: assignment } = await supabase
    .from("event_task_assignments")
    .select("id, department_id")
    .eq("id", assignmentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!assignment) return { error: "Assignment not found" };

  // Ownership check
  if (callerRole === "dept_head") {
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", assignment.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!dept) return { error: "Department not found or unauthorized" };
  } else {
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("department_id", assignment.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!team) return { error: "No owned team in this department" };
  }

  const { error: deleteError } = await supabase
    .from("event_task_assignments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (deleteError) return { error: deleteError.message };

  revalidatePath(`/events/${eventId}/departments/${deptId}/roster`);
  return { success: true };
}
