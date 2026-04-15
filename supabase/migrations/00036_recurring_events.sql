-- RS-F020: Recurring events + forecast view
-- Adds recurrence metadata to events, an event_departments join table,
-- and supporting indexes + RLS policies.

-- ============================================================
-- STEP 1: Extend events table
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_recurring    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule text
    CHECK (recurrence_rule IN ('weekly','fortnightly','monthly_first_sunday','annual')),
  ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_stub         boolean NOT NULL DEFAULT false;

-- Constraint: recurrence_rule is required when is_recurring is true
ALTER TABLE public.events
  ADD CONSTRAINT chk_recurrence_rule_required
  CHECK (
    (is_recurring = false) OR (is_recurring = true AND recurrence_rule IS NOT NULL)
  );

-- Constraint: stubs must reference a parent
ALTER TABLE public.events
  ADD CONSTRAINT chk_stub_parent_required
  CHECK (
    (is_stub = false) OR (is_stub = true AND parent_event_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_events_parent_id
  ON public.events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_stubs_active
  ON public.events(parent_event_id, event_date, status)
  WHERE is_stub = true AND deleted_at IS NULL;

-- Deduplication safety net: prevents duplicate stubs for same series + date
-- even under concurrent form submissions (application layer is not atomic).
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique_stub_date
  ON public.events(parent_event_id, event_date)
  WHERE is_stub = true AND deleted_at IS NULL;

-- ============================================================
-- STEP 2: event_departments join table
-- Records which org-level departments are candidates for a given event.
-- Used by stubs before any assignment rows exist.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_departments (
  event_id      uuid NOT NULL REFERENCES public.events(id)      ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_event_departments_dept_id
  ON public.event_departments(department_id);

ALTER TABLE public.event_departments ENABLE ROW LEVEL SECURITY;

-- super_admin: full access
CREATE POLICY "super_admin_manage_event_departments"
  ON public.event_departments
  FOR ALL
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- all_depts_leader: full access
CREATE POLICY "all_depts_leader_manage_event_departments"
  ON public.event_departments
  FOR ALL
  USING (public.get_my_role() = 'all_depts_leader')
  WITH CHECK (public.get_my_role() = 'all_depts_leader');

-- dept_head: read + insert rows for departments they own
-- IMPORTANT: Must use i_own_dept() helper — never raw EXISTS/IN on departments.
-- Raw subqueries on departments inside policies trigger infinite RLS recursion
-- (see migration 00014 and 00033 for the documented fix pattern).
CREATE POLICY "dept_head_read_event_departments"
  ON public.event_departments
  FOR SELECT
  USING (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

CREATE POLICY "dept_head_insert_event_departments"
  ON public.event_departments
  FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- team_head: read-only for events where they have a team in the department
-- IMPORTANT: Use i_have_sub_team_in_dept() — not a raw JOIN to teams/departments.
CREATE POLICY "team_head_read_event_departments"
  ON public.event_departments
  FOR SELECT
  USING (
    public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- ============================================================
-- STEP 3: Backfill event_departments from existing assignments
-- The rotation schedule query switches from assignments to event_departments.
-- Without this backfill, all existing published events have zero rows in
-- event_departments and the rotation schedule silently breaks at migration time.
-- ON CONFLICT DO NOTHING makes this idempotent (safe to re-run).
-- ============================================================

INSERT INTO public.event_departments (event_id, department_id)
SELECT DISTINCT a.event_id, a.department_id
FROM   public.assignments a
JOIN   public.events e ON e.id = a.event_id
WHERE  e.deleted_at IS NULL
  AND  a.deleted_at IS NULL
ON CONFLICT DO NOTHING;
