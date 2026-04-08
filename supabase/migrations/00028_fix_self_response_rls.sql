-- Migration: 00028_fix_self_response_rls.sql
-- Feature: RS-F008 — Tighten self-response UPDATE WITH CHECK
--
-- The previous self-response policy did not lock non-status columns.
-- This migration replaces it with a tighter version that uses a SECURITY DEFINER
-- helper to verify that event_id, department_id, role, and sub_team_id are
-- unchanged in the proposed UPDATE.

-- 1. SECURITY DEFINER helper — reads stored assignment columns bypassing RLS
CREATE OR REPLACE FUNCTION public.assignment_self_response_check(
  p_id          uuid,
  p_event_id    uuid,
  p_dept_id     uuid,
  p_role        text,
  p_sub_team_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.assignments
    WHERE  id             = p_id
      AND  event_id       = p_event_id
      AND  department_id  = p_dept_id
      AND  role           = p_role
      AND  (
        (sub_team_id IS NULL AND p_sub_team_id IS NULL)
        OR sub_team_id = p_sub_team_id
      )
  );
$$;

-- 2. Drop the old policy and recreate with tighter WITH CHECK
DROP POLICY IF EXISTS "Users can respond to their own service request" ON public.assignments;

CREATE POLICY "Users can respond to their own service request"
ON public.assignments
FOR UPDATE
TO authenticated
USING (
  deleted_at IS NULL
  AND volunteer_id = auth.uid()
  AND status = 'invited'
)
WITH CHECK (
  status        IN ('accepted', 'declined')
  AND volunteer_id = auth.uid()
  AND deleted_at   IS NULL
  AND public.assignment_self_response_check(id, event_id, department_id, role, sub_team_id)
);
