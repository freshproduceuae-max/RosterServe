-- RS-F008: Roster planning and assignment management
--
-- Introduces the assignments table that ties an event, department, optional
-- sub-team, and volunteer together with a serving role and status.
-- Downstream: RS-F009 (skill-gap), RS-F010 (weekly dashboard), RS-F012
-- (volunteer response) all depend on rows created here.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  sub_team_id   uuid REFERENCES public.sub_teams(id) ON DELETE SET NULL,
  volunteer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'volunteer'
                  CHECK (role IN ('volunteer', 'sub_leader', 'dept_head')),
  status        text NOT NULL DEFAULT 'invited'
                  CHECK (status IN ('invited', 'accepted', 'declined', 'served')),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_assignments_event_dept
  ON public.assignments(event_id, department_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_assignments_volunteer
  ON public.assignments(volunteer_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_assignments_sub_team
  ON public.assignments(sub_team_id) WHERE deleted_at IS NULL AND sub_team_id IS NOT NULL;

-- One active assignment per volunteer per event per department.
-- sub_team_id is a placement field on the row, not a separate slot dimension.
CREATE UNIQUE INDEX idx_assignments_vol_event_dept
  ON public.assignments(volunteer_id, event_id, department_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- TRIGGER
-- update_updated_at() is defined in 00001_auth_profiles.sql.
-- ============================================================

CREATE TRIGGER assignments_set_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- 1. Dept_head reads assignments in owned departments
CREATE POLICY "Dept heads can read assignments in owned depts"
  ON public.assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL
    )
  );

-- 2. Dept_head creates assignments in owned departments
CREATE POLICY "Dept heads can insert assignments in owned depts"
  ON public.assignments FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL
    )
    AND status = 'invited'
    AND created_by = auth.uid()
  );

-- 3. Dept_head updates (edit role/sub-team) or soft-deletes assignments in owned departments
CREATE POLICY "Dept heads can update assignments in owned depts"
  ON public.assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL
    )
  );

-- 4. Sub-leader reads assignments in their owned sub-teams
CREATE POLICY "Sub-leaders can read assignments in owned sub-teams"
  ON public.assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND sub_team_id IS NOT NULL
    AND public.get_my_role() = 'sub_leader'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL
    )
  );

-- 5. Sub-leader creates assignments in their owned sub-teams
--    sub_team_id required; role may not be dept_head;
--    sub_team must belong to the same department as the assignment
CREATE POLICY "Sub-leaders can insert assignments in owned sub-teams"
  ON public.assignments FOR INSERT
  WITH CHECK (
    sub_team_id IS NOT NULL
    AND role IN ('volunteer', 'sub_leader')
    AND status = 'invited'
    AND created_by = auth.uid()
    AND public.get_my_role() = 'sub_leader'
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id
        AND st.department_id = department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- 6. Sub-leader updates (edit role / soft-delete) assignments in their owned sub-teams
--    WITH CHECK prevents promotion to dept_head and cross-department sub_team reassignment
CREATE POLICY "Sub-leaders can update assignments in owned sub-teams"
  ON public.assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND sub_team_id IS NOT NULL
    AND public.get_my_role() = 'sub_leader'
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
    AND role IN ('volunteer', 'sub_leader')
    AND EXISTS (
      SELECT 1 FROM public.sub_teams st
      WHERE st.id = sub_team_id
        AND st.department_id = department_id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- 7. Super_admin reads all assignments
CREATE POLICY "Super admins can read all assignments"
  ON public.assignments FOR SELECT
  USING (
    public.get_my_role() = 'super_admin'
  );

-- 8. Volunteer reads their own assignments (foundation for RS-F010/RS-F012)
CREATE POLICY "Volunteers can read own assignments"
  ON public.assignments FOR SELECT
  USING (
    auth.uid() = volunteer_id
    AND deleted_at IS NULL
  );
