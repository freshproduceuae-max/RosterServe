-- Migration: 00017_fix_assignments_softdelete_rls.sql
--
-- Bug: soft-deleting an assignment (UPDATE SET deleted_at = now()) was blocked
-- with "new row violates row-level security policy for table assignments".
--
-- Root cause: PostgreSQL requires the new row to remain SELECT-visible after an
-- UPDATE (re-check). Every assignments SELECT policy included `deleted_at IS NULL`,
-- so after soft-delete the new row failed all SELECT re-checks and the UPDATE was
-- blocked.
--
-- Fix: drop `deleted_at IS NULL` from the dept_head and sub_leader SELECT policies
-- on assignments. The application layer already filters `deleted_at IS NULL` in
-- every query via `.is("deleted_at", null)` in lib/assignments/queries.ts, so
-- removing it from RLS does not expose soft-deleted rows to the UI.
--
-- The super_admin SELECT policy has never had a deleted_at filter (intentional —
-- admins can audit all rows). Volunteers reading their own assignments keep the
-- deleted_at IS NULL guard because they should not see removed assignments.
--
-- After this migration:
--   - Dept head / sub_leader queries still return only active rows because the
--     application layer applies .is("deleted_at", null).
--   - Soft-delete (UPDATE SET deleted_at = ...) now succeeds because the new row
--     remains SELECT-visible to the writer.

-- Dept heads: drop deleted_at IS NULL from SELECT
DROP POLICY IF EXISTS "Dept heads can read assignments in owned depts" ON public.assignments;
CREATE POLICY "Dept heads can read assignments in owned depts"
  ON public.assignments FOR SELECT
  USING (
    public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL
    )
  );

-- Sub-leaders: drop deleted_at IS NULL from SELECT
DROP POLICY IF EXISTS "Sub-leaders can read assignments in owned sub-teams" ON public.assignments;
CREATE POLICY "Sub-leaders can read assignments in owned sub-teams"
  ON public.assignments FOR SELECT
  USING (
    sub_team_id IS NOT NULL
    AND public.get_my_role() = 'sub_leader'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL
    )
  );
