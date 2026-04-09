"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EntityKind = "department" | "event" | "team";

const TABLE_MAP: Record<EntityKind, string> = {
  department: "departments",
  event: "events",
  team: "teams",
};

export async function restoreRecord(
  kind: EntityKind,
  id: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Not authenticated" };
  if (session.profile.role !== "super_admin") {
    return { error: "Only super admins can restore records" };
  }

  const supabase = await createSupabaseServerClient();
  const table = TABLE_MAP[kind];

  const { error } = await supabase
    .from(table)
    .update({ deleted_at: null })
    .eq("id", id)
    .not("deleted_at", "is", null);

  if (error) return { error: `Failed to restore ${kind}` };

  revalidatePath("/admin");
  return { success: true };
}

export async function hardDeleteRecord(
  kind: EntityKind,
  id: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Not authenticated" };
  if (session.profile.role !== "super_admin") {
    return { error: "Only super admins can permanently delete records" };
  }

  const supabase = await createSupabaseServerClient();
  const table = TABLE_MAP[kind];

  const { error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null);

  if (error) return { error: `Failed to permanently delete ${kind}` };

  revalidatePath("/admin");
  return { success: true };
}

export async function assignSupporter(
  supporterId: string,
  leaderId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Not authenticated" };
  if (session.profile.role !== "super_admin") {
    return { error: "Only super admins can manage supporter assignments" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: supporter, error: supporterError } = await supabase
    .from("profiles")
    .select("id, role, deleted_at")
    .eq("id", supporterId)
    .single();

  if (supporterError || !supporter) {
    return { error: "Supporter profile not found" };
  }
  if (supporter.role !== "supporter") {
    return { error: "Profile is not a supporter" };
  }
  if (supporter.deleted_at !== null) {
    return { error: "Supporter profile is deleted" };
  }

  const { data: leader, error: leaderError } = await supabase
    .from("profiles")
    .select("id, role, deleted_at")
    .eq("id", leaderId)
    .single();

  if (leaderError || !leader) {
    return { error: "Leader profile not found" };
  }
  if (!["dept_head", "all_depts_leader", "team_head"].includes(leader.role)) {
    return { error: "Target profile is not a valid leader role" };
  }
  if (leader.deleted_at !== null) {
    return { error: "Leader profile is deleted" };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ supporter_of: leaderId })
    .eq("id", supporterId);

  if (updateError) return { error: "Failed to assign supporter" };

  revalidatePath("/admin");
  return { success: true };
}

export async function removeSupporter(
  supporterId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Not authenticated" };
  if (session.profile.role !== "super_admin") {
    return { error: "Only super admins can manage supporter assignments" };
  }

  const supabase = await createSupabaseServerClient();

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ supporter_of: null })
    .eq("id", supporterId)
    .eq("role", "supporter");

  if (updateError) return { error: "Failed to remove supporter assignment" };

  revalidatePath("/admin");
  return { success: true };
}
