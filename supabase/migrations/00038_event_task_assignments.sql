-- RS-F019: Per-event task allocations
-- Links a task from the department library to a specific event and optionally
-- a volunteer. volunteer_id IS NULL means the slot is unassigned.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.event_task_assignments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid        NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  task_id       uuid        NOT NULL REFERENCES public.department_tasks(id) ON DELETE CASCADE,
  volunteer_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    uuid        NOT NULL REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- One active slot per task per event
CREATE UNIQUE INDEX idx_event_task_assignments_unique
  ON public.event_task_assignments (event_id, task_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_event_task_assignments_event_dept
  ON public.event_task_assignments (event_id, department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_event_task_assignments_volunteer
  ON public.event_task_assignments (volunteer_id)
  WHERE volunteer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_event_task_assignments_task
  ON public.event_task_assignments (task_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- TRIGGER
-- ============================================================

CREATE TRIGGER event_task_assignments_set_updated_at
  BEFORE UPDATE ON public.event_task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.event_task_assignments ENABLE ROW LEVEL SECURITY;

-- Super admin: full read
CREATE POLICY "Super admins can read all event task assignments"
  ON public.event_task_assignments FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- all_depts_leader: read all active
CREATE POLICY "All depts leaders can read event task assignments"
  ON public.event_task_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- Dept head: read active assignments in owned departments
CREATE POLICY "Dept heads can read event task assignments in owned depts"
  ON public.event_task_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- Team head: read active assignments in departments where they own a sub-team
CREATE POLICY "Team heads can read event task assignments in their dept"
  ON public.event_task_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- Dept head: create task assignment slots in owned departments
CREATE POLICY "Dept heads can create event task assignments in owned depts"
  ON public.event_task_assignments FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
    AND created_by = auth.uid()
  );

-- Team head: create task assignment slots in departments where they own a sub-team
CREATE POLICY "Team heads can create event task assignments in their dept"
  ON public.event_task_assignments FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
    AND created_by = auth.uid()
  );

-- Dept head: update (assign/unassign volunteer) in owned departments
CREATE POLICY "Dept heads can update event task assignments in owned depts"
  ON public.event_task_assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  )
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- Team head: update (assign/unassign volunteer) in their department
CREATE POLICY "Team heads can update event task assignments in their dept"
  ON public.event_task_assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  )
  WITH CHECK (
    public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- NOTE: No SELECT policy for role='volunteer' is intentional in RS-F019.
-- Volunteer-facing task visibility (e.g. "see what you're doing this Sunday") is
-- deferred to a future feature. When that feature is built, add a policy here:
--   USING (public.get_my_role() = 'volunteer' AND volunteer_id = auth.uid())
-- Do NOT add a partial implementation of this policy in a hotfix without
-- understanding the full scope of the volunteer task view feature.
