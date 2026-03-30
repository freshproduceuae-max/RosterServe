-- Migration: 00009_skills.sql
-- Feature: RS-F007 – Skill Profile and Approval
-- Creates department_skills catalog table, extends volunteer_skills with
-- department/skill/review columns, replaces the broad INSERT policy with
-- a dual-branch policy, and adds full RLS for both tables.

-- ============================================================
-- 1. New table: department_skills
-- ============================================================

CREATE TABLE public.department_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- Partial unique index: prevents duplicate skill names within a department (case-insensitive)
CREATE UNIQUE INDEX idx_department_skills_dept_name
  ON public.department_skills(department_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_department_skills_dept_id
  ON public.department_skills(department_id) WHERE deleted_at IS NULL;

ALTER TABLE public.department_skills ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Extend volunteer_skills with 4 new nullable columns
-- ============================================================

ALTER TABLE public.volunteer_skills
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN skill_id      uuid REFERENCES public.department_skills(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at   timestamptz;

CREATE INDEX idx_volunteer_skills_dept_id
  ON public.volunteer_skills(department_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_volunteer_skills_skill_id
  ON public.volunteer_skills(skill_id) WHERE deleted_at IS NULL;

-- Partial unique index: prevents duplicate catalog skill claims per volunteer
CREATE UNIQUE INDEX idx_volunteer_skills_volunteer_skill
  ON public.volunteer_skills(volunteer_id, skill_id)
  WHERE deleted_at IS NULL AND skill_id IS NOT NULL;

-- ============================================================
-- 3. Replace broad INSERT policy on volunteer_skills
-- ============================================================

DROP POLICY IF EXISTS "Volunteers can insert own pending skills" ON public.volunteer_skills;

CREATE POLICY "Volunteers can insert own skills"
  ON public.volunteer_skills FOR INSERT
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND (
      -- Legacy onboarding path: free-text name only, no catalog link
      (skill_id IS NULL AND department_id IS NULL)
      OR
      -- Catalog claim path: approved interest + skill must belong to same active department
      (
        skill_id IS NOT NULL
        AND department_id IS NOT NULL
        AND department_id IN (
          SELECT vi.department_id FROM public.volunteer_interests vi
          WHERE vi.volunteer_id = auth.uid()
            AND vi.status = 'approved'
            AND vi.deleted_at IS NULL
        )
        AND EXISTS (
          SELECT 1 FROM public.department_skills ds
          WHERE ds.id = skill_id
            AND ds.department_id = department_id
            AND ds.deleted_at IS NULL
        )
      )
    )
  );

-- ============================================================
-- 4. Update volunteer SELECT policy to exclude soft-deleted rows
-- ============================================================

DROP POLICY IF EXISTS "Volunteers can read own skills" ON public.volunteer_skills;

CREATE POLICY "Volunteers can read own skills"
  ON public.volunteer_skills FOR SELECT
  USING (auth.uid() = volunteer_id AND deleted_at IS NULL);

-- ============================================================
-- 5. RLS policies on department_skills (5 policies)
-- ============================================================

-- 5a. Dept head reads own department catalog
CREATE POLICY "Dept heads can read own department skills"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
    AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
  );

-- 5b. Dept head creates catalog entries
CREATE POLICY "Dept heads can insert department skills"
  ON public.department_skills FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
    AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
  );

-- 5c. Dept head soft-deletes catalog entries
CREATE POLICY "Dept heads can soft-delete own department skills"
  ON public.department_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
    AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
  );

-- 5d. Volunteer reads catalog for departments where they have an approved interest
CREATE POLICY "Volunteers can read skills for approved-interest departments"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND department_id IN (
      SELECT vi.department_id FROM public.volunteer_interests vi
      WHERE vi.volunteer_id = auth.uid()
        AND vi.status = 'approved'
        AND vi.deleted_at IS NULL
    )
  );

-- 5e. Super admin reads all department skills
CREATE POLICY "Super admins can read all department skills"
  ON public.department_skills FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- ============================================================
-- 6. RLS policies on volunteer_skills (3 new policies)
-- ============================================================

-- 6a. Dept head reads skill claims in owned departments
CREATE POLICY "Dept heads can read in-scope skill claims"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND department_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
    AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
  );

-- 6b. Dept head approves/rejects skill claims in owned departments
CREATE POLICY "Dept heads can review in-scope skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
    AND EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
    AND status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
  );

-- 6c. Volunteer soft-deletes own pending claims (30-second window)
CREATE POLICY "Volunteers can withdraw own pending skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND deleted_at BETWEEN (now() - interval '30 seconds') AND (now() + interval '30 seconds')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );
