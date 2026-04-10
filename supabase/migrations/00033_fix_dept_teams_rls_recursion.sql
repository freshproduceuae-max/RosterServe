-- Migration: 00033_fix_dept_teams_rls_recursion.sql
--
-- Migration 00024 renamed sub_teams → teams and updated i_have_sub_team_in_dept()
-- to query public.teams, but recreated the departments and teams RLS policies
-- with raw EXISTS subqueries instead of the SECURITY DEFINER helpers.
--
-- This reintroduced the departments ↔ teams cross-table RLS recursion cycle:
--
--   profiles "Leaders can read in-scope volunteer profiles"
--     → subquery JOINs public.departments AND public.teams
--       → departments RLS: "Team heads can read their department"
--           → raw EXISTS on public.teams → teams RLS applied
--             → teams "Dept heads can read teams in their departments"
--                 → raw EXISTS on public.departments → departments RLS applied
--                   → "infinite recursion detected in policy for relation departments"
--
-- Fix: replace raw EXISTS subqueries on the opposing table with the existing
-- SECURITY DEFINER helpers i_own_dept() and i_have_sub_team_in_dept(),
-- which bypass RLS via SET row_security = off.

-- ============================================================
-- PART A: departments — replace raw teams EXISTS with i_have_sub_team_in_dept()
-- ============================================================

DROP POLICY IF EXISTS "Team heads can read their department" ON public.departments;
CREATE POLICY "Team heads can read their department"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(id)
  );

-- ============================================================
-- PART B: teams — replace raw departments EXISTS with i_own_dept()
-- ============================================================

DROP POLICY IF EXISTS "Dept heads can read teams in their departments" ON public.teams;
CREATE POLICY "Dept heads can read teams in their departments"
  ON public.teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.i_own_dept(department_id)
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Dept heads can create teams in their departments" ON public.teams;
CREATE POLICY "Dept heads can create teams in their departments"
  ON public.teams FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.i_own_dept(department_id)
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Dept heads can update teams in their departments" ON public.teams;
CREATE POLICY "Dept heads can update teams in their departments"
  ON public.teams FOR UPDATE
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
-- PART C: team_headcount_requirements — replace raw JOIN with i_own_dept()
-- The "Dept heads can manage headcount requirements" policy joins teams and
-- departments inline; the departments JOIN triggers the same cycle.
-- ============================================================

DROP POLICY IF EXISTS "Dept heads can manage headcount requirements" ON public.team_headcount_requirements;
CREATE POLICY "Dept heads can manage headcount requirements"
  ON public.team_headcount_requirements FOR ALL
  USING (
    public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND public.i_own_dept(t.department_id)
        AND t.deleted_at IS NULL
    )
  )
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND public.i_own_dept(t.department_id)
        AND t.deleted_at IS NULL
    )
  );
