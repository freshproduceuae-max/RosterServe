-- Migration: 00018_volunteer_event_subteam_read.sql
--
-- Grants volunteers read access to the events and sub_teams rows that are
-- directly relevant to their assignments (RS-F010 dashboard).
--
-- Problem 1 — missing events access
--   The volunteer dashboard query joins assignments to events!inner. Without a
--   volunteer SELECT policy on events, the inner join returns no rows.
--
-- Problem 2 — missing sub_teams access
--   The same query left-joins to sub_teams. Without a volunteer policy,
--   sub_team_name is always null.
--
-- Problem 3 — RLS recursion
--   A naive EXISTS (SELECT 1 FROM assignments ...) inside the events or
--   sub_teams policy causes infinite recursion:
--     - assignments sub_leader policy queries sub_teams
--     - sub_teams volunteer policy (naive) queries assignments
--     - → cycle
--   Fix: SECURITY DEFINER helpers with row_security = off, the same pattern
--   used for get_my_role() and the other helpers in this codebase.

-- ── SECURITY DEFINER helpers ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.i_have_assignment_for_event(event_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.event_id = event_uuid
      AND a.volunteer_id = auth.uid()
      AND a.deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION public.i_have_assignment_for_sub_team(sub_team_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.sub_team_id = sub_team_uuid
      AND a.volunteer_id = auth.uid()
      AND a.deleted_at IS NULL
  );
$$;

-- Restrict EXECUTE to authenticated users only (same hardening as 00015)
REVOKE EXECUTE ON FUNCTION public.i_have_assignment_for_event(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.i_have_assignment_for_event(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.i_have_assignment_for_sub_team(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.i_have_assignment_for_sub_team(uuid) TO authenticated, service_role;

-- ── RLS policies ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Volunteers can read events for their assignments" ON public.events;
CREATE POLICY "Volunteers can read events for their assignments"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.i_have_assignment_for_event(id)
  );

DROP POLICY IF EXISTS "Volunteers can read sub_teams for their assignments" ON public.sub_teams;
CREATE POLICY "Volunteers can read sub_teams for their assignments"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.i_have_assignment_for_sub_team(id)
  );
