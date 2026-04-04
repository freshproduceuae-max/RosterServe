-- Migration: 00015_revoke_helper_public_execute.sql
--
-- Hardening: revoke PUBLIC EXECUTE on SECURITY DEFINER helper functions.
--
-- Background (00013/00014): get_my_role(), i_own_dept(), i_have_sub_team_in_dept(),
-- and dept_is_active() were created as SECURITY DEFINER with SET row_security = off
-- to break RLS recursion cycles. PostgreSQL grants EXECUTE to PUBLIC by default,
-- meaning both 'anon' (unauthenticated) and 'authenticated' Supabase roles can
-- call these functions directly via PostgREST RPC.
--
-- Risk:
--   - get_my_role(), i_own_dept(), i_have_sub_team_in_dept() gate on auth.uid()
--     so anon callers always get null/false — negligible practical risk.
--   - dept_is_active(uuid) does NOT use auth.uid(); an unauthenticated caller
--     could use it as a boolean oracle to confirm whether a department UUID
--     exists. With v4 UUIDs the brute-force probability is negligible, but
--     the function runs with row_security = off and should not be callable
--     by unauthenticated users.
--
-- Fix: restrict all four helpers to authenticated users and service_role only.

REVOKE EXECUTE ON FUNCTION public.get_my_role()                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.i_own_dept(uuid)                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.i_have_sub_team_in_dept(uuid)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dept_is_active(uuid)             FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_role()                     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.i_own_dept(uuid)                  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.i_have_sub_team_in_dept(uuid)     TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dept_is_active(uuid)              TO authenticated, service_role;
