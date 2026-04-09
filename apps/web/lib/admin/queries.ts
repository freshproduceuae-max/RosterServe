import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SoftDeletedEntity =
  | { kind: "department"; id: string; name: string; deletedAt: string }
  | { kind: "event"; id: string; name: string; deletedAt: string }
  | { kind: "team"; id: string; name: string; departmentName: string; deletedAt: string };

export interface SoftDeletedRecords {
  departments: Extract<SoftDeletedEntity, { kind: "department" }>[];
  events: Extract<SoftDeletedEntity, { kind: "event" }>[];
  teams: Extract<SoftDeletedEntity, { kind: "team" }>[];
  total: number;
}

export async function getSoftDeletedRecords(): Promise<SoftDeletedRecords> {
  const supabase = await createSupabaseServerClient();

  const [deptResult, eventResult, teamResult] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    supabase
      .from("events")
      .select("id, title, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),

    supabase
      .from("teams")
      .select("id, name, deleted_at, departments!inner(name)")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  const departments = (deptResult.data ?? []).map(
    (r: { id: string; name: string; deleted_at: string }) => ({
      kind: "department" as const,
      id: r.id,
      name: r.name,
      deletedAt: r.deleted_at,
    }),
  );

  const events = (eventResult.data ?? []).map(
    (r: { id: string; title: string; deleted_at: string }) => ({
      kind: "event" as const,
      id: r.id,
      name: r.title,
      deletedAt: r.deleted_at,
    }),
  );

  const teams = (teamResult.data ?? []).map(
    (r: { id: string; name: string; deleted_at: string; departments: { name: string }[] }) => ({
      kind: "team" as const,
      id: r.id,
      name: r.name,
      departmentName: r.departments[0]?.name ?? "",
      deletedAt: r.deleted_at,
    }),
  );

  return {
    departments,
    events,
    teams,
    total: departments.length + events.length + teams.length,
  };
}

export async function getSoftDeletedCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const [d, e, t] = await Promise.all([
    supabase
      .from("departments")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
    supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .not("deleted_at", "is", null),
  ]);
  return (d.count ?? 0) + (e.count ?? 0) + (t.count ?? 0);
}

export type SupporterAssignment = {
  supporterId: string;
  supporterName: string;
  assignedLeaderId: string | null;
  assignedLeaderName: string | null;
  assignedLeaderRole: string | null;
};

export type LeaderOption = {
  id: string;
  name: string;
  role: string;
};

export async function getSupporterAssignments(): Promise<SupporterAssignment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, supporter_of, leader:profiles!supporter_of(id, display_name, role)",
    )
    .eq("role", "supporter")
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  if (error || !data) return [];

  return data.map(
    (row: {
      id: string;
      display_name: string;
      supporter_of: string | null;
      leader: { id: string; display_name: string; role: string }[] | null;
    }) => {
      const leader = Array.isArray(row.leader) ? row.leader[0] ?? null : row.leader;
      return {
        supporterId: row.id,
        supporterName: row.display_name,
        assignedLeaderId: leader?.id ?? null,
        assignedLeaderName: leader?.display_name ?? null,
        assignedLeaderRole: leader?.role ?? null,
      };
    },
  );
}

export async function getLeaderProfiles(): Promise<LeaderOption[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .in("role", ["dept_head", "all_depts_leader", "team_head"])
    .is("deleted_at", null)
    .order("display_name", { ascending: true });

  if (error || !data) return [];

  return data.map(
    (row: { id: string; display_name: string; role: string }) => ({
      id: row.id,
      name: row.display_name,
      role: row.role,
    }),
  );
}
