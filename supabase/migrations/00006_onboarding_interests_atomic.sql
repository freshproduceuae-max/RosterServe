-- RS-F004 fix: atomic interest replacement + department ID validation
--
-- 1. Replace the permissive volunteer_interests INSERT policy with one that
--    validates each submitted department ID is active and on a published event.
--    This closes the crafted-request vector from P2.
--
-- 2. Add replace_volunteer_interests() — a single PostgreSQL function that
--    deletes then re-inserts in one transaction so an insert failure cannot
--    erase the volunteer's previous selections (P1).

-- ============================================================
-- UPDATE INSERT POLICY: validate department is onboarding-visible
-- ============================================================

DROP POLICY IF EXISTS "Volunteers can insert own interests" ON public.volunteer_interests;

CREATE POLICY "Volunteers can insert own interests for active departments"
  ON public.volunteer_interests FOR INSERT
  WITH CHECK (
    auth.uid() = volunteer_id
    AND EXISTS (
      SELECT 1
      FROM public.departments AS d
      JOIN public.events AS e ON e.id = d.event_id
      WHERE d.id = department_id
        AND d.deleted_at IS NULL
        AND e.deleted_at IS NULL
        AND e.status = 'published'
    )
  );

-- ============================================================
-- ATOMIC REPLACE FUNCTION
-- Runs with SECURITY INVOKER (default) so the caller's RLS
-- policies apply: DELETE is filtered to the volunteer's own rows,
-- INSERT is validated by the policy above. Both happen in the
-- same PostgreSQL transaction — if INSERT fails, DELETE rolls back.
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_volunteer_interests(
  p_volunteer_id uuid,
  p_department_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_volunteer_id THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  DELETE FROM public.volunteer_interests
  WHERE volunteer_id = p_volunteer_id;

  IF p_department_ids IS NOT NULL AND cardinality(p_department_ids) > 0 THEN
    INSERT INTO public.volunteer_interests (volunteer_id, department_id)
    SELECT p_volunteer_id, unnest(p_department_ids);
  END IF;
END;
$$;

-- Only authenticated users may call this function
REVOKE EXECUTE ON FUNCTION public.replace_volunteer_interests(uuid, uuid[]) FROM public;
GRANT  EXECUTE ON FUNCTION public.replace_volunteer_interests(uuid, uuid[]) TO authenticated;
