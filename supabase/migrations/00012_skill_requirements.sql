-- Migration: 00012_skill_requirements.sql
-- Feature: RS-F009 – Skill Gap Detection
-- Adds is_required column to department_skills so dept heads can flag which
-- catalog skills are mandatory for a department. Also adds sub-leader SELECT
-- policies on department_skills and volunteer_skills so gap detection queries
-- can execute on the roster page without elevated privilege.

-- ============================================================
-- 1. Add is_required column to department_skills
-- ============================================================

ALTER TABLE public.department_skills
  ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 2. No new UPDATE policy needed for dept heads
-- ============================================================

-- The existing policy "Dept heads can soft-delete own department skills"
-- (policy 5c in 00009_skills.sql) already covers UPDATE for dept heads who
-- own the department and whose row has deleted_at IS NULL. Its USING and
-- WITH CHECK clauses impose no restriction on which columns are written, so
-- toggling is_required passes cleanly through that policy without any
-- additional rule.

-- ============================================================
-- 3. Sub-leader SELECT policy on department_skills
-- ============================================================

-- Sub-leaders need to read the required-skill catalog for departments where
-- they own a sub-team so that gap detection can compare required skills
-- against covered skills on the roster page.

CREATE POLICY "Sub-leaders can read skills for owned sub-team departments"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'sub_leader')
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.department_id = department_skills.department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- ============================================================
-- 4. Sub-leader SELECT policy on volunteer_skills
-- ============================================================

-- Sub-leaders need to read approved volunteer skill claims scoped to
-- departments where they own a sub-team so gap coverage can be computed.
-- department_id IS NOT NULL intentionally excludes legacy free-text skill
-- claims (onboarding path: skill_id IS NULL AND department_id IS NULL).
-- Those claims have no FK to a catalog entry and can never satisfy a
-- catalog-linked is_required requirement, so excluding them is correct.

CREATE POLICY "Sub-leaders can read approved skills in owned sub-team departments"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'approved'
    AND department_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'sub_leader')
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.department_id = volunteer_skills.department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );
