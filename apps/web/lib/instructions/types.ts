export type EventInstruction = {
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
  attachment_signed_url: string | null; // Generated server-side; null if no attachment
  created_by: string;
  created_at: string;
  creator_name: string | null;
  team_name: string | null;
};
