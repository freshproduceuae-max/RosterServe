-- Migration: 00025_department_members.sql
-- Feature: RS-F006 revision — permanent group membership
--
-- Adds department_members table (permanent membership state), RLS policies,
-- and approve_and_create_membership() SECURITY DEFINER function for atomic
-- interest approval + membership creation.

-- ---------------------------------------------------------------------------
-- 1. Create department_members table
-- ---------------------------------------------------------------------------
CREATE TABLE public.department_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  team_id      uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

-- Active membership: one per volunteer per department
CREATE UNIQUE INDEX department_members_volunteer_dept_active_idx
  ON public.department_members (volunteer_id, department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_department_members_department_id
  ON public.department_members (department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_department_members_volunteer_id
  ON public.department_members (volunteer_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

-- Volunteer reads own active memberships
CREATE POLICY "Volunteers can read own active memberships"
  ON public.department_members FOR SELECT
  USING (
    volunteer_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Dept head reads members in departments they own
CREATE POLICY "Dept heads can read members in owned departments"
  ON public.department_members FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- All depts leader reads all active memberships
CREATE POLICY "All depts leaders can read all memberships"
  ON public.department_members FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- Super admin reads everything
CREATE POLICY "Super admins can read all memberships"
  ON public.department_members FOR SELECT
  USING (
    public.get_my_role() = 'super_admin'
  );

-- Dept head updates team placement on members in their departments
CREATE POLICY "Dept heads can update team placement in owned departments"
  ON public.department_members FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- Super admin can update (team placement or soft-delete) any row
CREATE POLICY "Super admins can update any membership"
  ON public.department_members FOR UPDATE
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- ---------------------------------------------------------------------------
-- 3. approve_and_create_membership(): atomic approval + membership insert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_and_create_membership(
  p_interest_id uuid,
  p_team_id     uuid DEFAULT NULL
)
RETURNS uuid   -- returns new department_members.id (or existing if idempotent)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_volunteer_id   uuid;
  v_department_id  uuid;
  v_status         text;
  v_deleted_at     timestamptz;
  v_member_id      uuid;
BEGIN
  -- Fetch the interest row
  SELECT volunteer_id, department_id, status, deleted_at
  INTO v_volunteer_id, v_department_id, v_status, v_deleted_at
  FROM public.volunteer_interests
  WHERE id = p_interest_id;

  IF NOT FOUND OR v_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Interest not found';
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION 'Only pending interests can be approved';
  END IF;

  -- Caller must own the department or be super_admin
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = v_department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'super_admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Validate team belongs to this department (if provided)
  IF p_team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = p_team_id
        AND t.department_id = v_department_id
        AND t.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Team does not belong to this department';
    END IF;
  END IF;

  -- Mark the interest approved
  UPDATE public.volunteer_interests
  SET status      = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_interest_id;

  -- Check if membership already exists (idempotency guard)
  SELECT id INTO v_member_id
  FROM public.department_members
  WHERE volunteer_id = v_volunteer_id
    AND department_id = v_department_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    -- Create new membership
    INSERT INTO public.department_members (volunteer_id, department_id, team_id, created_by)
    VALUES (v_volunteer_id, v_department_id, p_team_id, auth.uid())
    RETURNING id INTO v_member_id;
  ELSIF p_team_id IS NOT NULL THEN
    -- Membership already exists; update team placement if a team was specified
    UPDATE public.department_members
    SET team_id = p_team_id
    WHERE id = v_member_id;
  END IF;

  RETURN v_member_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_and_create_membership(uuid, uuid)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_and_create_membership(uuid, uuid)
  FROM PUBLIC;
