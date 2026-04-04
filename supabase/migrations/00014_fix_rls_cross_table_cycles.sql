-- Migration: 00014_fix_rls_cross_table_cycles.sql
--
-- After migration 00013 replaced direct `profiles` subqueries with
-- get_my_role(), a second recursion surface was exposed:
--
--   profiles policy (Leaders can read in-scope volunteer profiles)
--     → accesses volunteer_interests and departments in subqueries
--       → volunteer_interests RLS → departments (direct subquery, triggers departments RLS)
--       → departments RLS → sub_teams (direct subquery, triggers sub_teams RLS)
--         → sub_teams RLS → departments (triggers departments RLS again)
--           → "infinite recursion detected in policy for relation departments"
--
-- Root cycles:
--   departments ↔ sub_teams  (each side's RLS policies query the other)
--   volunteer_interests → departments  (while departments may be in RLS eval)
--
-- Fix: introduce SECURITY DEFINER helper functions that read sub_teams and
-- departments directly (bypassing RLS via SET row_security = off), then
-- rewrite the affected policies to call those helpers instead of inline
-- EXISTS subqueries on those tables.
--
-- Helpers introduced:
--   i_own_dept(dept_id)           — caller owns that active department
--   i_have_sub_team_in_dept(dept_id) — caller has an active sub_team there
--   dept_is_active(dept_id)       — department row is not soft-deleted
--
-- All policies that previously used inline EXISTS on departments or sub_teams
-- are replaced. Business logic is preserved exactly.

-- ============================================================
-- PART A: SECURITY DEFINER helpers
-- ============================================================

-- Returns TRUE if auth.uid() is the owner_id of an active department.
-- Used in: sub_teams policies, volunteer_interests policies.
CREATE OR REPLACE FUNCTION public.i_own_dept(p_dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments
    WHERE id = p_dept_id
      AND owner_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- Returns TRUE if auth.uid() owns any active sub_team in the given department.
-- Used in: departments "Sub leaders can read departments via sub-team ownership".
CREATE OR REPLACE FUNCTION public.i_have_sub_team_in_dept(p_dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sub_teams
    WHERE department_id = p_dept_id
      AND owner_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- Returns TRUE if the department exists and is not soft-deleted.
-- Used in: sub_teams "Sub leaders can read their sub teams" (parent-active check).
CREATE OR REPLACE FUNCTION public.dept_is_active(p_dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments
    WHERE id = p_dept_id AND deleted_at IS NULL
  );
$$;

-- ============================================================
-- KNOWN CONSTRAINT — availability_blockouts not patched here
-- ============================================================
-- The "Dept heads can read in-scope blockouts" and "Sub leaders can read
-- in-scope blockouts" policies (00007_availability_blockouts.sql) still use
-- direct inline JOINs to volunteer_interests, departments, and sub_teams.
-- These are NOT a current recursion risk because no profiles RLS policy
-- accesses availability_blockouts, so no chain from profiles evaluation
-- reaches blockouts.
-- If a future profiles policy or a profiles-adjacent policy ever accesses
-- blockouts, those two policies must be updated to use i_own_dept() and the
-- volunteer_interests EXISTS must use i_own_dept() as well.

-- ============================================================
-- PART B: departments — break departments ↔ sub_teams cycle
-- Replace the inline sub_teams EXISTS with i_have_sub_team_in_dept()
-- ============================================================

DROP POLICY IF EXISTS "Sub leaders can read departments via sub-team ownership" ON public.departments;
CREATE POLICY "Sub leaders can read departments via sub-team ownership"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.i_have_sub_team_in_dept(id)
    AND public.get_my_role() = 'sub_leader'
  );

-- ============================================================
-- PART C: sub_teams — replace inline departments EXISTS checks
-- ============================================================

DROP POLICY IF EXISTS "Dept heads can read sub teams in their departments" ON public.sub_teams;
CREATE POLICY "Dept heads can read sub teams in their departments"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.i_own_dept(department_id)
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Sub leaders can read their sub teams" ON public.sub_teams;
CREATE POLICY "Sub leaders can read their sub teams"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND owner_id = auth.uid()
    AND public.dept_is_active(department_id)
    AND public.get_my_role() = 'sub_leader'
  );

DROP POLICY IF EXISTS "Dept heads can create sub teams in their departments" ON public.sub_teams;
CREATE POLICY "Dept heads can create sub teams in their departments"
  ON public.sub_teams FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.i_own_dept(department_id)
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Dept heads can update sub teams in their departments" ON public.sub_teams;
CREATE POLICY "Dept heads can update sub teams in their departments"
  ON public.sub_teams FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.i_own_dept(department_id)
    AND public.get_my_role() = 'dept_head'
  )
  WITH CHECK (
    public.i_own_dept(department_id)
    AND public.get_my_role() = 'dept_head'
  );

-- ============================================================
-- PART D: volunteer_interests — replace inline departments EXISTS
-- Prevents the profiles → volunteer_interests → departments cycle
-- (volunteer_interests RLS may be evaluated while departments is
--  already in RLS evaluation from the same profiles policy subquery)
-- ============================================================

DROP POLICY IF EXISTS "Dept heads can read in-scope interests" ON public.volunteer_interests;
CREATE POLICY "Dept heads can read in-scope interests"
  ON public.volunteer_interests FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

DROP POLICY IF EXISTS "Dept heads can review in-scope interests" ON public.volunteer_interests;
CREATE POLICY "Dept heads can review in-scope interests"
  ON public.volunteer_interests FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  )
  WITH CHECK (
    public.i_own_dept(department_id)
    AND status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
  );
