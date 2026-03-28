"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  availabilityPreferencesSchema,
  volunteerInterestsSchema,
  volunteerSkillsSchema,
} from "./schemas";

export type OnboardingActionResult = { error: string } | { success: true } | undefined;

// ============================================================
// STEP 1: AVAILABILITY PREFERENCES
// Upserts one row per volunteer (unique on volunteer_id).
// ============================================================

export async function saveAvailabilityPreferences(
  _prev: OnboardingActionResult,
  formData: FormData
): Promise<OnboardingActionResult> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "You do not have permission to complete this action." };
  }

  const parsed = availabilityPreferencesSchema.safeParse({
    preferred_days: formData.getAll("preferred_days"),
    preferred_times: formData.getAll("preferred_times"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("availability_preferences").upsert(
    {
      volunteer_id: session.user.id,
      preferred_days: parsed.data.preferred_days,
      preferred_times: parsed.data.preferred_times,
    },
    { onConflict: "volunteer_id" }
  );

  if (error) {
    return { error: "Could not save your availability. Please try again." };
  }

  return { success: true };
}

// ============================================================
// STEP 2: DEPARTMENT INTERESTS
// Delete-insert replacement. Empty selection = no interests saved.
// ============================================================

export async function saveVolunteerInterests(
  _prev: OnboardingActionResult,
  formData: FormData
): Promise<OnboardingActionResult> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "You do not have permission to complete this action." };
  }

  const parsed = volunteerInterestsSchema.safeParse({
    department_ids: formData.getAll("department_id"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  // Atomic replace: delete + insert run in one PostgreSQL transaction inside
  // replace_volunteer_interests(). An insert failure rolls back the delete,
  // so the volunteer's previous selections are never lost on error.
  // The function's INSERT policy also rejects department IDs that are not
  // active and on a published event.
  const { error } = await supabase.rpc("replace_volunteer_interests", {
    p_volunteer_id: session.user.id,
    p_department_ids: parsed.data.department_ids,
  });

  if (error) {
    return { error: "Could not save your interests. Please try again." };
  }

  return { success: true };
}

// ============================================================
// STEP 3 HELPER: PERSIST SKILLS (shared by save and finish)
// Append-only with dedupe: inserts only skills not already present
// (case-insensitive). Does NOT replace on re-submit.
// ============================================================

async function persistSkills(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  skills: string[]
): Promise<{ error: string } | null> {
  if (skills.length === 0) return null;

  // Dedupe within the submitted batch (case-insensitive) before hitting the DB.
  // Prevents inserting both "Guitar" and "guitar" from a single submission.
  const seenInBatch = new Set<string>();
  const batchDeduped = skills.filter((s) => {
    const lower = s.toLowerCase();
    if (seenInBatch.has(lower)) return false;
    seenInBatch.add(lower);
    return true;
  });

  const { data: existing } = await supabase
    .from("volunteer_skills")
    .select("name")
    .eq("volunteer_id", userId)
    .is("deleted_at", null);

  const existingNames = new Set(
    (existing ?? []).map((s) => (s.name as string).toLowerCase())
  );

  const newSkills = batchDeduped.filter((s) => !existingNames.has(s.toLowerCase()));

  if (newSkills.length > 0) {
    const { error } = await supabase.from("volunteer_skills").insert(
      newSkills.map((name) => ({
        volunteer_id: userId,
        name,
        status: "pending",
      }))
    );
    if (error) return { error: "Could not save your skills. Please try again." };
  }

  return null;
}

// ============================================================
// STEP 3A: SAVE SKILLS ONLY (incremental save, no redirect)
// Allows partial persistence before onboarding completion.
// Supports the "close browser mid-step and resume" requirement.
// ============================================================

export async function saveVolunteerSkills(
  _prev: OnboardingActionResult,
  formData: FormData
): Promise<OnboardingActionResult> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "You do not have permission to complete this action." };
  }

  const rawSkills = formData
    .getAll("skill")
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());

  const parsed = volunteerSkillsSchema.safeParse({ skills: rawSkills });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();
  const saveError = await persistSkills(supabase, session.user.id, parsed.data.skills);
  if (saveError) return saveError;

  return { success: true };
}

// ============================================================
// STEP 3B: FINISH ONBOARDING (saves skills + marks complete)
// Sets onboarding_complete = true (idempotent) then redirects.
// ============================================================

export async function finishOnboarding(
  _prev: OnboardingActionResult,
  formData: FormData
): Promise<OnboardingActionResult> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "You do not have permission to complete this action." };
  }

  const rawSkills = formData
    .getAll("skill")
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());

  const parsed = volunteerSkillsSchema.safeParse({ skills: rawSkills });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();

  const saveError = await persistSkills(supabase, session.user.id, parsed.data.skills);
  if (saveError) return saveError;

  // Set onboarding_complete = true (idempotent — safe to call multiple times)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", session.user.id);

  if (profileError) {
    return { error: "Could not complete your profile setup. Please try again." };
  }

  redirect("/dashboard");
}
