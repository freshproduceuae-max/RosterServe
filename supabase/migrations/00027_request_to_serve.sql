-- Migration: 00027_request_to_serve.sql
-- Feature: RS-F008 — Roster planning and request-to-serve flow
--
-- 1. Any authenticated user can respond to their own 'invited' assignment
--    (update status to 'accepted' or 'declined').
-- 2. all_depts_leader SELECT on assignments.

-- ============================================================
-- 1. Self-response UPDATE policy
-- ============================================================

CREATE POLICY "Users can respond to their own service request"
  ON public.assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND volunteer_id = auth.uid()
    AND status = 'invited'
  )
  WITH CHECK (
    status IN ('accepted', 'declined')
    AND volunteer_id = auth.uid()
    AND deleted_at IS NULL
  );

-- ============================================================
-- 2. all_depts_leader SELECT
-- ============================================================

CREATE POLICY "All depts leaders can read all assignments"
  ON public.assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );
