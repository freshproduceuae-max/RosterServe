import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import type { DepartmentWithTeams, Team, OwnerProfile, TeamHeadcountRequirement } from "./types";

export async function getAllDepartments(): Promise<DepartmentWithTeams[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("departments")
    .select("*, teams(*)")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error || !data) return [];

  return data.map((dept) => ({
    ...dept,
    teams: (dept.teams as Team[]).filter((t) => t.deleted_at === null),
  })) as DepartmentWithTeams[];
}

export async function getDepartmentById(
  id: string
): Promise<DepartmentWithTeams | null> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("departments")
    .select("*, teams(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    teams: (data.teams as Team[]).filter((t) => t.deleted_at === null),
  } as DepartmentWithTeams;
}

export async function getTeamById(id: string): Promise<Team | null> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single<Team>();

  if (error || !data) return null;
  return data;
}

export async function getTeamHeadcountRequirements(
  teamId: string
): Promise<TeamHeadcountRequirement[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("team_headcount_requirements")
    .select("*")
    .eq("team_id", teamId)
    .order("event_type", { ascending: true });

  if (error || !data) return [];
  return data as TeamHeadcountRequirement[];
}

export async function getProfilesByRole(
  role: "dept_head" | "team_head"
): Promise<OwnerProfile[]> {
  const session = await getSessionWithProfile();
  if (
    !session ||
    (!hasMinimumRole(session.profile.role, "super_admin") &&
      session.profile.role !== "dept_head")
  ) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("role", role)
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  if (error || !data) return [];
  return data as OwnerProfile[];
}

export async function getOwnerDisplayNames(
  ids: string[]
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};

  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return {};

  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids)
    .is("deleted_at", null);

  if (!data) return {};
  return Object.fromEntries(data.map((p) => [p.id, p.display_name as string]));
}
