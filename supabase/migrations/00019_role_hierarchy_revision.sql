-- RS-F001 revision: role hierarchy expansion
--
-- Adds three new roles (all_depts_leader, team_head, supporter) and renames
-- the existing sub_leader role to team_head. All RLS policies that reference
-- sub_leader are dropped and recreated with team_head substituted.
--
-- Revision is safe to run via `npx supabase db reset` — every DROP uses
-- IF EXISTS and every enum addition uses IF NOT EXISTS.

-- ============================================================
-- STEP 1: Add new enum values
-- PostgreSQL allows adding values to an existing enum but not removing them
-- directly. We add the three new values first so the column can accept them
-- before we migrate any rows.
-- ============================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'all_depts_leader' AFTER 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_head' AFTER 'dept_head';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supporter' AFTER 'team_head';

-- ============================================================
-- STEP 2: Migrate existing sub_leader rows to team_head
-- ============================================================

UPDATE public.profiles SET role = 'team_head' WHERE role = 'sub_leader';

-- ============================================================
-- STEP 3: Remove sub_leader from the enum
-- PostgreSQL does not support ALTER TYPE ... DROP VALUE. We create a clean
-- replacement enum, migrate the column, drop the old type, and rename.
-- Any SECURITY DEFINER function that returns app_role must be recreated
-- after this step (get_my_role is handled in Step 5).
-- ============================================================

CREATE TYPE public.app_role_v2 AS ENUM (
  'super_admin',
  'all_depts_leader',
  'dept_head',
  'team_head',
  'supporter',
  'volunteer'
);

ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.app_role_v2
  USING role::text::public.app_role_v2;

DROP TYPE public.app_role;
ALTER TYPE public.app_role_v2 RENAME TO app_role;

-- ============================================================
-- STEP 4: Add supporter_of column
-- Links a supporter to the one leader they are assigned to.
-- Nullable for all other roles. Used by RS-F018 (permission mirroring).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS supporter_of uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_supporter_of
  ON public.profiles(supporter_of)
  WHERE supporter_of IS NOT NULL;

-- ============================================================
-- STEP 5: Recreate get_my_role() after enum type swap
-- The function return type must be recreated so it references the new type.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;

-- ============================================================
-- STEP 6: Fix assignments CHECK constraint
-- The role column CHECK constraint still names sub_leader. Drop the
-- constraint and recreate it with team_head.
-- ============================================================

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_role_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_role_check
  CHECK (role IN ('volunteer', 'team_head', 'dept_head'));

-- ============================================================
-- STEP 7: Update enforce_sub_team_owner_role trigger function
-- The trigger validated that a sub_team's owner_id has role = 'sub_leader'.
-- Now it must validate role = 'team_head'.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_sub_team_owner_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.owner_id AND role = 'team_head' AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Sub-team owner must be a user with role team_head';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 8: Drop and recreate all RLS policies that referenced sub_leader
--
-- Each entry below uses the exact live policy name and the exact live USING /
-- WITH CHECK clause, with sub_leader replaced by team_head. Policies are
-- renamed where the policy name itself contained "Sub leaders" or "Sub-leaders".
--
-- Verification after db reset:
--   SELECT policyname FROM pg_policies WHERE policyname ILIKE '%sub_leader%';
--   → must return 0 rows
-- ============================================================

-- ----------------------------------------
-- 8a. profiles — Leaders can read other leader profiles
-- (originally from 00004, recreated in 00010 via get_my_role)
-- ----------------------------------------

DROP POLICY IF EXISTS "Leaders can read other leader profiles" ON public.profiles;

CREATE POLICY "Leaders can read other leader profiles"
  ON public.profiles FOR SELECT
  USING (
    deleted_at IS NULL
    AND role IN ('all_depts_leader', 'dept_head', 'team_head', 'supporter')
    AND public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')
  );

-- ----------------------------------------
-- 8b. profiles — Leaders can read in-scope volunteer profiles
-- (originally from 00007, recreated in 00010 via get_my_role)
-- ----------------------------------------

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
        JOIN public.sub_teams st ON st.department_id = d.id
        WHERE st.owner_id = auth.uid() AND st.deleted_at IS NULL
      )
    )
  );

-- ----------------------------------------
-- 8c. events — Team heads can read events with their sub-teams
-- (originally "Sub leaders can read events with their sub teams" from 00013)
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub leaders can read events with their sub teams" ON public.events;

CREATE POLICY "Team heads can read events with their sub teams"
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
    AND public.get_my_role() = 'team_head'
  );

-- ----------------------------------------
-- 8d. departments — Team heads can read departments via sub-team ownership
-- (originally "Sub leaders can read departments via sub-team ownership" from 00014)
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub leaders can read departments via sub-team ownership" ON public.departments;

CREATE POLICY "Team heads can read departments via sub-team ownership"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.i_have_sub_team_in_dept(id)
    AND public.get_my_role() = 'team_head'
  );

-- ----------------------------------------
-- 8e. sub_teams — Team heads can read their sub-teams
-- (originally "Sub leaders can read their sub teams" from 00014)
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub leaders can read their sub teams" ON public.sub_teams;

CREATE POLICY "Team heads can read their sub teams"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND owner_id = auth.uid()
    AND public.dept_is_active(department_id)
    AND public.get_my_role() = 'team_head'
  );

-- ----------------------------------------
-- 8f. availability_blockouts — Team heads can read in-scope blockouts
-- (originally "Sub leaders can read in-scope blockouts" from 00007)
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub leaders can read in-scope blockouts" ON public.availability_blockouts;

CREATE POLICY "Team heads can read in-scope blockouts"
  ON public.availability_blockouts FOR SELECT
  USING (
    deleted_at IS NULL
    AND volunteer_id IN (
      SELECT vi.volunteer_id
      FROM public.volunteer_interests vi
      JOIN public.departments d ON d.id = vi.department_id
      JOIN public.sub_teams st ON st.department_id = d.id
      WHERE st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- ----------------------------------------
-- 8g. department_skills — Team heads can read skills for owned sub-team departments
-- (originally "Sub-leaders can read skills for owned sub-team departments" from 00013)
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub-leaders can read skills for owned sub-team departments" ON public.department_skills;

CREATE POLICY "Team heads can read skills for owned sub-team departments"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.department_id = department_skills.department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- ----------------------------------------
-- 8h. volunteer_skills — Team heads can read approved skills in owned sub-team departments
-- (originally "Sub-leaders can read approved skills in owned sub-team departments" from 00013)
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub-leaders can read approved skills in owned sub-team departments" ON public.volunteer_skills;

CREATE POLICY "Team heads can read approved skills in owned sub-team departments"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'approved'
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.department_id = volunteer_skills.department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- ----------------------------------------
-- 8i. assignments — Team heads can read assignments in owned sub-teams
-- (originally "Sub-leaders can read assignments in owned sub-teams" from 00017)
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub-leaders can read assignments in owned sub-teams" ON public.assignments;

CREATE POLICY "Team heads can read assignments in owned sub-teams"
  ON public.assignments FOR SELECT
  USING (
    sub_team_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL
    )
  );

-- ----------------------------------------
-- 8j. assignments — Team heads can insert assignments in owned sub-teams
-- (originally "Sub-leaders can insert assignments in owned sub-teams" from 00011)
-- WITH CHECK also updates role IN ('volunteer', 'sub_leader') → 'team_head'
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub-leaders can insert assignments in owned sub-teams" ON public.assignments;

CREATE POLICY "Team heads can insert assignments in owned sub-teams"
  ON public.assignments FOR INSERT
  WITH CHECK (
    sub_team_id IS NOT NULL
    AND role IN ('volunteer', 'team_head')
    AND status = 'invited'
    AND created_by = auth.uid()
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id
        AND st.department_id = department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- ----------------------------------------
-- 8k. assignments — Team heads can update assignments in owned sub-teams
-- (originally "Sub-leaders can update assignments in owned sub-teams" from 00011)
-- WITH CHECK also updates role IN ('volunteer', 'sub_leader') → 'team_head'
-- ----------------------------------------

DROP POLICY IF EXISTS "Sub-leaders can update assignments in owned sub-teams" ON public.assignments;

CREATE POLICY "Team heads can update assignments in owned sub-teams"
  ON public.assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND sub_team_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id
        AND st.department_id = department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  )
  WITH CHECK (
    sub_team_id IS NOT NULL
    AND role IN ('volunteer', 'team_head')
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id
        AND st.department_id = department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );
