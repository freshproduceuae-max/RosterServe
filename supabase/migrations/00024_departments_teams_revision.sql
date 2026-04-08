-- RS-F003 revision: rename sub_teams → teams, decouple departments from events,
-- add rotation_label and headcount requirements.
--
-- CRITICAL ORDER:
--   1. Drop all sub_teams policies (before rename, so DROP targets sub_teams)
--   2. Drop sub_teams triggers (before rename)
--   3. Rename table + indexes
--   4. Add rotation_label
--   5. Recreate triggers
--   6. Recreate teams policies (including volunteer policy from 00018)
--   7. Remove departments.event_id
--   8. Update events RLS
--   9a. Update i_have_sub_team_in_dept() to query teams
--   9. Update departments RLS
--   10. Create team_headcount_requirements
--   11. Update policies on other tables that joined sub_teams by name

-- ============================================================
-- STEP 1: Drop all sub_teams RLS policies (will be recreated for teams)
-- Also drop the volunteer policy from 00018 — Postgres keeps it on the renamed
-- table with the stale name; we drop and recreate with the correct name below.
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all sub teams" ON public.sub_teams;
DROP POLICY IF EXISTS "Dept heads can read sub teams in their departments" ON public.sub_teams;
DROP POLICY IF EXISTS "Team heads can read their sub teams" ON public.sub_teams;
DROP POLICY IF EXISTS "Super admins can create sub teams" ON public.sub_teams;
DROP POLICY IF EXISTS "Dept heads can create sub teams in their departments" ON public.sub_teams;
DROP POLICY IF EXISTS "Super admins can update active sub teams" ON public.sub_teams;
DROP POLICY IF EXISTS "Dept heads can update sub teams in their departments" ON public.sub_teams;
DROP POLICY IF EXISTS "Volunteers can read sub_teams for their assignments" ON public.sub_teams;

-- ============================================================
-- STEP 2: Drop triggers on sub_teams
-- ============================================================

DROP TRIGGER IF EXISTS set_sub_teams_updated_at ON public.sub_teams;
DROP TRIGGER IF EXISTS enforce_sub_team_owner_role ON public.sub_teams;

-- ============================================================
-- STEP 3: Rename table and indexes
-- PostgreSQL automatically updates FK constraints in dependent tables
-- (e.g. assignments.sub_team_id) to point to the renamed table.
-- ============================================================

ALTER TABLE public.sub_teams RENAME TO teams;

ALTER INDEX IF EXISTS idx_sub_teams_department_id RENAME TO idx_teams_department_id;
ALTER INDEX IF EXISTS idx_sub_teams_owner_id RENAME TO idx_teams_owner_id;
ALTER INDEX IF EXISTS idx_sub_teams_active RENAME TO idx_teams_active;

-- ============================================================
-- STEP 4: Add rotation_label to teams
-- ============================================================

ALTER TABLE public.teams
  ADD COLUMN rotation_label text CHECK (rotation_label IN ('A', 'B', 'C'));

-- ============================================================
-- STEP 5: Recreate triggers for teams
-- ============================================================

CREATE TRIGGER set_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Owner must be a team_head profile (function already updated in 00020)
CREATE TRIGGER enforce_team_owner_role
  BEFORE INSERT OR UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sub_team_owner_role();

-- ============================================================
-- STEP 6: Recreate RLS policies on teams
-- ============================================================

-- Super admin: full visibility including soft-deleted
CREATE POLICY "Super admins can read all teams"
  ON public.teams FOR SELECT
  USING (
    public.get_my_role() = 'super_admin'
  );

-- Dept head: see active teams in departments they own
CREATE POLICY "Dept heads can read teams in their departments"
  ON public.teams FOR SELECT
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

-- Team head: see active teams they own (guards parent dept is active)
CREATE POLICY "Team heads can read their teams"
  ON public.teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND owner_id = auth.uid()
    AND public.dept_is_active(department_id)
    AND public.get_my_role() = 'team_head'
  );

-- all_depts_leader: see all active teams
CREATE POLICY "All depts leaders can read all teams"
  ON public.teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- Super admin: create teams
CREATE POLICY "Super admins can create teams"
  ON public.teams FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND public.get_my_role() = 'super_admin'
  );

-- Dept head: create teams in departments they own
CREATE POLICY "Dept heads can create teams in their departments"
  ON public.teams FOR INSERT
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

-- Super admin: update active teams
CREATE POLICY "Super admins can update active teams"
  ON public.teams FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
  );

-- Dept head: update active teams in departments they own
CREATE POLICY "Dept heads can update teams in their departments"
  ON public.teams FOR UPDATE
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

-- Volunteer: read teams relevant to their assignments
-- Recreated from 00018 "Volunteers can read sub_teams for their assignments"
-- with corrected name after table rename.
CREATE POLICY "Volunteers can read teams for their assignments"
  ON public.teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.i_have_assignment_for_sub_team(id)
  );

-- ============================================================
-- STEP 7: Decouple departments from events
-- Departments are now org-level, not event-scoped.
-- ============================================================

-- Drop policies that reference departments.event_id BEFORE dropping the column.
-- These span multiple tables so we handle them here rather than in Steps 8/9.

-- events policies that join through departments.event_id (recreated in Step 8)
DROP POLICY IF EXISTS "Dept heads can read events with their departments" ON public.events;
DROP POLICY IF EXISTS "Team heads can read events with their sub teams" ON public.events;

-- volunteer_interests INSERT policy joins departments → events via event_id;
-- after decoupling, the check is just that the department is active.
DROP POLICY IF EXISTS "Volunteers can insert own interests for active departments" ON public.volunteer_interests;

CREATE POLICY "Volunteers can insert own interests for active departments"
  ON public.volunteer_interests FOR INSERT
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND EXISTS (
      SELECT 1
      FROM public.departments AS d
      WHERE d.id = department_id
        AND d.deleted_at IS NULL
    )
  );

ALTER TABLE public.departments
  DROP CONSTRAINT IF EXISTS departments_event_id_fkey;

ALTER TABLE public.departments
  DROP COLUMN IF EXISTS event_id;

DROP INDEX IF EXISTS idx_departments_event_id;
DROP INDEX IF EXISTS idx_departments_active;

CREATE INDEX idx_departments_active ON public.departments(owner_id) WHERE deleted_at IS NULL;

-- ============================================================
-- STEP 8: Update events RLS
-- Old policies were already dropped in Step 7 above.
-- dept_head and team_head now see all active non-deleted events.
-- ============================================================

-- (policies already dropped above)

CREATE POLICY "Dept heads can read active events"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
  );

CREATE POLICY "Team heads can read active events"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
  );

-- ============================================================
-- STEP 9a: Update i_have_sub_team_in_dept() to reference teams
-- The function body queries public.sub_teams by name (00014).
-- Must be updated before Step 9 which recreates the policy that calls it.
-- ============================================================

CREATE OR REPLACE FUNCTION public.i_have_sub_team_in_dept(p_dept_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams
    WHERE department_id = p_dept_id
      AND owner_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

-- ============================================================
-- STEP 9: Update departments RLS
-- Replace team_head via-sub_team policy; add all_depts_leader policy.
-- ============================================================

DROP POLICY IF EXISTS "Team heads can read departments via sub-team ownership" ON public.departments;

CREATE POLICY "Team heads can read their department"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = departments.id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "All depts leaders can read all departments" ON public.departments;

CREATE POLICY "All depts leaders can read all departments"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- STEP 10: team_headcount_requirements
-- ============================================================

CREATE TABLE public.team_headcount_requirements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        uuid NOT NULL REFERENCES public.teams(id),
  event_type     text NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 100),
  required_count int  NOT NULL CHECK (required_count >= 1),
  created_by     uuid NOT NULL REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, event_type)
);

CREATE INDEX idx_headcount_reqs_team_id ON public.team_headcount_requirements(team_id);

ALTER TABLE public.team_headcount_requirements ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_headcount_reqs_updated_at
  BEFORE UPDATE ON public.team_headcount_requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE POLICY "Super admins can manage headcount requirements"
  ON public.team_headcount_requirements FOR ALL
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

CREATE POLICY "Dept heads can manage headcount requirements"
  ON public.team_headcount_requirements FOR ALL
  USING (
    public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.departments d ON d.id = t.department_id
      WHERE t.id = team_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
        AND t.deleted_at IS NULL
    )
  )
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.departments d ON d.id = t.department_id
      WHERE t.id = team_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
        AND t.deleted_at IS NULL
    )
  );

CREATE POLICY "All depts leaders can manage headcount requirements"
  ON public.team_headcount_requirements FOR ALL
  USING (public.get_my_role() = 'all_depts_leader')
  WITH CHECK (public.get_my_role() = 'all_depts_leader');

CREATE POLICY "Team heads can read headcount requirements for their teams"
  ON public.team_headcount_requirements FOR SELECT
  USING (
    public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- ============================================================
-- STEP 11: Update policies on other tables that joined sub_teams by name
-- ============================================================

DROP POLICY IF EXISTS "Leaders can read in-scope volunteer profiles" ON public.profiles;

CREATE POLICY "Leaders can read in-scope volunteer profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'volunteer'
    AND deleted_at IS NULL
    AND public.get_my_role() IN ('dept_head', 'team_head')
    AND (
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        WHERE d.owner_id = auth.uid() AND d.deleted_at IS NULL
      )
      OR
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        JOIN public.teams t ON t.department_id = d.id
        WHERE t.owner_id = auth.uid() AND t.deleted_at IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "Team heads can read in-scope blockouts" ON public.availability_blockouts;

CREATE POLICY "Team heads can read in-scope blockouts"
  ON public.availability_blockouts FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND volunteer_id IN (
      SELECT vi.volunteer_id
      FROM public.volunteer_interests vi
      JOIN public.departments d ON d.id = vi.department_id
      JOIN public.teams t ON t.department_id = d.id
      WHERE t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Team heads can read skills for owned sub-team departments" ON public.department_skills;

CREATE POLICY "Team heads can read skills for owned team departments"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = department_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Team heads can read approved skills in owned sub-team departments" ON public.volunteer_skills;

CREATE POLICY "Team heads can read approved skills in owned team departments"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'approved'
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = volunteer_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Team heads can read assignments in owned sub-teams" ON public.assignments;

CREATE POLICY "Team heads can read assignments in owned teams"
  ON public.assignments FOR SELECT
  USING (
    sub_team_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = sub_team_id AND t.owner_id = auth.uid() AND t.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Team heads can insert assignments in owned sub-teams" ON public.assignments;

CREATE POLICY "Team heads can insert assignments in owned teams"
  ON public.assignments FOR INSERT
  WITH CHECK (
    sub_team_id IS NOT NULL
    AND role IN ('volunteer', 'team_head')
    AND status = 'invited'
    AND created_by = auth.uid()
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = sub_team_id
        AND t.department_id = department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Team heads can update assignments in owned sub-teams" ON public.assignments;

CREATE POLICY "Team heads can update assignments in owned teams"
  ON public.assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND sub_team_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = sub_team_id
        AND t.department_id = department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  )
  WITH CHECK (
    sub_team_id IS NOT NULL
    AND role IN ('volunteer', 'team_head')
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = sub_team_id
        AND t.department_id = department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- NOTE: There is no public.skill_requirements table in this codebase.
-- Migration 00012 only adds an is_required column to department_skills.
-- No policy update needed here for skill_requirements.
