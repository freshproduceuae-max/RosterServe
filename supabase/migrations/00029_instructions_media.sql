-- ============================================================
-- RS-F011: Instructions and media sharing
-- ============================================================

-- 1. Table -------------------------------------------------------

CREATE TABLE public.event_instructions (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id         uuid        NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  -- NULL = department-level; set = team-specific
  team_id               uuid        REFERENCES public.teams(id) ON DELETE CASCADE,
  title                 text        NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 200),
  body                  text        CHECK (char_length(body) <= 2000),
  -- Optional single attachment (stored in Supabase Storage bucket "instruction-media")
  attachment_path       text,       -- storage object path, e.g. {dept_id}/{instruction_id}/{uuid}-{filename}
  attachment_name       text,       -- original filename for display
  attachment_type       text,       -- MIME type
  attachment_size_bytes bigint,
  created_by            uuid        NOT NULL REFERENCES public.profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE INDEX idx_event_instructions_event_dept
  ON public.event_instructions(event_id, department_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.event_instructions ENABLE ROW LEVEL SECURITY;

-- 2. RLS policies ------------------------------------------------

-- super_admin and all_depts_leader: full read
CREATE POLICY "leaders_read_all_instructions"
  ON public.event_instructions FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() IN ('super_admin', 'all_depts_leader')
  );

-- dept_head: read instructions for owned departments
CREATE POLICY "dept_head_read_own_dept_instructions"
  ON public.event_instructions FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = event_instructions.department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- team_head: read instructions for departments where they own a team
-- (they see dept-level and their team's instructions)
CREATE POLICY "team_head_read_dept_instructions"
  ON public.event_instructions FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = event_instructions.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- volunteer and supporter: read instructions for departments/teams
-- where they have a non-declined assignment in the same event
CREATE POLICY "volunteer_read_relevant_instructions"
  ON public.event_instructions FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() IN ('volunteer', 'supporter')
    AND (
      -- Dept-level instruction: volunteer has assignment in this dept+event
      (
        team_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.assignments a
          WHERE a.volunteer_id = auth.uid()
            AND a.department_id = event_instructions.department_id
            AND a.event_id = event_instructions.event_id
            AND a.status != 'declined'
            AND a.deleted_at IS NULL
        )
      )
      OR
      -- Team-level instruction: volunteer has assignment in this team+event
      (
        team_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.assignments a
          WHERE a.volunteer_id = auth.uid()
            AND a.sub_team_id = event_instructions.team_id
            AND a.event_id = event_instructions.event_id
            AND a.status != 'declined'
            AND a.deleted_at IS NULL
        )
      )
    )
  );

-- super_admin and all_depts_leader: insert anywhere
CREATE POLICY "leaders_insert_instructions"
  ON public.event_instructions FOR INSERT
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'all_depts_leader')
    AND created_by = auth.uid()
  );

-- dept_head: insert for owned departments
CREATE POLICY "dept_head_insert_instructions"
  ON public.event_instructions FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- team_head: insert for their own teams only (team_id must be set)
CREATE POLICY "team_head_insert_instructions"
  ON public.event_instructions FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'team_head'
    AND created_by = auth.uid()
    AND team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- Soft-delete (UPDATE deleted_at): creator, dept_head owning the dept, or admin roles
CREATE POLICY "can_soft_delete_instruction"
  ON public.event_instructions FOR UPDATE
  USING (
    created_by = auth.uid()
    OR public.get_my_role() IN ('super_admin', 'all_depts_leader')
    OR (
      public.get_my_role() = 'dept_head'
      AND EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = event_instructions.department_id
          AND d.owner_id = auth.uid()
          AND d.deleted_at IS NULL
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.get_my_role() IN ('super_admin', 'all_depts_leader')
    OR (
      public.get_my_role() = 'dept_head'
      AND EXISTS (
        SELECT 1 FROM public.departments d
        WHERE d.id = event_instructions.department_id
          AND d.owner_id = auth.uid()
          AND d.deleted_at IS NULL
      )
    )
  );

-- 3. Supabase Storage bucket ------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instruction-media',
  'instruction-media',
  false,           -- private bucket; access via signed URLs only
  26214400,        -- 25 MB per file
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to instruction-media
-- Ownership checks are enforced at the server-action level before upload
CREATE POLICY "auth_upload_instruction_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'instruction-media');

-- Allow authenticated users to generate signed URLs (SELECT on storage.objects)
CREATE POLICY "auth_read_instruction_media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'instruction-media');

-- Allow authenticated users to delete from instruction-media
CREATE POLICY "auth_delete_instruction_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'instruction-media');
