// RS-F003 review: these queries filter deleted_at IS NULL and delegate event
// visibility scoping entirely to RLS. After the 00003_departments migration,
// dept_head and team_head users only see events where they own a department or
// sub-team respectively — this is enforced at the database layer, not here.
// No application-layer changes are required.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole } from "@/lib/auth/roles";
import type { Event, EventStatus } from "./types";
import type { Department } from "@/lib/departments/types";

export type ForecastEvent = Event & {
  departmentCount: number;
};

export async function getEvents(filters?: {
  status?: EventStatus;
}): Promise<Event[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("events")
    .select("*")
    .is("deleted_at", null)
    .order("event_date", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query.returns<Event[]>();

  if (error) return [];
  return data ?? [];
}

export async function getEventById(id: string): Promise<Event | null> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return null;

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single<Event>();

  if (error || !data) return null;
  return data;
}

export async function getForecastEvents(limitDays: number = 84): Promise<ForecastEvent[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = new Date(Date.now() + limitDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Note: Supabase PostgREST does not support table(count) aggregate syntax in .select().
  // Fetch events first, then scope the department count query to those event IDs only.
  // This prevents an unbounded scan of all event_departments rows as the DB grows.
  const eventsResult = await supabase
    .from("events")
    .select("*")
    .eq("is_stub", true)
    .is("deleted_at", null)
    .gte("event_date", today)
    .lte("event_date", windowEnd)
    .order("event_date", { ascending: true });

  if (eventsResult.error || !eventsResult.data) return [];

  const stubIds = eventsResult.data.map((e: { id: string }) => e.id);

  const deptResult = stubIds.length > 0
    ? await supabase.from("event_departments").select("event_id").in("event_id", stubIds)
    : { data: [] as { event_id: string }[], error: null };

  const deptCountMap = (deptResult.data ?? []).reduce<Record<string, number>>(
    (acc, row) => { acc[row.event_id] = (acc[row.event_id] ?? 0) + 1; return acc; },
    {},
  );

  return (eventsResult.data as Event[]).map((e) => ({
    ...e,
    departmentCount: deptCountMap[e.id] ?? 0,
  }));
}

export async function getEventDepartments(eventId: string): Promise<Department[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("event_departments")
    .select("departments(*)")
    .eq("event_id", eventId);

  if (error || !data) return [];
  return (data as unknown as { departments: Department }[]).map((r) => r.departments);
}
