// RS-F003 review: these queries filter deleted_at IS NULL and delegate event
// visibility scoping entirely to RLS. After the 00003_departments migration,
// dept_head and sub_leader users only see events where they own a department or
// sub-team respectively — this is enforced at the database layer, not here.
// No application-layer changes are required.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole } from "@/lib/auth/roles";
import type { Event, EventStatus } from "./types";

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
