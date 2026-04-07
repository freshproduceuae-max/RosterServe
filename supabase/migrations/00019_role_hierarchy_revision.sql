-- RS-F001 revision (part 1 of 2): add new role enum values
--
-- This migration ONLY adds the three new enum values. All downstream work
-- (data migration, column additions, constraint fixes, RLS policy updates)
-- is in 00020_role_hierarchy_migration.sql.
--
-- Split is required because PostgreSQL does not allow a newly added enum value
-- to be used in the same transaction as the ALTER TYPE ... ADD VALUE statement
-- (SQLSTATE 55P04: unsafe use of new value). Separating into two migrations
-- ensures the ADD VALUE commits before the UPDATE and policy recreations run.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'all_depts_leader' AFTER 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_head' AFTER 'dept_head';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supporter' AFTER 'team_head';
