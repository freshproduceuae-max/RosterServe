"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMinimumRole } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// Role helpers (local)
// ---------------------------------------------------------------------------

function isElevated(role: AppRole): boolean {
  return role === "all_depts_leader" || hasMinimumRole(role, "super_admin");
}

// ---------------------------------------------------------------------------
// createDepartmentSkill
// dept_head: ownership check required.
// all_depts_leader / super_admin: no ownership check — RLS enforces scope.
// ---------------------------------------------------------------------------
export async function createDepartmentSkill(
  departmentId: string,
  name: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !elevated) return { error: "Unauthorized" };

  if (!departmentId || typeof departmentId !== "string") {
    return { error: "Invalid department" };
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: "Skill name is required" };
  }

  const supabase = await createSupabaseServerClient();

  if (isDeptHead) {
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

// ---------------------------------------------------------------------------
// bulkCreateSkills
// Elevated roles only (all_depts_leader, super_admin).
// Loops through names, inserts each, accumulates created/skipped counts.
// Duplicate (code 23505) is treated as skipped, not a fatal error.
// ---------------------------------------------------------------------------
export async function bulkCreateSkills(
  departmentId: string,
  names: string[],
): Promise<{ error?: string; created?: number; skipped?: number }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  if (!isElevated(role)) return { error: "Unauthorized" };

  if (!departmentId || typeof departmentId !== "string") {
    return { error: "Invalid department" };
  }
  if (!Array.isArray(names) || names.length === 0) {
    return { error: "No skill names provided" };
  }
  if (names.length > 200) {
    return { error: "Bulk upload is limited to 200 skills at a time." };
  }

  const trimmed = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && n.length <= 100);

  if (trimmed.length === 0) {
    return { error: "No valid skill names after trimming" };
  }

  const supabase = await createSupabaseServerClient();
  let created = 0;
  let skipped = 0;

  for (const name of trimmed) {
    const { error } = await supabase.from("department_skills").insert({
      department_id: departmentId,
      name,
      created_by: session.profile.id,
    });

    if (!error) {
      created++;
    } else if (error.code === "23505") {
      skipped++;
    } else {
      return {
        error: `Failed to insert "${name}": ${error.message}`,
        created,
        skipped,
      };
    }
  }

  revalidatePath("/skills");
  return { created, skipped };
}

// ---------------------------------------------------------------------------
// deleteDepartmentSkill
// dept_head: ownership check required.
// elevated: no ownership check — RLS handles it.
// ---------------------------------------------------------------------------
export async function deleteDepartmentSkill(
  skillId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !elevated) return { error: "Unauthorized" };

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (isDeptHead) {
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

// ---------------------------------------------------------------------------
// claimSkill — unchanged; volunteer-only.
// ---------------------------------------------------------------------------
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

  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id, name")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

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

// ---------------------------------------------------------------------------
// withdrawSkillClaim — unchanged; volunteer-only.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// approveSkillClaim
// dept_head: ownership check on the claim's department.
// team_head: no ownership check — RLS enforces scope via teams table.
// elevated (all_depts_leader, super_admin): no ownership check.
// ---------------------------------------------------------------------------
export async function approveSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const isTeamHead = role === "team_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !isTeamHead && !elevated) return { error: "Unauthorized" };

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

  if (isDeptHead) {
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
  }

  if (isTeamHead) {
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("department_id", existing.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!team) {
      return { error: "Unauthorized" };
    }
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

// ---------------------------------------------------------------------------
// rejectSkillClaim
// Same role guard pattern as approveSkillClaim.
// ---------------------------------------------------------------------------
export async function rejectSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const isTeamHead = role === "team_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !isTeamHead && !elevated) return { error: "Unauthorized" };

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

  if (isDeptHead) {
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
  }

  if (isTeamHead) {
    const { data: team } = await supabase
      .from("teams")
      .select("id")
      .eq("department_id", existing.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!team) {
      return { error: "Unauthorized" };
    }
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

// ---------------------------------------------------------------------------
// setSkillRequired
// dept_head: ownership check required.
// elevated: no ownership check — RLS handles.
// ---------------------------------------------------------------------------
export async function setSkillRequired(
  skillId: string,
  isRequired: boolean,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !elevated) return { error: "Unauthorized" };

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }
  if (typeof isRequired !== "boolean") {
    return { error: "isRequired must be a boolean" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (isDeptHead) {
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
  revalidatePath("/events", "layout");
  return { success: true };
}
