import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DepartmentForInterestSubmit,
  DeptTeam,
  InterestRequest,
  InterestWithDepartment,
  InterestWithVolunteer,
} from "./types";

export async function getMyInterests(
  userId: string,
): Promise<InterestWithDepartment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("volunteer_interests")
    .select("*, departments!inner(name)")
    .eq("volunteer_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  type RawRow = InterestRequest & { departments: { name: string } };
  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    department_name: row.departments.name,
  }));
}

export async function getPendingInterestsForScope(): Promise<
  InterestWithVolunteer[]
> {
  const supabase = await createSupabaseServerClient();
  // RLS (migration 00008) restricts rows to interests in the caller's owned departments.
  const { data, error } = await supabase
    .from("volunteer_interests")
    .select("*, volunteer:profiles!volunteer_id(display_name), departments!inner(name)")
    .is("deleted_at", null)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  type RawRow = InterestRequest & {
    volunteer: { display_name: string };
    departments: { name: string };
  };
  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    display_name: row.volunteer.display_name,
    department_name: row.departments.name,
  }));
}

export async function getAllInterests(): Promise<InterestWithVolunteer[]> {
  const supabase = await createSupabaseServerClient();
  // RLS restricts this query to super_admin callers only.
  const { data, error } = await supabase
    .from("volunteer_interests")
    .select("*, volunteer:profiles!volunteer_id(display_name), departments!inner(name)")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  type RawRow = InterestRequest & {
    volunteer: { display_name: string };
    departments: { name: string };
  };
  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    display_name: row.volunteer.display_name,
    department_name: row.departments.name,
  }));
}

export async function getDepartmentsAvailableToJoin(
  userId: string,
): Promise<DepartmentForInterestSubmit[]> {
  const supabase = await createSupabaseServerClient();

  const [deptRes, interestRes, membershipRes] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("volunteer_interests")
      .select("department_id")
      .eq("volunteer_id", userId)
      .is("deleted_at", null)
      .neq("status", "rejected"),
    supabase
      .from("department_members")
      .select("department_id")
      .eq("volunteer_id", userId)
      .is("deleted_at", null),
  ]);

  if (deptRes.error || !deptRes.data) return [];

  // Exclude departments with non-rejected active interests OR existing membership
  const excludedIds = new Set<string>([
    ...(interestRes.data ?? []).map((row) => row.department_id as string),
    ...(membershipRes.data ?? []).map((row) => row.department_id as string),
  ]);

  return (deptRes.data as Array<{ id: string; name: string }>)
    .filter((d) => !excludedIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.name }));
}

// Returns teams grouped by department_id — used to populate the approval team selector.
export async function getTeamsByDepartmentIds(
  departmentIds: string[],
): Promise<Record<string, DeptTeam[]>> {
  if (departmentIds.length === 0) return {};
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, department_id")
    .in("department_id", departmentIds)
    .is("deleted_at", null)
    .order("name");
  if (error || !data) return {};

  const map: Record<string, DeptTeam[]> = {};
  for (const row of data as Array<{ id: string; name: string; department_id: string }>) {
    map[row.department_id] = [...(map[row.department_id] ?? []), { id: row.id, name: row.name }];
  }
  return map;
}
