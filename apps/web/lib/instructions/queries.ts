import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EventInstruction } from "./types";

export async function getInstructionsForDept(
  eventId: string,
  deptId: string,
): Promise<EventInstruction[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("event_instructions")
    .select(
      `id, event_id, department_id, team_id, title, body,
       attachment_path, attachment_name, attachment_type, attachment_size_bytes,
       created_by, created_at,
       profiles!created_by(display_name),
       teams!team_id(name)`,
    )
    .eq("event_id", eventId)
    .eq("department_id", deptId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  type RawRow = {
    id: string;
    event_id: string;
    department_id: string;
    team_id: string | null;
    title: string;
    body: string | null;
    attachment_path: string | null;
    attachment_name: string | null;
    attachment_type: string | null;
    attachment_size_bytes: number | null;
    created_by: string;
    created_at: string;
    profiles: { display_name: string } | null;
    teams: { name: string } | null;
  };

  const rows = (data ?? []) as unknown as RawRow[];

  // Generate signed URLs for rows that have an attachment
  const instructions: EventInstruction[] = await Promise.all(
    rows.map(async (row) => {
      let signedUrl: string | null = null;
      if (row.attachment_path) {
        const { data: signed } = await supabase.storage
          .from("instruction-media")
          .createSignedUrl(row.attachment_path, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        id: row.id,
        event_id: row.event_id,
        department_id: row.department_id,
        team_id: row.team_id,
        title: row.title,
        body: row.body,
        attachment_path: row.attachment_path,
        attachment_name: row.attachment_name,
        attachment_type: row.attachment_type,
        attachment_size_bytes: row.attachment_size_bytes,
        attachment_signed_url: signedUrl,
        created_by: row.created_by,
        created_at: row.created_at,
        creator_name: row.profiles?.display_name ?? null,
        team_name: row.teams?.name ?? null,
      };
    }),
  );

  return instructions;
}
