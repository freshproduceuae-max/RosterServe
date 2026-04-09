-- RS-F016: dept_rotation_overrides
-- Stores which team was chosen for a given event+department.
-- Records are written when a Dept Head explicitly sets a rotation override.
-- Auto-suggestions are computed in the query layer from this history.

CREATE TABLE IF NOT EXISTS dept_rotation_overrides (
  event_id       uuid        NOT NULL REFERENCES events(id)       ON DELETE CASCADE,
  department_id  uuid        NOT NULL REFERENCES departments(id)   ON DELETE CASCADE,
  team_id        uuid        NOT NULL REFERENCES teams(id)         ON DELETE CASCADE,
  is_manual      boolean     NOT NULL DEFAULT true,
  created_by     uuid        NOT NULL REFERENCES profiles(id)      ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, department_id)
);

ALTER TABLE dept_rotation_overrides ENABLE ROW LEVEL SECURITY;

-- dept_head: full access scoped to departments they own
CREATE POLICY "dept_head_manage_rotation_overrides"
  ON dept_rotation_overrides
  FOR ALL
  USING (
    department_id IN (
      SELECT id FROM departments WHERE owner_id = auth.uid() AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    department_id IN (
      SELECT id FROM departments WHERE owner_id = auth.uid() AND deleted_at IS NULL
    )
  );

-- super_admin + all_depts_leader: read-only
CREATE POLICY "leaders_view_rotation_overrides"
  ON dept_rotation_overrides
  FOR SELECT
  USING (public.get_my_role() IN ('super_admin', 'all_depts_leader'));
