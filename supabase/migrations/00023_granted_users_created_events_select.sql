-- RS-F002 fix: allow granted dept_head / team_head to read events they created
--
-- The events INSERT action chains .select("id").single() to get the new event ID
-- for the redirect. The existing dept_head SELECT policy (00016) only covers events
-- that contain departments they own. A newly created event has no departments yet,
-- so the SELECT after INSERT returns 0 rows and the action errors with the generic
-- "could not be created" message even though the INSERT succeeded.
--
-- Root cause: the authorization matrix (plan doc) marks granted dept_head / team_head
-- as having full active-event read access (no "owned depts only" qualifier), but no
-- SELECT policy was added for this in 00021.
--
-- This policy closes that gap: granted users can read any active event they created.
-- It also makes the events list correctly show all events the granted user created,
-- not just those that already have departments attached.

CREATE POLICY "Granted users can read events they created"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND created_by = auth.uid()
    AND public.get_my_role() IN ('dept_head', 'team_head')
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND can_create_events = true
        AND deleted_at IS NULL
    )
  );
