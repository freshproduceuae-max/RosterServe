import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  DepartmentSkill,
  SkillClaimWithDepartment,
  SkillClaimWithVolunteer,
  VolunteerSkillClaim,
} from "./types";

export type DepartmentSkillWithName = DepartmentSkill & {
  department_name: string;
};

/**
 * getDepartmentSkillsForLeader
 * Dept head: all active catalog entries for owned departments, with dept name.
 * RLS automatically restricts to the caller's owned departments.
 */
export async function getDepartmentSkillsForLeader(): Promise<
  DepartmentSkillWithName[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_skills")
    .select("*, department:departments!department_id(name)")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error || !data) return [];

  type RawRow = DepartmentSkill & { department: { name: string } | null };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    department_name: row.department?.name ?? "",
  }));
}

/**
 * getDepartmentSkillsForVolunteer
 * Volunteer: active catalog skills for departments where the volunteer has an
 * approved interest. Includes department name for claim form grouping.
 */
export async function getDepartmentSkillsForVolunteer(
  userId: string,
): Promise<DepartmentSkillWithName[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("department_skills")
    .select("*, department:departments!department_id(name)")
    .is("deleted_at", null)
    .in(
      "department_id",
      // Sub-select: departments where the volunteer has an approved interest
      (
        await supabase
          .from("volunteer_interests")
          .select("department_id")
          .eq("volunteer_id", userId)
          .eq("status", "approved")
          .is("deleted_at", null)
      ).data?.map((r) => r.department_id) ?? [],
    )
    .order("department_id", { ascending: true })
    .order("name", { ascending: true });
  if (error || !data) return [];

  type RawRow = DepartmentSkill & { department: { name: string } | null };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    department_name: row.department?.name ?? "",
  }));
}

/**
 * getMySkillClaims
 * Volunteer's own claims (deleted_at IS NULL), including legacy rows with no
 * catalog link. LEFT JOINs department_skills and departments for display names.
 */
export async function getMySkillClaims(
  userId: string,
): Promise<SkillClaimWithDepartment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("volunteer_skills")
    .select(
      "*, department_skill:department_skills!skill_id(name), department:departments!department_id(name)",
    )
    .eq("volunteer_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error || !data) return [];

  type RawRow = VolunteerSkillClaim & {
    department_skill: { name: string } | null;
    department: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    skill_name: row.department_skill?.name ?? null,
    department_name: row.department?.name ?? null,
  }));
}

/**
 * getSkillClaimsForScope
 * Dept head: all skill claims (deleted_at IS NULL, department_id IS NOT NULL)
 * in owned departments, with volunteer display name, skill name, and dept name.
 * Returns all statuses so the leader view can render pending + reviewed rows.
 * RLS automatically restricts to the caller's owned departments.
 */
export async function getSkillClaimsForScope(): Promise<
  SkillClaimWithVolunteer[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("volunteer_skills")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), department_skill:department_skills!skill_id(name), department:departments!department_id(name)",
    )
    .is("deleted_at", null)
    .not("department_id", "is", null)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  type RawRow = VolunteerSkillClaim & {
    volunteer: { display_name: string } | null;
    department_skill: { name: string } | null;
    department: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    volunteer_display_name: row.volunteer?.display_name ?? "Unknown",
    skill_name: row.department_skill?.name ?? row.name,
    department_name: row.department?.name ?? "Unknown",
  }));
}

/**
 * getAllSkillClaims
 * Super admin: all skill claims (deleted_at IS NULL, department_id IS NOT NULL).
 * RLS restricts this query to super_admin callers only.
 */
export async function getAllSkillClaims(): Promise<SkillClaimWithVolunteer[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("volunteer_skills")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), department_skill:department_skills!skill_id(name), department:departments!department_id(name)",
    )
    .is("deleted_at", null)
    .not("department_id", "is", null)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  type RawRow = VolunteerSkillClaim & {
    volunteer: { display_name: string } | null;
    department_skill: { name: string } | null;
    department: { name: string } | null;
  };

  return (data as unknown as RawRow[])
    .map((row) => ({
      ...row,
      volunteer_display_name: row.volunteer?.display_name ?? "Unknown",
      skill_name: row.department_skill?.name ?? row.name,
      department_name: row.department?.name ?? "Unknown",
    }))
    .sort((a, b) => {
      const dept = a.department_name.localeCompare(b.department_name);
      if (dept !== 0) return dept;
      return a.volunteer_display_name.localeCompare(b.volunteer_display_name);
    });
}

/**
 * getSkillClaimsForTeamHead
 * Team head: all skill claims (deleted_at IS NULL, department_id IS NOT NULL)
 * in departments where the caller owns at least one active team.
 * Returns all statuses so the team-head view can render pending + reviewed rows.
 * RLS policy "Team heads can read skill claims in departments with owned teams"
 * automatically restricts the result set.
 */
export async function getSkillClaimsForTeamHead(): Promise<
  SkillClaimWithVolunteer[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("volunteer_skills")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), department_skill:department_skills!skill_id(name), department:departments!department_id(name)",
    )
    .is("deleted_at", null)
    .not("department_id", "is", null)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  type RawRow = VolunteerSkillClaim & {
    volunteer: { display_name: string } | null;
    department_skill: { name: string } | null;
    department: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    volunteer_display_name: row.volunteer?.display_name ?? "Unknown",
    skill_name: row.department_skill?.name ?? row.name,
    department_name: row.department?.name ?? "Unknown",
  }));
}

/**
 * getAllActiveDepartments
 * Super admin / all_depts_leader: all active (non-deleted) departments.
 * Used to populate the department selector in the super admin skill creation form.
 */
export async function getAllActiveDepartments(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as { id: string; name: string }[];
}
