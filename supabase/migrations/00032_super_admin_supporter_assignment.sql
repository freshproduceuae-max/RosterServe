-- RS-F018: allow super_admin to update supporter profiles
--
-- Migration 00022 (super_admin_grant_profile_update.sql) only covers
-- profiles where role IN ('dept_head', 'team_head'). Supporter profiles
-- (role = 'supporter') are not covered, so super_admin cannot write the
-- supporter_of column on them. This policy closes that gap.

CREATE POLICY "Super admins can update supporter profiles"
  ON public.profiles FOR UPDATE
  USING (
    public.get_my_role() = 'super_admin'
    AND role = 'supporter'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
    AND role = 'supporter'
  );
