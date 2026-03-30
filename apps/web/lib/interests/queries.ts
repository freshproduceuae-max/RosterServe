import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DepartmentForInterestSubmit,
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
    .select("*, departments!inner(name, events!inner(title))")
    .eq("volunteer_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  type RawRow = InterestRequest & {
    departments: { name: string; events: { title: string } };
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    department_name: row.departments.name,
    event_title: row.departments.events.title,
  }));
}

export async function getPendingInterestsForScope(): Promise<
  InterestWithVolunteer[]
> {
  const supabase = await createSupabaseServerClient();
  // RLS (migration 00008) automatically restricts rows to interests in the
  // caller's owned departments.
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

  const [deptRes, interestRes] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, events!inner(title)")
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("volunteer_interests")
      .select("department_id")
      .eq("volunteer_id", userId)
      .is("deleted_at", null),
  ]);

  if (deptRes.error || !deptRes.data) return [];

  const joinedIds = new Set(
    (interestRes.data ?? []).map((row) => row.department_id),
  );

  return (
    deptRes.data as unknown as Array<{
      id: string;
      name: string;
      events: { title: string };
    }>
  )
    .filter((d) => !joinedIds.has(d.id))
    .map((d) => ({
      id: d.id,
      name: d.name,
      event_title: d.events.title,
    }));
}
