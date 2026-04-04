-- Migration: 00013_fix_rls_indirect_recursion.sql
--
-- Root cause: Migration 00010 fixed the 3 direct profile→profile RLS policies
-- by introducing get_my_role() (SECURITY DEFINER). However, 33 policies across
-- 7 other tables still use EXISTS (SELECT 1 FROM profiles WHERE role = '...').
--
-- PostgreSQL detects infinite recursion when:
--   1. A query on `profiles` begins RLS evaluation.
--   2. A profiles policy accesses another table (e.g. departments, volunteer_interests).
--   3. That table's RLS policy still queries `profiles` directly.
--   4. profiles is already mid-evaluation → "infinite recursion detected".
--
-- Fix:
--   Part A — Patch get_my_role() with SET row_security = off so the inner
--             SELECT on profiles always bypasses RLS, regardless of call depth.
--   Part B — Drop and recreate every policy on non-profiles tables that uses
--             EXISTS (SELECT 1 FROM profiles WHERE role = '...'), replacing it
--             with public.get_my_role() = '<role>'.
-- All recreated policies preserve the original business logic exactly.

-- ============================================================
-- PART A: Patch get_my_role() — add SET row_security = off
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- ============================================================
-- PART B: availability_blockouts
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all blockouts" ON public.availability_blockouts;

CREATE POLICY "Super admins can read all blockouts"
  ON public.availability_blockouts FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- ============================================================
-- PART B: availability_preferences
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all availability" ON public.availability_preferences;

CREATE POLICY "Super admins can read all availability"
  ON public.availability_preferences FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- ============================================================
-- PART B: departments
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all departments" ON public.departments;
CREATE POLICY "Super admins can read all departments"
  ON public.departments FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Dept heads can read their departments" ON public.departments;
CREATE POLICY "Dept heads can read their departments"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND owner_id = auth.uid()
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Sub leaders can read departments via sub-team ownership" ON public.departments;
CREATE POLICY "Sub leaders can read departments via sub-team ownership"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.sub_teams AS st
      WHERE st.department_id = id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
    AND public.get_my_role() = 'sub_leader'
  );

DROP POLICY IF EXISTS "Super admins can create departments" ON public.departments;
CREATE POLICY "Super admins can create departments"
  ON public.departments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admins can update active departments" ON public.departments;
CREATE POLICY "Super admins can update active departments"
  ON public.departments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  )
  WITH CHECK (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Volunteers can read active departments for onboarding" ON public.departments;
CREATE POLICY "Volunteers can read active departments for onboarding"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'volunteer'
  );

-- ============================================================
-- PART B: sub_teams
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all sub teams" ON public.sub_teams;
CREATE POLICY "Super admins can read all sub teams"
  ON public.sub_teams FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Dept heads can read sub teams in their departments" ON public.sub_teams;
CREATE POLICY "Dept heads can read sub teams in their departments"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Sub leaders can read their sub teams" ON public.sub_teams;
CREATE POLICY "Sub leaders can read their sub teams"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'sub_leader'
  );

DROP POLICY IF EXISTS "Super admins can create sub teams" ON public.sub_teams;
CREATE POLICY "Super admins can create sub teams"
  ON public.sub_teams FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Dept heads can create sub teams in their departments" ON public.sub_teams;
CREATE POLICY "Dept heads can create sub teams in their departments"
  ON public.sub_teams FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Super admins can update active sub teams" ON public.sub_teams;
CREATE POLICY "Super admins can update active sub teams"
  ON public.sub_teams FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  )
  WITH CHECK (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Dept heads can update sub teams in their departments" ON public.sub_teams;
CREATE POLICY "Dept heads can update sub teams in their departments"
  ON public.sub_teams FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'dept_head'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'dept_head'
  );

-- ============================================================
-- PART B: events
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all events" ON public.events;
CREATE POLICY "Super admins can read all events"
  ON public.events FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Super admins can create events" ON public.events;
CREATE POLICY "Super admins can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_my_role() = 'super_admin'
  );

DROP POLICY IF EXISTS "Super admins can update active events" ON public.events;
CREATE POLICY "Super admins can update active events"
  ON public.events FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  )
  WITH CHECK (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Dept heads can read events with their departments" ON public.events;
CREATE POLICY "Dept heads can read events with their departments"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.event_id = id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'dept_head'
  );

DROP POLICY IF EXISTS "Sub leaders can read events with their sub teams" ON public.events;
CREATE POLICY "Sub leaders can read events with their sub teams"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.sub_teams AS st
      JOIN public.departments AS d ON d.id = st.department_id
      WHERE d.event_id = events.id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
        AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'sub_leader'
  );

DROP POLICY IF EXISTS "Volunteers can read published events for onboarding context" ON public.events;
CREATE POLICY "Volunteers can read published events for onboarding context"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'published'
    AND public.get_my_role() = 'volunteer'
  );

-- ============================================================
-- PART B: volunteer_interests
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all interests" ON public.volunteer_interests;
CREATE POLICY "Super admins can read all interests"
  ON public.volunteer_interests FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Dept heads can read in-scope interests" ON public.volunteer_interests;
CREATE POLICY "Dept heads can read in-scope interests"
  ON public.volunteer_interests FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Dept heads can review in-scope interests" ON public.volunteer_interests;
CREATE POLICY "Dept heads can review in-scope interests"
  ON public.volunteer_interests FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
  );

-- ============================================================
-- PART B: department_skills
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all department skills" ON public.department_skills;
CREATE POLICY "Super admins can read all department skills"
  ON public.department_skills FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Dept heads can read own department skills" ON public.department_skills;
CREATE POLICY "Dept heads can read own department skills"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Dept heads can insert department skills" ON public.department_skills;
CREATE POLICY "Dept heads can insert department skills"
  ON public.department_skills FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Dept heads can soft-delete own department skills" ON public.department_skills;
CREATE POLICY "Dept heads can soft-delete own department skills"
  ON public.department_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Sub-leaders can read skills for owned sub-team departments" ON public.department_skills;
CREATE POLICY "Sub-leaders can read skills for owned sub-team departments"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'sub_leader'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.department_id = department_skills.department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- ============================================================
-- PART B: volunteer_skills
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all skills" ON public.volunteer_skills;
CREATE POLICY "Super admins can read all skills"
  ON public.volunteer_skills FOR SELECT
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Dept heads can read in-scope skill claims" ON public.volunteer_skills;
CREATE POLICY "Dept heads can read in-scope skill claims"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Dept heads can review in-scope skill claims" ON public.volunteer_skills;
CREATE POLICY "Dept heads can review in-scope skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Sub-leaders can read approved skills in owned sub-team departments" ON public.volunteer_skills;
CREATE POLICY "Sub-leaders can read approved skills in owned sub-team departments"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'approved'
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'sub_leader'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.department_id = volunteer_skills.department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );
