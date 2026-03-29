import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DepartmentForInterests, OnboardingState, VolunteerInterest } from "./types";

export async function getActiveDepartmentsForInterests(): Promise<DepartmentForInterests[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("departments")
    .select("id, name, events!inner(title)")
    .is("deleted_at", null)
    .order("name");

  if (error || !data) return [];

  return (
    data as unknown as Array<{ id: string; name: string; events: { title: string } }>
  ).map((d) => ({
    id: d.id,
    name: d.name,
    event_title: d.events.title,
  }));
}

export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const supabase = await createSupabaseServerClient();

  const [availabilityRes, interestsRawRes, skillsRes] = await Promise.all([
    supabase
      .from("availability_preferences")
      .select("*")
      .eq("volunteer_id", userId)
      .maybeSingle(),
    supabase
      .from("volunteer_interests")
      .select("id, volunteer_id, department_id, created_at, departments!inner(deleted_at)")
      .eq("volunteer_id", userId),
    supabase
      .from("volunteer_skills")
      .select("*")
      .eq("volunteer_id", userId)
      .is("deleted_at", null)
      .order("created_at"),
  ]);

  // Filter out interests whose department has been soft-deleted
  const interests: VolunteerInterest[] = (
    (interestsRawRes.data ?? []) as unknown as Array<{
      id: string;
      volunteer_id: string;
      department_id: string;
      created_at: string;
      departments: { deleted_at: string | null };
    }>
  )
    .filter((row) => row.departments.deleted_at === null)
    .map((row) => ({
      id: row.id,
      volunteer_id: row.volunteer_id,
      department_id: row.department_id,
      created_at: row.created_at,
    }));

  return {
    availability: (availabilityRes.data as unknown as OnboardingState["availability"]) ?? null,
    interests,
    skills: (skillsRes.data as unknown as OnboardingState["skills"]) ?? [],
  };
}
