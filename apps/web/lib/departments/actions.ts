"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createTeamSchema,
  updateTeamSchema,
  setHeadcountRequirementSchema,
} from "./schemas";

export type DepartmentActionResult = { error: string } | { success: true } | undefined;

async function verifyOwnerRole(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ownerId: string,
  expectedRole: "dept_head" | "team_head"
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", ownerId)
    .is("deleted_at", null)
    .single();
  return data?.role === expectedRole;
}

// ============================================================
// DEPARTMENT ACTIONS (super_admin only)
// ============================================================

export async function createDepartment(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !hasMinimumRole(session.profile.role, "super_admin")) {
    return { error: "You do not have permission to create departments." };
  }

  const rawOwnerId = formData.get("ownerId");
  const parsed = createDepartmentSchema.safeParse({
    name: formData.get("name"),
    ownerId: rawOwnerId || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.ownerId) {
    const validOwner = await verifyOwnerRole(supabase, parsed.data.ownerId, "dept_head");
    if (!validOwner) {
      return { error: "The selected owner must be a Department Head." };
    }
  }

  const { data, error } = await supabase
    .from("departments")
    .insert({
      name: parsed.data.name,
      owner_id: parsed.data.ownerId || null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "This department could not be created. Please try again." };
  }

  redirect(`/departments/${data.id}`);
}

export async function updateDepartment(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !hasMinimumRole(session.profile.role, "super_admin")) {
    return { error: "You do not have permission to edit departments." };
  }

  const rawOwnerId = formData.get("ownerId");
  const parsed = updateDepartmentSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    ownerId: rawOwnerId || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.ownerId) {
    const validOwner = await verifyOwnerRole(supabase, parsed.data.ownerId, "dept_head");
    if (!validOwner) {
      return { error: "The selected owner must be a Department Head." };
    }
  }

  const { error } = await supabase
    .from("departments")
    .update({
      name: parsed.data.name,
      owner_id: parsed.data.ownerId || null,
    })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);

  if (error) {
    return { error: "This department could not be saved. Please try again." };
  }

  redirect(`/departments/${parsed.data.id}`);
}

export async function softDeleteDepartment(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !hasMinimumRole(session.profile.role, "super_admin")) {
    return { error: "You do not have permission to delete departments." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Invalid department." };
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  // Stamp teams first — if this fails, the department remains live and the
  // user can retry. Reversing the order avoids a state where the department
  // is hidden but its teams are still active with no recovery path.
  const { error: teamError } = await supabase
    .from("teams")
    .update({ deleted_at: now })
    .eq("department_id", id)
    .is("deleted_at", null);

  if (teamError) {
    return { error: "Could not delete department. Please try again." };
  }

  const { error: deptError } = await supabase
    .from("departments")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null);

  if (deptError) {
    return { error: "Could not delete department. Please try again." };
  }

  redirect("/departments");
}

// ============================================================
// TEAM ACTIONS (super_admin or owning dept_head)
// ============================================================

async function verifyDeptHeadOwnership(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  departmentId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("departments")
    .select("owner_id")
    .eq("id", departmentId)
    .is("deleted_at", null)
    .single();

  return data?.owner_id === userId;
}

export async function createTeam(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to create teams." };
  }

  const rawOwnerId = formData.get("ownerId");
  const rawRotation = formData.get("rotationLabel");
  const parsed = createTeamSchema.safeParse({
    departmentId: formData.get("departmentId"),
    name: formData.get("name"),
    rotationLabel: rawRotation || undefined,
    ownerId: rawOwnerId || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  if (isDeptHead) {
    const owns = await verifyDeptHeadOwnership(
      supabase,
      parsed.data.departmentId,
      session.user.id
    );
    if (!owns) {
      return { error: "You do not have permission to manage this department." };
    }
  }

  if (parsed.data.ownerId) {
    const validOwner = await verifyOwnerRole(supabase, parsed.data.ownerId, "team_head");
    if (!validOwner) {
      return { error: "The selected owner must be a Team Head." };
    }
  }

  const { error } = await supabase.from("teams").insert({
    department_id: parsed.data.departmentId,
    name: parsed.data.name,
    rotation_label: parsed.data.rotationLabel || null,
    owner_id: parsed.data.ownerId || null,
    created_by: session.user.id,
  });

  if (error) {
    return { error: "This team could not be created. Please try again." };
  }

  redirect(`/departments/${parsed.data.departmentId}`);
}

export async function updateTeam(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to edit teams." };
  }

  const rawOwnerId = formData.get("ownerId");
  const rawRotation = formData.get("rotationLabel");
  const parsed = updateTeamSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    rotationLabel: rawRotation || undefined,
    ownerId: rawOwnerId || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("teams")
    .select("department_id")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .single();

  if (!existing) return { error: "Team not found." };

  if (isDeptHead) {
    const owns = await verifyDeptHeadOwnership(
      supabase,
      existing.department_id,
      session.user.id
    );
    if (!owns) {
      return { error: "You do not have permission to manage this department." };
    }
  }

  if (parsed.data.ownerId) {
    const validOwner = await verifyOwnerRole(supabase, parsed.data.ownerId, "team_head");
    if (!validOwner) {
      return { error: "The selected owner must be a Team Head." };
    }
  }

  const { error } = await supabase
    .from("teams")
    .update({
      name: parsed.data.name,
      rotation_label: parsed.data.rotationLabel || null,
      owner_id: parsed.data.ownerId || null,
    })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);

  if (error) {
    return { error: "This team could not be saved. Please try again." };
  }

  redirect(`/departments/${existing.department_id}`);
}

export async function softDeleteTeam(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to delete teams." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Invalid team." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("teams")
    .select("department_id")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!existing) return { error: "Team not found." };

  if (isDeptHead) {
    const owns = await verifyDeptHeadOwnership(
      supabase,
      existing.department_id,
      session.user.id
    );
    if (!owns) {
      return { error: "You do not have permission to manage this department." };
    }
  }

  const { error } = await supabase
    .from("teams")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { error: "Could not delete team. Please try again." };
  }

  redirect(`/departments/${existing.department_id}`);
}

// ============================================================
// HEADCOUNT REQUIREMENT ACTIONS
// ============================================================

export async function setTeamHeadcountRequirement(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const role = session.profile.role;
  const canManage =
    hasMinimumRole(role, "super_admin") ||
    role === "dept_head" ||
    role === "all_depts_leader";

  if (!canManage) {
    return { error: "You do not have permission to set headcount requirements." };
  }

  const parsed = setHeadcountRequirementSchema.safeParse({
    teamId: formData.get("teamId"),
    eventType: formData.get("eventType"),
    requiredCount: Number(formData.get("requiredCount")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  // dept_head may only manage teams in departments they own
  if (role === "dept_head") {
    const { data: team } = await supabase
      .from("teams")
      .select("department_id")
      .eq("id", parsed.data.teamId)
      .is("deleted_at", null)
      .single();

    if (!team) return { error: "Team not found." };

    const owns = await verifyDeptHeadOwnership(supabase, team.department_id, session.user.id);
    if (!owns) return { error: "You do not have permission to manage this team." };
  }

  const { error } = await supabase
    .from("team_headcount_requirements")
    .upsert(
      {
        team_id: parsed.data.teamId,
        event_type: parsed.data.eventType,
        required_count: parsed.data.requiredCount,
        created_by: session.user.id,
      },
      { onConflict: "team_id,event_type" }
    );

  if (error) {
    return { error: "Could not save headcount requirement. Please try again." };
  }

  return { success: true };
}

export async function deleteTeamHeadcountRequirement(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const role = session.profile.role;
  const canManage =
    hasMinimumRole(role, "super_admin") ||
    role === "dept_head" ||
    role === "all_depts_leader";

  if (!canManage) {
    return { error: "You do not have permission to remove headcount requirements." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Invalid requirement." };
  }

  const supabase = await createSupabaseServerClient();

  // dept_head may only manage headcount reqs for teams in their own departments
  if (role === "dept_head") {
    const { data: req } = await supabase
      .from("team_headcount_requirements")
      .select("team_id")
      .eq("id", id)
      .single();

    if (!req) return { error: "Requirement not found." };

    const { data: team } = await supabase
      .from("teams")
      .select("department_id")
      .eq("id", req.team_id)
      .is("deleted_at", null)
      .single();

    if (!team) return { error: "Team not found." };

    const owns = await verifyDeptHeadOwnership(supabase, team.department_id, session.user.id);
    if (!owns) return { error: "You do not have permission to manage this team." };
  }

  const { error } = await supabase
    .from("team_headcount_requirements")
    .delete()
    .eq("id", id);

  if (error) {
    return { error: "Could not remove headcount requirement. Please try again." };
  }

  return { success: true };
}

// ============================================================
// RS-F016: ROTATION OVERRIDE ACTIONS
// ============================================================

export async function setRotationOverride(
  eventId: string,
  deptId: string,
  teamId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const role = session.profile.role;
  const isSuperAdmin = hasMinimumRole(role, "super_admin");
  const isDeptHead = role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to set rotation overrides." };
  }

  if (!eventId || !deptId || !teamId) {
    return { error: "Invalid parameters." };
  }

  const supabase = await createSupabaseServerClient();

  if (isDeptHead) {
    const owns = await verifyDeptHeadOwnership(supabase, deptId, session.user.id);
    if (!owns) {
      return { error: "You do not have permission to manage this department." };
    }
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, department_id, rotation_label")
    .eq("id", teamId)
    .eq("department_id", deptId)
    .is("deleted_at", null)
    .single();

  if (!team) {
    return { error: "Team not found in this department." };
  }

  if (!team.rotation_label) {
    return { error: "This team does not have a rotation label assigned." };
  }

  const { error } = await supabase
    .from("dept_rotation_overrides")
    .upsert(
      {
        event_id: eventId,
        department_id: deptId,
        team_id: teamId,
        is_manual: true,
        created_by: session.user.id,
        created_at: new Date().toISOString(),
      },
      { onConflict: "event_id,department_id" },
    );

  if (error) {
    return { error: "Could not save rotation override. Please try again." };
  }

  return { success: true };
}

export async function clearRotationOverride(
  eventId: string,
  deptId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const role = session.profile.role;
  const isSuperAdmin = hasMinimumRole(role, "super_admin");
  const isDeptHead = role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to clear rotation overrides." };
  }

  if (!eventId || !deptId) {
    return { error: "Invalid parameters." };
  }

  const supabase = await createSupabaseServerClient();

  if (isDeptHead) {
    const owns = await verifyDeptHeadOwnership(supabase, deptId, session.user.id);
    if (!owns) {
      return { error: "You do not have permission to manage this department." };
    }
  }

  const { error } = await supabase
    .from("dept_rotation_overrides")
    .delete()
    .eq("event_id", eventId)
    .eq("department_id", deptId);

  if (error) {
    return { error: "Could not clear rotation override. Please try again." };
  }

  return { success: true };
}
