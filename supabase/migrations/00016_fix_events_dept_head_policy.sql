-- Migration: 00016_fix_events_dept_head_policy.sql
--
-- Bug: "Dept heads can read events with their departments" SELECT policy uses
-- an unqualified column reference `id` inside a correlated subquery on departments.
--
--   EXISTS (SELECT 1 FROM departments d WHERE d.event_id = id ...)
--
-- PostgreSQL resolves `id` by searching the inner FROM clause first. Since
-- `departments` has a column named `id`, the condition becomes:
--
--   d.event_id = d.id   -- always false; never matches any row
--
-- The correct reference is `events.id`. The sub_leader policy on the same table
-- correctly uses `d.event_id = events.id`; the dept_head policy was inconsistent.
--
-- This was first introduced in 00003_departments.sql (line 326) and copied
-- unchanged into 00013_fix_rls_indirect_recursion.sql (line 236).
-- No dept_head has ever been able to read events via the API as a result.

DROP POLICY IF EXISTS "Dept heads can read events with their departments" ON public.events;

CREATE POLICY "Dept heads can read events with their departments"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.event_id = events.id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND public.get_my_role() = 'dept_head'
  );
