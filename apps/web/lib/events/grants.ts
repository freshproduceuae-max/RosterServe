"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import type { AppRole } from "@/lib/auth/types";

export type GrantableUser = {
  id: string;
  display_name: string;
  role: AppRole;
  can_create_events: boolean;
};

export type GrantActionResult = { error: string } | { success: true };

// Fetch all dept_head and team_head profiles for the grants management page.
// Requires super_admin — enforced by RLS ("Super admins can read all profiles").
export async function getGrantableUsers(): Promise<GrantableUser[]> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "super_admin") return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role, can_create_events")
    .in("role", ["dept_head", "team_head"])
    .is("deleted_at", null)
    .order("role")
    .order("display_name")
    .returns<GrantableUser[]>();

  if (error) return [];
  return data ?? [];
}

export async function grantEventCreation(
  _prev: GrantActionResult | undefined,
  formData: FormData
): Promise<GrantActionResult> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "super_admin") {
    return { error: "Only Super Admins can grant event creation access." };
  }

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    return { error: "Invalid user ID." };
  }

  const supabase = await createSupabaseServerClient();

  // Confirm target user is dept_head or team_head
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .is("deleted_at", null)
    .single();

  if (!target || !["dept_head", "team_head"].includes(target.role)) {
    return { error: "Event creation can only be granted to Dept Heads and Team Heads." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ can_create_events: true })
    .eq("id", userId);

  if (error) {
    return { error: "Could not grant access. Please try again." };
  }

  revalidatePath("/events/grants");
  return { success: true };
}

export async function revokeEventCreation(
  _prev: GrantActionResult | undefined,
  formData: FormData
): Promise<GrantActionResult> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "super_admin") {
    return { error: "Only Super Admins can revoke event creation access." };
  }

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId) {
    return { error: "Invalid user ID." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ can_create_events: false })
    .eq("id", userId);

  if (error) {
    return { error: "Could not revoke access. Please try again." };
  }

  revalidatePath("/events/grants");
  return { success: true };
}
