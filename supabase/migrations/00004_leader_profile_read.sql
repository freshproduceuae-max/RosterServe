-- RS-F003 fix: leader profile read access
--
-- The profiles RLS in 00001 only allows users to read their own profile
-- (plus super_admin reading all). This prevents dept_head and sub_leader from
-- reading other profiles, which breaks:
--   1. Department owner dropdowns in sub-team creation forms (dept_head can't
--      see sub_leader profiles to assign as owners)
--   2. Owner display names in department/sub-team detail views for sub_leader
--      callers (owners show as "Unassigned" even when assigned)
--
-- This policy grants dept_head and sub_leader READ access to profiles where
-- role is dept_head or sub_leader. Volunteers and super_admin are excluded
-- from this policy (volunteer profiles are not needed by leaders here;
-- super_admin already has a full-read policy).
--
-- The profiles table contains no contact details (email lives in auth.users),
-- so exposing the full profile row to leader roles is safe for v1.

CREATE POLICY "Leaders can read other leader profiles"
  ON public.profiles FOR SELECT
  USING (
    deleted_at IS NULL
    AND role IN ('dept_head', 'sub_leader')
    AND EXISTS (
      SELECT 1 FROM public.profiles AS caller
      WHERE caller.id = auth.uid()
        AND caller.role IN ('dept_head', 'sub_leader')
        AND caller.deleted_at IS NULL
    )
  );
