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
