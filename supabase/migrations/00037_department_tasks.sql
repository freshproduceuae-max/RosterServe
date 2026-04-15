-- RS-F019: Department Task Library
-- Creates the department_tasks table for persistent, reusable tasks per department.
-- Tasks optionally link to a required skill from department_skills.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.department_tasks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id    uuid        NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name             text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  required_skill_id uuid       REFERENCES public.department_skills(id) ON DELETE SET NULL,
  created_by       uuid        NOT NULL REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- Case-insensitive unique task name per department (active records only)
-- Uses a partial functional unique index because a constraint expression like
-- UNIQUE(department_id, lower(name)) is not supported directly in DDL.
CREATE UNIQUE INDEX idx_department_tasks_name_unique
  ON public.department_tasks (department_id, lower(name))
  WHERE deleted_at IS NULL;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_department_tasks_dept
  ON public.department_tasks (department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_department_tasks_skill
  ON public.department_tasks (required_skill_id)
  WHERE required_skill_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- TRIGGER
-- update_updated_at() defined in 00001_auth_profiles.sql
-- ============================================================

CREATE TRIGGER department_tasks_set_updated_at
  BEFORE UPDATE ON public.department_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;

-- Super admin: full read including soft-deleted
CREATE POLICY "Super admins can read all department tasks"
  ON public.department_tasks FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- Dept head: read active tasks in owned departments
CREATE POLICY "Dept heads can read tasks in owned departments"
  ON public.department_tasks FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- Team head: read active tasks in departments where they own a sub-team
CREATE POLICY "Team heads can read tasks in their department"
  ON public.department_tasks FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- all_depts_leader: read all active tasks
CREATE POLICY "All depts leaders can read department tasks"
  ON public.department_tasks FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- Dept head: create tasks in owned departments
CREATE POLICY "Dept heads can create tasks in owned departments"
  ON public.department_tasks FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
    AND created_by = auth.uid()
  );

-- Dept head: update (rename, change skill) active tasks in owned departments
CREATE POLICY "Dept heads can update tasks in owned departments"
  ON public.department_tasks FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  )
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );
