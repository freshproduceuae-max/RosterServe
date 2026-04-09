-- ============================================================
-- RS-F012: Allow dept_head / all_depts_leader / super_admin
--          to transition accepted assignments → served
-- ============================================================

-- This policy allows designated leaders to record that a volunteer
-- has actually served at an event (accepted → served).
-- The WITH CHECK restricts the update to only setting status = 'served';
-- other column changes are prevented by the narrowly targeted USING clause.

CREATE POLICY "leader_can_mark_assignment_served"
  ON public.assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'accepted'
    AND (
      public.get_my_role() IN ('super_admin', 'all_depts_leader')
      OR (
        public.get_my_role() = 'dept_head'
        AND EXISTS (
          SELECT 1 FROM public.departments d
          WHERE d.id = assignments.department_id
            AND d.owner_id = auth.uid()
            AND d.deleted_at IS NULL
        )
      )
    )
  )
  WITH CHECK (
    status = 'served'
  );
