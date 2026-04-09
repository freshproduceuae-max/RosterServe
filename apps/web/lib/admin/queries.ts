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
  const records = await getSoftDeletedRecords();
  return records.total;
}
