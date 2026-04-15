-- Migration: 00034_tighten_storage_rls.sql
--
-- Purpose: Replace the three permissive authenticated-only storage policies
-- created in 00029_instructions_media.sql with role-scoped policies that
-- enforce the same access boundaries as the event_instructions table RLS.
--
-- Changes:
--   DROP  auth_upload_instruction_media  (any authenticated user could INSERT)
--   DROP  auth_read_instruction_media    (any authenticated user could SELECT)
--   DROP  auth_delete_instruction_media  (any authenticated user could DELETE)
--
--   CREATE leaders_read_instruction_media   (SELECT for leader roles)
--   CREATE volunteer_read_instruction_media (SELECT for volunteer/supporter via assignment join)
--   CREATE leaders_upload_instruction_media (INSERT for leader roles)
--   CREATE leaders_delete_instruction_media (DELETE for leader roles)
--
-- attachment_path stores the storage object path relative to the bucket root
-- (e.g. {dept_id}/{instruction_id}/{uuid}-filename).
-- storage.objects.name holds the same path. Join by equality.

-- ============================================================
-- 1. Drop old permissive policies
-- ============================================================

DROP POLICY IF EXISTS "auth_upload_instruction_media" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_instruction_media"   ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_instruction_media" ON storage.objects;

-- ============================================================
-- 2. Create role-scoped policies
-- ============================================================

-- Leaders may read any file in the bucket
CREATE POLICY "leaders_read_instruction_media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'instruction-media'
    AND public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')
  );

-- Volunteers and supporters may read a file only when they hold a non-declined
-- assignment for the event+department that the instruction belongs to.
-- Join path: storage.objects.name = event_instructions.attachment_path
CREATE POLICY "volunteer_read_instruction_media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'instruction-media'
    AND public.get_my_role() IN ('volunteer', 'supporter')
    AND EXISTS (
      SELECT 1
      FROM public.event_instructions ei
      JOIN public.assignments a
        ON a.event_id = ei.event_id
        AND a.department_id = ei.department_id
      WHERE ei.attachment_path = storage.objects.name
        AND a.volunteer_id = auth.uid()
        AND a.status != 'declined'
        AND a.deleted_at IS NULL
        AND ei.deleted_at IS NULL
    )
  );

-- Only leaders may upload files to the bucket
CREATE POLICY "leaders_upload_instruction_media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'instruction-media'
    AND public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')
  );

-- Only leaders may delete files from the bucket
CREATE POLICY "leaders_delete_instruction_media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'instruction-media'
    AND public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')
  );
