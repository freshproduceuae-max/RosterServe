-- Migration: 00008_interest_requests.sql
-- Feature: RS-F006 – Interest Requests
-- Adds status/routing columns to volunteer_interests, replaces the hard
-- UNIQUE constraint with a partial index that ignores soft-deleted rows,
-- updates RLS policies to match the new status/soft-delete model, and
-- replaces the replace_volunteer_interests() RPC to use soft-delete.

-- ---------------------------------------------------------------------------
-- 1. Add new columns to volunteer_interests
-- ---------------------------------------------------------------------------
ALTER TABLE public.volunteer_interests
  ADD COLUMN status      text        NOT NULL DEFAULT 'pending'
    CONSTRAINT volunteer_interests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN reviewed_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN deleted_at  timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Auto-approve all existing (pre-migration) rows so live data keeps working
-- ---------------------------------------------------------------------------
UPDATE public.volunteer_interests
  SET status = 'approved'
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Replace the hard UNIQUE constraint with a partial unique index
--    so that soft-deleted rows do not block re-insertion of the same pair.
-- ---------------------------------------------------------------------------
ALTER TABLE public.volunteer_interests
  DROP CONSTRAINT volunteer_interests_volunteer_id_department_id_key;

CREATE UNIQUE INDEX volunteer_interests_volunteer_id_department_id_active_idx
  ON public.volunteer_interests (volunteer_id, department_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Add index on status for query performance (active rows only)
-- ---------------------------------------------------------------------------
CREATE INDEX idx_volunteer_interests_status
  ON public.volunteer_interests (status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_volunteer_interests_reviewed_by
  ON public.volunteer_interests (reviewed_by)
  WHERE reviewed_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5. Update the volunteer SELECT policy to exclude soft-deleted rows
-- ---------------------------------------------------------------------------
DROP POLICY "Volunteers can read own interests" ON public.volunteer_interests;

CREATE POLICY "Volunteers can read own active interests"
  ON public.volunteer_interests FOR SELECT
  USING (auth.uid() = volunteer_id AND deleted_at IS NULL);

-- ---------------------------------------------------------------------------
-- 6. Drop the hard DELETE policy – volunteers now withdraw via soft-delete UPDATE
-- ---------------------------------------------------------------------------
DROP POLICY "Volunteers can delete own interests" ON public.volunteer_interests;

-- ---------------------------------------------------------------------------
-- 7. New RLS policies
-- ---------------------------------------------------------------------------

-- Volunteer: soft-delete (withdraw) their own pending interests
CREATE POLICY "Volunteers can withdraw own pending interests"
  ON public.volunteer_interests FOR UPDATE
  USING (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
  );

-- Dept head: read interests for departments they own
CREATE POLICY "Dept heads can read in-scope interests"
  ON public.volunteer_interests FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- Dept head: approve or reject interests for departments they own
CREATE POLICY "Dept heads can review in-scope interests"
  ON public.volunteer_interests FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
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

-- Super admin: replace old policy with a clean version (no functional change,
-- just keeps naming consistent with the new policies in this migration).
DROP POLICY "Super admins can read all interests" ON public.volunteer_interests;

CREATE POLICY "Super admins can read all interests"
  ON public.volunteer_interests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Update replace_volunteer_interests() to use soft-delete instead of DELETE
-- ---------------------------------------------------------------------------
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

  -- Soft-delete all existing active interests for this volunteer
  UPDATE public.volunteer_interests
    SET deleted_at = now()
    WHERE volunteer_id = p_volunteer_id
      AND deleted_at IS NULL;

  -- Insert new interests if provided; they land as status = 'pending' via column default
  IF p_department_ids IS NOT NULL AND cardinality(p_department_ids) > 0 THEN
    INSERT INTO public.volunteer_interests (volunteer_id, department_id)
    SELECT p_volunteer_id, unnest(p_department_ids);
  END IF;
END;
$$;

-- Grant remains the same – function signature is unchanged, so REVOKE/GRANT
-- from the previous migration (00006) still applies.

-- ---------------------------------------------------------------------------
-- 9. Patch INSERT policy to enforce status = 'pending' on new inserts
-- ---------------------------------------------------------------------------
DROP POLICY "Volunteers can insert own interests for active departments" ON public.volunteer_interests;

CREATE POLICY "Volunteers can insert own interests for active departments"
  ON public.volunteer_interests FOR INSERT
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
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
