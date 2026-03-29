import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AvailabilityBlockout, BlockoutWithVolunteer, VolunteerInScope } from "./types";

export async function getMyBlockouts(userId: string): Promise<AvailabilityBlockout[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("availability_blockouts")
    .select("*")
    .eq("volunteer_id", userId)
    .is("deleted_at", null)
    .order("date", { ascending: true });
  if (error || !data) return [];
  return data as AvailabilityBlockout[];
}

export async function getBlockoutsForScope(): Promise<BlockoutWithVolunteer[]> {
  const supabase = await createSupabaseServerClient();
  // RLS automatically scopes to the caller's accessible volunteer rows.
  // The profiles policy added in migration 00007 allows the join to return display_name.
  const { data, error } = await supabase
    .from("availability_blockouts")
    .select("*, profiles!inner(display_name)")
    .is("deleted_at", null)
    .order("date", { ascending: true });
  if (error || !data) return [];
  return (
    data as unknown as Array<AvailabilityBlockout & { profiles: { display_name: string } }>
  ).map((row) => ({
    ...row,
    display_name: row.profiles.display_name,
    department_name: "", // populated by getVolunteersInScope join; left empty here
  }));
}

export async function getVolunteersInScope(): Promise<VolunteerInScope[]> {
  const supabase = await createSupabaseServerClient();
  // RLS on profiles (migration 00007) restricts rows to in-scope volunteers.
  // Join volunteer_interests → departments for department_name context.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, volunteer_interests(department_id, departments(name))")
    .eq("role", "volunteer")
    .is("deleted_at", null);
  if (error || !data) return [];

  type Row = {
    id: string;
    display_name: string;
    volunteer_interests: Array<{
      department_id: string;
      departments: { name: string } | null;
    }>;
  };

  const rows = data as unknown as Row[];
  // Flatten: one entry per volunteer per department interest
  const result: VolunteerInScope[] = [];
  for (const row of rows) {
    const interests = row.volunteer_interests ?? [];
    if (interests.length === 0) {
      result.push({ id: row.id, display_name: row.display_name, department_name: "" });
    } else {
      for (const interest of interests) {
        result.push({
          id: row.id,
          display_name: row.display_name,
          department_name: interest.departments?.name ?? "",
        });
      }
    }
  }
  return result;
}
