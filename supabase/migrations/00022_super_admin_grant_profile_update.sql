-- RS-F002 fix: allow super_admin to update dept_head / team_head profiles
--
-- The grantEventCreation / revokeEventCreation server actions update the
-- can_create_events flag on dept_head and team_head profiles. Migration 00021
-- added the column and the grant UI but omitted the RLS UPDATE policy needed
-- for super_admin to write to another user's profile row.
--
-- The existing profiles UPDATE policy (00001_auth_profiles.sql) only allows
-- users to update their own row: USING (auth.uid() = id). This policy adds a
-- second UPDATE path scoped to super_admin acting on dept_head / team_head rows.

CREATE POLICY "Super admins can update dept and team head profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.get_my_role() = 'super_admin'
    AND role IN ('dept_head', 'team_head')
    AND deleted_at IS NULL
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    AND role IN ('dept_head', 'team_head')
  );
