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

  type BlockoutRow = AvailabilityBlockout & { profiles: { display_name: string } };
  const rows = data as unknown as BlockoutRow[];

  const mapRow = (row: BlockoutRow): BlockoutWithVolunteer => ({
    ...row,
    display_name: row.profiles.display_name,
    department_name: "", // populated by getVolunteersInScope join; left empty here
  });

  // Super admins see all blockouts — no interest-status filter needed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .single();

  if (profile?.role === "super_admin") {
    return rows.map(mapRow);
  }

  // Scoped roles (dept_head): filter out blockouts for volunteers with no active
  // (non-deleted, non-rejected) interest in a department owned by the caller.
  // RLS on volunteer_interests rows that were already rejected still grants
  // visibility via migration 00007, so we must exclude them explicitly here.
  const { data: interests } = await supabase
    .from("volunteer_interests")
    .select("volunteer_id")
    .is("deleted_at", null)
    .neq("status", "rejected");

  const validVolunteerIds = new Set((interests ?? []).map((i) => i.volunteer_id));

  return rows
    .filter((row) => validVolunteerIds.has(row.volunteer_id))
    .map(mapRow);
}

export async function getVolunteersInScope(): Promise<VolunteerInScope[]> {
  const supabase = await createSupabaseServerClient();
  // RLS on profiles (migration 00007) restricts rows to in-scope volunteers.
  // Join volunteer_interests → departments for department_name context.
  // Fetch status and deleted_at so we can filter out rejected/deleted interests client-side,
  // since Supabase JS does not support filtering nested relationship columns inline.
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, volunteer_interests(department_id, status, deleted_at, departments(name))")
    .eq("role", "volunteer")
    .is("deleted_at", null);
  if (error || !data) return [];

  type Row = {
    id: string;
    display_name: string;
    volunteer_interests: Array<{
      department_id: string;
      status: string;
      deleted_at: string | null;
      departments: { name: string } | null;
    }>;
  };

  const rows = data as unknown as Row[];
  const result: VolunteerInScope[] = [];
  for (const row of rows) {
    // Only include interests that are active (not deleted) and not rejected
    const interests = (row.volunteer_interests ?? []).filter(
      (vi) => vi.deleted_at === null && vi.status !== "rejected"
    );
    if (interests.length === 0) continue; // volunteer has no in-scope interests
    for (const interest of interests) {
      result.push({
        id: row.id,
        display_name: row.display_name,
        department_name: interest.departments?.name ?? "",
      });
    }
  }
  return result;
}
