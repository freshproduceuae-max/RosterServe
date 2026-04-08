-- RS-F002 revision: event creation grant mechanism
--
-- Adds the can_create_events flag to profiles and expands event RLS policies
-- so that all_depts_leader can create/manage events by default, and dept_head /
-- team_head can do so when explicitly granted by super_admin.
--
-- Gaps being closed:
--   1. all_depts_leader had no events SELECT policy — they saw zero events
--   2. events INSERT/UPDATE only covered super_admin
--   3. No grant flag existed on profiles

-- ============================================================
-- STEP 1: Add can_create_events column to profiles
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_create_events boolean NOT NULL DEFAULT false;

-- ============================================================
-- STEP 2: Add all_depts_leader events SELECT policy
--
-- all_depts_leader is a cross-department role with full active-event
-- visibility. This is broader than dept_head (whose policy in
-- 00016_fix_events_dept_head_policy.sql is scoped to departments they own).
-- ============================================================

CREATE POLICY "All depts leaders can read active events"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- STEP 3: Expand events INSERT policy
--
-- Replaces "Super admins can create events" (last set in 00013).
-- Now covers:
--   - super_admin   — always
--   - all_depts_leader — always
--   - dept_head / team_head — when can_create_events = true
-- ============================================================

DROP POLICY IF EXISTS "Super admins can create events" ON public.events;

CREATE POLICY "Authorized users can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.get_my_role() IN ('super_admin', 'all_depts_leader')
      OR (
        public.get_my_role() IN ('dept_head', 'team_head')
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND can_create_events = true
            AND deleted_at IS NULL
        )
      )
    )
  );

-- ============================================================
-- STEP 4: Expand events UPDATE policy
--
-- Replaces "Super admins can update active events" (last set in 00013).
-- Now covers:
--   - super_admin / all_depts_leader — can update any active event
--   - dept_head / team_head with grant — can only update events they created
-- ============================================================

DROP POLICY IF EXISTS "Super admins can update active events" ON public.events;

CREATE POLICY "Authorized users can update active events"
  ON public.events FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      public.get_my_role() IN ('super_admin', 'all_depts_leader')
      OR (
        public.get_my_role() IN ('dept_head', 'team_head')
        AND created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND can_create_events = true
            AND deleted_at IS NULL
        )
      )
    )
  )
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'all_depts_leader')
    OR (
      public.get_my_role() IN ('dept_head', 'team_head')
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND can_create_events = true
          AND deleted_at IS NULL
      )
    )
  );
