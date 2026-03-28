import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import type { DepartmentWithSubTeams, SubTeam, OwnerProfile } from "./types";

export async function getDepartmentsByEventId(
  eventId: string
): Promise<DepartmentWithSubTeams[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("departments")
    .select("*, sub_teams(*)")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  // Filter out soft-deleted sub-teams (RLS handles visibility, but guard at query layer too)
  return data.map((dept) => ({
    ...dept,
    sub_teams: (dept.sub_teams as SubTeam[]).filter((st) => st.deleted_at === null),
  })) as DepartmentWithSubTeams[];
}

export async function getDepartmentById(
  id: string
): Promise<DepartmentWithSubTeams | null> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("departments")
    .select("*, sub_teams(*)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    sub_teams: (data.sub_teams as SubTeam[]).filter((st) => st.deleted_at === null),
  } as DepartmentWithSubTeams;
}

export async function getSubTeamById(id: string): Promise<SubTeam | null> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("sub_teams")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single<SubTeam>();

  if (error || !data) return null;
  return data;
}

export async function getProfilesByRole(
  role: "dept_head" | "sub_leader"
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

// Fetch display names for a specific set of profile IDs.
// Available to all leader roles — used for owner display in detail views,
// not for building owner-selection dropdowns.
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
