"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function submitInterest(
  departmentId: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  if (!departmentId || typeof departmentId !== "string") {
    return { error: "Invalid department" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("volunteer_interests").insert({
    volunteer_id: session.profile.id,
    department_id: departmentId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have an active interest for this department" };
    }
    return { error: "Failed to submit interest. Please try again." };
  }

  revalidatePath("/interests");
  return { success: true };
}

export async function withdrawInterest(
  interestId: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_interests")
    .select("id, volunteer_id, status, deleted_at")
    .eq("id", interestId)
    .maybeSingle();

  if (
    !existing ||
    existing.volunteer_id !== session.profile.id ||
    existing.deleted_at !== null
  ) {
    return { error: "Interest not found" };
  }

  if (existing.status !== "pending") {
    return { error: "Only pending interests can be withdrawn" };
  }

  const { error } = await supabase
    .from("volunteer_interests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", interestId);

  if (error) {
    return { error: "Failed to withdraw interest. Please try again." };
  }

  revalidatePath("/interests");
  return { success: true };
}

export async function approveInterest(
  interestId: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "dept_head") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_interests")
    .select("id, volunteer_id, department_id, status, deleted_at")
    .eq("id", interestId)
    .maybeSingle();

  if (!existing || existing.deleted_at !== null) {
    return { error: "Interest not found" };
  }

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
    .from("volunteer_interests")
    .update({
      status: "approved",
      reviewed_by: session.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", interestId);

  if (error) {
    return { error: "Failed to approve interest. Please try again." };
  }

  revalidatePath("/interests");
  return { success: true };
}

export async function rejectInterest(
  interestId: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "dept_head") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_interests")
    .select("id, volunteer_id, department_id, status, deleted_at")
    .eq("id", interestId)
    .maybeSingle();

  if (!existing || existing.deleted_at !== null) {
    return { error: "Interest not found" };
  }

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
    .from("volunteer_interests")
    .update({
      status: "rejected",
      reviewed_by: session.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", interestId);

  if (error) {
    return { error: "Failed to reject interest. Please try again." };
  }

  revalidatePath("/interests");
  return { success: true };
}
