-- Migration: 00026_skills_role_expansion.sql
-- Feature: RS-F007 revision — Skill Profile and Approval
--
-- 1. Drop stale sub_leader policies from 00012 (role renamed to team_head
--    in RS-F001, sub_teams renamed to teams in RS-F003).
-- 2. Add super_admin INSERT + UPDATE policies on department_skills.
-- 3. Add all_depts_leader SELECT + INSERT + UPDATE policies on department_skills.
-- 4. Add team_head SELECT policy on department_skills (departments where they own a team).
-- 5. Add super_admin SELECT + UPDATE (approve/reject) policies on volunteer_skills.
-- 6. Add all_depts_leader SELECT + UPDATE (approve/reject) policies on volunteer_skills.
-- 7. Add team_head SELECT + UPDATE (approve/reject) policies on volunteer_skills.

-- ============================================================
-- 1. Drop stale sub_leader policies from migration 00012
-- ============================================================

DROP POLICY IF EXISTS "Sub-leaders can read skills for owned sub-team departments"
  ON public.department_skills;

DROP POLICY IF EXISTS "Sub-leaders can read approved skills in owned sub-team departments"
  ON public.volunteer_skills;

-- ============================================================
-- 2. super_admin INSERT on department_skills
-- ============================================================

CREATE POLICY "Super admins can insert department skills"
  ON public.department_skills FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 3. super_admin UPDATE (soft-delete + is_required toggle) on department_skills
-- ============================================================

CREATE POLICY "Super admins can update department skills"
  ON public.department_skills FOR UPDATE
  USING (
    public.get_my_role() = 'super_admin'
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 4. all_depts_leader SELECT on department_skills
-- ============================================================

CREATE POLICY "All depts leaders can read all department skills"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 5. all_depts_leader INSERT on department_skills
-- ============================================================

CREATE POLICY "All depts leaders can insert department skills"
  ON public.department_skills FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 6. all_depts_leader UPDATE on department_skills
-- ============================================================

CREATE POLICY "All depts leaders can update department skills"
  ON public.department_skills FOR UPDATE
  USING (
    public.get_my_role() = 'all_depts_leader'
  )
  WITH CHECK (
    public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 7. team_head SELECT on department_skills
--    (departments where they own an active team)
-- ============================================================

CREATE POLICY "Team heads can read skills for departments with owned teams"
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

-- ============================================================
-- 8. super_admin SELECT on volunteer_skills
-- ============================================================

CREATE POLICY "Super admins can read all volunteer skill claims"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 9. super_admin UPDATE (approve/reject) on volunteer_skills
-- ============================================================

CREATE POLICY "Super admins can review volunteer skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND public.get_my_role() = 'super_admin'
  )
  WITH CHECK (
    status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 10. all_depts_leader SELECT on volunteer_skills
-- ============================================================

CREATE POLICY "All depts leaders can read all volunteer skill claims"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 11. all_depts_leader UPDATE (approve/reject) on volunteer_skills
-- ============================================================

CREATE POLICY "All depts leaders can review volunteer skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND public.get_my_role() = 'all_depts_leader'
  )
  WITH CHECK (
    status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 12. team_head SELECT on volunteer_skills
--     (claims in departments where they own an active team)
-- ============================================================

CREATE POLICY "Team heads can read skill claims in departments with owned teams"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = volunteer_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- ============================================================
-- 13. team_head UPDATE (approve/reject) on volunteer_skills
--     Scoped to departments where they own a team.
-- ============================================================

CREATE POLICY "Team heads can review skill claims in departments with owned teams"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = volunteer_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = volunteer_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );
