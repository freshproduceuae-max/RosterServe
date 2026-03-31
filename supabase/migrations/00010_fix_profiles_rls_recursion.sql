-- Fix: infinite recursion in profiles RLS policies
--
-- Three policies on public.profiles had subqueries that read FROM public.profiles
-- to check the caller's role. Because RLS is enabled on profiles, PostgreSQL
-- re-evaluated those same policies while processing the subquery, causing an
-- infinite recursion error: "infinite recursion detected in policy for relation
-- 'profiles'". This broke getSessionWithProfile() in the app layout, causing an
-- auth redirect loop for all protected routes.
--
-- Fix: introduce a SECURITY DEFINER helper function get_my_role() that reads the
-- caller's role from profiles while bypassing RLS (the function executes as its
-- owner, not the calling user). All three recursive policies are dropped and
-- recreated to call this function instead.

-- ============================================================
-- HELPER: get_my_role()
-- Returns the app_role of the currently authenticated user.
-- SECURITY DEFINER bypasses RLS, breaking the recursion cycle.
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
-- FIX 1: "Super admins can read all profiles"
-- Defined in 00001_auth_profiles.sql
-- ============================================================

DROP POLICY IF EXISTS "Super admins can read all profiles" ON public.profiles;

CREATE POLICY "Super admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- ============================================================
-- FIX 2: "Leaders can read other leader profiles"
-- Defined in 00004_leader_profile_read.sql
-- ============================================================

DROP POLICY IF EXISTS "Leaders can read other leader profiles" ON public.profiles;

CREATE POLICY "Leaders can read other leader profiles"
  ON public.profiles FOR SELECT
  USING (
    deleted_at IS NULL
    AND role IN ('dept_head', 'sub_leader')
    AND public.get_my_role() IN ('dept_head', 'sub_leader')
  );

-- ============================================================
-- FIX 3: "Leaders can read in-scope volunteer profiles"
-- Defined in 00007_availability_blockouts.sql
-- ============================================================

DROP POLICY IF EXISTS "Leaders can read in-scope volunteer profiles" ON public.profiles;

CREATE POLICY "Leaders can read in-scope volunteer profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'volunteer'
    AND deleted_at IS NULL
    AND public.get_my_role() IN ('dept_head', 'sub_leader')
    AND (
      -- dept_head: volunteer expressed interest in a dept they own
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        WHERE d.owner_id = auth.uid()
          AND d.deleted_at IS NULL
      )
      OR
      -- sub_leader: volunteer expressed interest in a dept containing their sub-team
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        JOIN public.sub_teams st ON st.department_id = d.id
        WHERE st.owner_id = auth.uid()
          AND st.deleted_at IS NULL
      )
    )
  );
