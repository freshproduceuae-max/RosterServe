"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createSubTeamSchema,
  updateSubTeamSchema,
} from "./schemas";

export type DepartmentActionResult = { error: string } | { success: true } | undefined;

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
    eventId: formData.get("eventId"),
    name: formData.get("name"),
    ownerId: rawOwnerId || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("departments")
    .insert({
      event_id: parsed.data.eventId,
      name: parsed.data.name,
      owner_id: parsed.data.ownerId || null,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "This department could not be created. Please try again." };
  }

  redirect(`/events/${parsed.data.eventId}/departments/${data.id}`);
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

  // Fetch event_id for redirect
  const { data: existing, error: fetchError } = await supabase
    .from("departments")
    .select("event_id")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !existing) {
    return { error: "Department not found." };
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

  redirect(`/events/${existing.event_id}/departments/${parsed.data.id}`);
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
  const eventId = formData.get("eventId");
  if (typeof id !== "string" || !id || typeof eventId !== "string" || !eventId) {
    return { error: "Invalid department." };
  }

  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  // Soft-delete the department
  const { error: deptError } = await supabase
    .from("departments")
    .update({ deleted_at: now })
    .eq("id", id)
    .is("deleted_at", null);

  if (deptError) {
    return { error: "Could not delete department. Please try again." };
  }

  // Cascade: soft-delete all active sub-teams in this department
  const { error: subTeamError } = await supabase
    .from("sub_teams")
    .update({ deleted_at: now })
    .eq("department_id", id)
    .is("deleted_at", null);

  if (subTeamError) {
    // Department is already deleted; log and surface a partial-state warning
    return {
      error:
        "Department was deleted but some sub-teams could not be removed. Please contact your admin.",
    };
  }

  redirect(`/events/${eventId}`);
}

// ============================================================
// SUB-TEAM ACTIONS (super_admin or owning dept_head)
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

export async function createSubTeam(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to create sub-teams." };
  }

  const rawOwnerId = formData.get("ownerId");
  const parsed = createSubTeamSchema.safeParse({
    departmentId: formData.get("departmentId"),
    name: formData.get("name"),
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

  // Fetch event_id for redirect
  const { data: dept } = await supabase
    .from("departments")
    .select("event_id")
    .eq("id", parsed.data.departmentId)
    .is("deleted_at", null)
    .single();

  if (!dept) return { error: "Department not found." };

  const { error } = await supabase.from("sub_teams").insert({
    department_id: parsed.data.departmentId,
    name: parsed.data.name,
    owner_id: parsed.data.ownerId || null,
    created_by: session.user.id,
  });

  if (error) {
    return { error: "This sub-team could not be created. Please try again." };
  }

  redirect(`/events/${dept.event_id}/departments/${parsed.data.departmentId}`);
}

export async function updateSubTeam(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to edit sub-teams." };
  }

  const rawOwnerId = formData.get("ownerId");
  const parsed = updateSubTeamSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    ownerId: rawOwnerId || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch department_id and event_id for ownership check and redirect
  const { data: existing } = await supabase
    .from("sub_teams")
    .select("department_id, departments(event_id)")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .single();

  if (!existing) return { error: "Sub-team not found." };

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
    .from("sub_teams")
    .update({
      name: parsed.data.name,
      owner_id: parsed.data.ownerId || null,
    })
    .eq("id", parsed.data.id)
    .is("deleted_at", null);

  if (error) {
    return { error: "This sub-team could not be saved. Please try again." };
  }

  const eventId = (existing.departments as unknown as { event_id: string } | null)
    ?.event_id;
  redirect(`/events/${eventId}/departments/${existing.department_id}`);
}

export async function softDeleteSubTeam(
  _prev: DepartmentActionResult,
  formData: FormData
): Promise<DepartmentActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "You must be signed in." };

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    return { error: "You do not have permission to delete sub-teams." };
  }

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Invalid sub-team." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("sub_teams")
    .select("department_id, departments(event_id)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!existing) return { error: "Sub-team not found." };

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
    .from("sub_teams")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { error: "Could not delete sub-team. Please try again." };
  }

  const eventId = (existing.departments as unknown as { event_id: string } | null)
    ?.event_id;
  redirect(`/events/${eventId}/departments/${existing.department_id}`);
}
