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

  // Delete all existing interests for this volunteer
  const { error: deleteError } = await supabase
    .from("volunteer_interests")
    .delete()
    .eq("volunteer_id", session.user.id);

  if (deleteError) {
    return { error: "Could not save your interests. Please try again." };
  }

  // Insert new set (may be empty if the user selected nothing)
  if (parsed.data.department_ids.length > 0) {
    const { error: insertError } = await supabase.from("volunteer_interests").insert(
      parsed.data.department_ids.map((department_id) => ({
        volunteer_id: session.user.id,
        department_id,
      }))
    );

    if (insertError) {
      return { error: "Could not save your interests. Please try again." };
    }
  }

  return { success: true };
}

// ============================================================
// STEP 3: SKILLS + COMPLETE ONBOARDING
// Append-only with dedupe: inserts only skills not already present
// (case-insensitive). Does NOT replace on re-submit.
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

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createSupabaseServerClient();

  if (parsed.data.skills.length > 0) {
    const { data: existing } = await supabase
      .from("volunteer_skills")
      .select("name")
      .eq("volunteer_id", session.user.id)
      .is("deleted_at", null);

    const existingNames = new Set(
      (existing ?? []).map((s) => (s.name as string).toLowerCase())
    );

    const newSkills = parsed.data.skills.filter(
      (s) => !existingNames.has(s.toLowerCase())
    );

    if (newSkills.length > 0) {
      const { error: skillsError } = await supabase.from("volunteer_skills").insert(
        newSkills.map((name) => ({
          volunteer_id: session.user.id,
          name,
          status: "pending",
        }))
      );

      if (skillsError) {
        return { error: "Could not save your skills. Please try again." };
      }
    }
  }

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
