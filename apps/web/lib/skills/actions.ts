"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * createDepartmentSkill
 * Dept head: add a new skill to their department's catalog.
 */
export async function createDepartmentSkill(
  departmentId: string,
  name: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "dept_head") {
    return { error: "Unauthorized" };
  }

  if (!departmentId || typeof departmentId !== "string") {
    return { error: "Invalid department" };
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: "Skill name is required" };
  }

  const supabase = await createSupabaseServerClient();

  // Verify ownership of the department
  const { data: department } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!department) {
    return { error: "Department not found or unauthorized" };
  }

  const { error } = await supabase.from("department_skills").insert({
    department_id: departmentId,
    name: name.trim(),
    created_by: session.profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A skill with this name already exists in this department",
      };
    }
    return { error: "Failed to create skill. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

/**
 * deleteDepartmentSkill
 * Dept head: soft-delete a catalog skill in an owned department.
 */
export async function deleteDepartmentSkill(
  skillId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "dept_head") {
    return { error: "Unauthorized" };
  }

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch skill to get department_id
  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Verify ownership of the department
  const { data: department } = await supabase
    .from("departments")
    .select("id")
    .eq("id", skill.department_id)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!department) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("department_skills")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", skillId);

  if (error) {
    return { error: "Failed to delete skill. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

/**
 * claimSkill
 * Volunteer: submit a pending claim for a catalog skill in a department
 * where they already have an approved interest.
 */
export async function claimSkill(
  skillId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch skill (must exist and not be soft-deleted)
  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id, name")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Verify volunteer has an approved interest in the skill's department
  const { data: interest } = await supabase
    .from("volunteer_interests")
    .select("id")
    .eq("volunteer_id", session.profile.id)
    .eq("department_id", skill.department_id)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();

  if (!interest) {
    return {
      error:
        "You must have an approved interest in this department before claiming a skill",
    };
  }

  const { error } = await supabase.from("volunteer_skills").insert({
    volunteer_id: session.profile.id,
    skill_id: skill.id,
    department_id: skill.department_id,
    name: skill.name,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You have already claimed this skill" };
    }
    return { error: "Failed to claim skill. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

/**
 * withdrawSkillClaim
 * Volunteer: soft-delete their own pending skill claim.
 */
export async function withdrawSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  if (!claimId || typeof claimId !== "string") {
    return { error: "Invalid claim" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_skills")
    .select("id, volunteer_id, status, deleted_at")
    .eq("id", claimId)
    .maybeSingle();

  if (
    !existing ||
    existing.volunteer_id !== session.profile.id ||
    existing.deleted_at !== null
  ) {
    return { error: "Skill claim not found" };
  }

  if (existing.status !== "pending") {
    return { error: "Only pending skill claims can be withdrawn" };
  }

  const { error } = await supabase
    .from("volunteer_skills")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", claimId);

  if (error) {
    return { error: "Failed to withdraw skill claim. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

/**
 * approveSkillClaim
 * Dept head: approve a pending skill claim in an owned department.
 */
export async function approveSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "dept_head") {
    return { error: "Unauthorized" };
  }

  if (!claimId || typeof claimId !== "string") {
    return { error: "Invalid claim" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_skills")
    .select("id, department_id, status, deleted_at")
    .eq("id", claimId)
    .maybeSingle();

  if (!existing || existing.deleted_at !== null) {
    return { error: "Skill claim not found" };
  }

  if (existing.status !== "pending") {
    return { error: "Only pending skill claims can be approved" };
  }

  // Verify ownership of the claim's department
  const { data: department } = await supabase
    .from("departments")
    .select("id")
    .eq("id", existing.department_id)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!department) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("volunteer_skills")
    .update({
      status: "approved",
      reviewed_by: session.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (error) {
    return { error: "Failed to approve skill claim. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

/**
 * rejectSkillClaim
 * Dept head: reject a pending skill claim in an owned department.
 */
export async function rejectSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "dept_head") {
    return { error: "Unauthorized" };
  }

  if (!claimId || typeof claimId !== "string") {
    return { error: "Invalid claim" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_skills")
    .select("id, department_id, status, deleted_at")
    .eq("id", claimId)
    .maybeSingle();

  if (!existing || existing.deleted_at !== null) {
    return { error: "Skill claim not found" };
  }

  if (existing.status !== "pending") {
    return { error: "Only pending skill claims can be rejected" };
  }

  // Verify ownership of the claim's department
  const { data: department } = await supabase
    .from("departments")
    .select("id")
    .eq("id", existing.department_id)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!department) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("volunteer_skills")
    .update({
      status: "rejected",
      reviewed_by: session.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (error) {
    return { error: "Failed to reject skill claim. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

/**
 * setSkillRequired
 * Dept head: mark or unmark a catalog skill as required for gap detection.
 */
export async function setSkillRequired(
  skillId: string,
  isRequired: boolean,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "dept_head") {
    return { error: "Unauthorized" };
  }

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }
  if (typeof isRequired !== "boolean") {
    return { error: "isRequired must be a boolean" };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch skill to get department_id
  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  // Verify ownership of the department
  const { data: department } = await supabase
    .from("departments")
    .select("id")
    .eq("id", skill.department_id)
    .eq("owner_id", session.profile.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!department) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("department_skills")
    .update({ is_required: isRequired })
    .eq("id", skillId)
    .is("deleted_at", null);

  if (error) {
    return { error: "Failed to update skill. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}
