"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInstructionSchema } from "./schemas";

export type InstructionActionResult = { error: string } | { success: true };

const LEADER_ROLES = [
  "dept_head",
  "team_head",
  "all_depts_leader",
  "super_admin",
] as const;

export async function createInstruction(
  eventId: string,
  deptId: string,
  formData: FormData,
): Promise<InstructionActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Not authenticated" };

  const { role, id: profileId } = session.profile;
  if (!LEADER_ROLES.includes(role as (typeof LEADER_ROLES)[number])) {
    return { error: "Not authorized to post instructions" };
  }

  const parsed = createInstructionSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    team_id: formData.get("team_id") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const teamId = parsed.data.team_id || null;

  // team_head must always specify a team_id (dept-level not allowed)
  if (role === "team_head" && !teamId) {
    return { error: "Team heads must select a team" };
  }

  const supabase = await createSupabaseServerClient();

  // Insert the instruction record first
  const { data: instruction, error: insertErr } = await supabase
    .from("event_instructions")
    .insert({
      event_id: eventId,
      department_id: deptId,
      team_id: teamId,
      title: parsed.data.title,
      body: parsed.data.body || null,
      created_by: profileId,
    })
    .select("id")
    .single();

  if (insertErr || !instruction) {
    return { error: "Failed to post instruction" };
  }

  // Handle optional file attachment
  const file = formData.get("attachment") as File | null;
  if (file && file.size > 0) {
    // Validate size (25 MB limit)
    if (file.size > 26214400) {
      // Instruction already created — soft-delete it and return error
      await supabase
        .from("event_instructions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", instruction.id);
      return { error: "File exceeds the 25 MB limit" };
    }

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${deptId}/${instruction.id}/${crypto.randomUUID()}-${sanitizedName}`;

    const { error: uploadErr } = await supabase.storage
      .from("instruction-media")
      .upload(filePath, file, { contentType: file.type });

    if (uploadErr) {
      // Instruction saved but upload failed; user can retry
      return {
        error:
          "Instruction posted but the file upload failed. Please delete and repost with the attachment.",
      };
    }

    // Persist attachment metadata on the instruction row
    await supabase
      .from("event_instructions")
      .update({
        attachment_path: filePath,
        attachment_name: file.name,
        attachment_type: file.type,
        attachment_size_bytes: file.size,
      })
      .eq("id", instruction.id);
  }

  revalidatePath(`/events/${eventId}/departments/${deptId}/instructions`);
  return { success: true };
}

export async function deleteInstruction(
  instructionId: string,
  eventId: string,
  deptId: string,
): Promise<InstructionActionResult> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Not authenticated" };

  const supabase = await createSupabaseServerClient();

  // Soft delete — RLS (can_soft_delete_instruction) enforces ownership
  const { error } = await supabase
    .from("event_instructions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", instructionId);

  if (error) return { error: "Failed to delete instruction" };

  revalidatePath(`/events/${eventId}/departments/${deptId}/instructions`);
  return { success: true };
}
