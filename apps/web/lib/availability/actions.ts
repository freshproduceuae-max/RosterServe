"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBlockoutSchema } from "./schemas";

export async function addBlockout(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  const raw = {
    date: formData.get("date"),
    reason: formData.get("reason") || undefined,
  };

  const parsed = addBlockoutSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("availability_blockouts").insert({
    volunteer_id: session.profile.id,
    date: parsed.data.date,
    reason: parsed.data.reason ?? null,
  });

  if (error) {
    // Partial unique constraint violation means an active blockout exists for this date
    if (error.code === "23505") {
      return { error: "You already have a blockout on this date" };
    }
    return { error: "Failed to save blockout. Please try again." };
  }

  revalidatePath("/availability");
  return { success: true };
}

export async function removeBlockout(
  blockoutId: string
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  const supabase = await createSupabaseServerClient();

  // Verify the caller owns this blockout and it is still active
  const { data: existing } = await supabase
    .from("availability_blockouts")
    .select("id, volunteer_id, deleted_at")
    .eq("id", blockoutId)
    .maybeSingle();

  if (
    !existing ||
    existing.volunteer_id !== session.profile.id ||
    existing.deleted_at !== null
  ) {
    return { error: "Blockout not found" };
  }

  const { error } = await supabase
    .from("availability_blockouts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", blockoutId);

  if (error) {
    return { error: "Failed to remove blockout. Please try again." };
  }

  revalidatePath("/availability");
  return { success: true };
}
