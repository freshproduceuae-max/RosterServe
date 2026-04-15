"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMinimumRole } from "@/lib/auth/roles";

// Update the team placement for an existing membership.
// Caller must be the dept_head who owns the department, or super_admin/all_depts_leader.
// RLS enforces scope; this action adds an application-level role guard.
export async function placeInTeam(
  memberId: string,
  teamId: string | null,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (
    !session ||
    (session.profile.role !== "dept_head" &&
      !hasMinimumRole(session.profile.role, "super_admin") &&
      session.profile.role !== "all_depts_leader")
  ) {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  if (session.profile.role === "dept_head") {
    const { data: owned } = await supabase
      .from("department_members")
      .select("id, departments!inner(owner_id)")
      .eq("id", memberId)
      .eq("departments.owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!owned) return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("department_members")
    .update({ team_id: teamId })
    .eq("id", memberId)
    .is("deleted_at", null);

  if (error) return { error: "Failed to update team placement. Please try again." };

  revalidatePath("/departments");
  return { success: true };
}

// Soft-delete a membership (removes the volunteer from the department permanently until re-approved).
// Caller must be the dept_head who owns the department, or super_admin/all_depts_leader.
export async function removeMembership(
  memberId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (
    !session ||
    (session.profile.role !== "dept_head" &&
      !hasMinimumRole(session.profile.role, "super_admin") &&
      session.profile.role !== "all_depts_leader")
  ) {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  if (session.profile.role === "dept_head") {
    const { data: owned } = await supabase
      .from("department_members")
      .select("id, departments!inner(owner_id)")
      .eq("id", memberId)
      .eq("departments.owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!owned) return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("department_members")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", memberId)
    .is("deleted_at", null);

  if (error) return { error: "Failed to remove member. Please try again." };

  revalidatePath("/departments");
  return { success: true };
}
