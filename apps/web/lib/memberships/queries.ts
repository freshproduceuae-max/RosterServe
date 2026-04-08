import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DepartmentMember, MemberWithDepartment, MemberWithProfile } from "./types";

// For the department detail page: all active members in a given department.
// RLS restricts rows to the caller's scope (dept_head: owned dept; all_depts_leader/super_admin: all).
export async function getDepartmentMembers(
  departmentId: string,
): Promise<MemberWithProfile[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_members")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), team:teams!team_id(name)",
    )
    .eq("department_id", departmentId)
    .is("deleted_at", null)
    .order("created_at");
  if (error || !data) return [];

  type RawRow = DepartmentMember & {
    volunteer: { display_name: string };
    team: { name: string } | null;
  };
  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    display_name: row.volunteer.display_name,
    team_name: row.team?.name ?? null,
  }));
}

// For the volunteer's interests page: all active memberships for a given volunteer.
export async function getMyMemberships(
  userId: string,
): Promise<MemberWithDepartment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_members")
    .select(
      "*, department:departments!department_id(name), team:teams!team_id(name)",
    )
    .eq("volunteer_id", userId)
    .is("deleted_at", null)
    .order("created_at");
  if (error || !data) return [];

  type RawRow = DepartmentMember & {
    department: { name: string };
    team: { name: string } | null;
  };
  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    department_name: row.department.name,
    team_name: row.team?.name ?? null,
  }));
}
