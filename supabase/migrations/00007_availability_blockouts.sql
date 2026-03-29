-- RS-F005: Availability and Blockout Management
--
-- Adds the availability_blockouts table, which lets volunteers mark specific
-- calendar dates when they are unavailable. Blockouts are soft-deleted (deleted_at
-- is set rather than the row being removed) to preserve audit history.
--
-- RLS policies give volunteers full read/write access to their own rows,
-- super admins read-all access, and dept_heads / sub_leaders scoped read access
-- to blockouts belonging to volunteers within their area of responsibility.
--
-- An additional SELECT policy is added to public.profiles so that dept_heads and
-- sub_leaders can read the display_name of in-scope volunteers (required for the
-- leader blockout view join).

-- ============================================================
-- AVAILABILITY BLOCKOUTS
-- One row per volunteer per date. Soft-deleted via deleted_at.
-- A partial unique index prevents duplicate active blockouts
-- for the same volunteer on the same date.
-- ============================================================

CREATE TABLE public.availability_blockouts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date         date        NOT NULL,
  reason       text        CHECK (reason IS NULL OR char_length(reason) <= 200),
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX idx_availability_blockouts_volunteer_id
  ON public.availability_blockouts(volunteer_id);

CREATE INDEX idx_availability_blockouts_date
  ON public.availability_blockouts(date);

-- Prevent duplicate active blockouts for the same volunteer on the same date.
-- Soft-deleted rows (deleted_at IS NOT NULL) are excluded from uniqueness checks.
CREATE UNIQUE INDEX availability_blockouts_volunteer_date_active_idx
  ON public.availability_blockouts(volunteer_id, date)
  WHERE deleted_at IS NULL;

ALTER TABLE public.availability_blockouts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS: AVAILABILITY BLOCKOUTS
-- ============================================================

-- 1. Volunteers read their own active blockouts
CREATE POLICY "Volunteers can read own active blockouts"
  ON public.availability_blockouts FOR SELECT
  USING (
    volunteer_id = auth.uid()
    AND deleted_at IS NULL
  );

-- 2. Volunteers insert their own blockouts
CREATE POLICY "Volunteers can insert own blockouts"
  ON public.availability_blockouts FOR INSERT
  WITH CHECK (volunteer_id = auth.uid());

-- 3. Volunteers soft-delete their own blockouts (UPDATE sets deleted_at)
CREATE POLICY "Volunteers can soft-delete own blockouts"
  ON public.availability_blockouts FOR UPDATE
  USING (volunteer_id = auth.uid())
  WITH CHECK (volunteer_id = auth.uid());

-- 4. Super admins read all blockouts
CREATE POLICY "Super admins can read all blockouts"
  ON public.availability_blockouts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'super_admin'
        AND deleted_at IS NULL
    )
  );

-- 5. Dept heads read active blockouts for volunteers interested in their departments
CREATE POLICY "Dept heads can read in-scope blockouts"
  ON public.availability_blockouts FOR SELECT
  USING (
    deleted_at IS NULL
    AND volunteer_id IN (
      SELECT vi.volunteer_id
      FROM public.volunteer_interests vi
      JOIN public.departments d ON d.id = vi.department_id
      WHERE d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- 6. Sub leaders read active blockouts for volunteers interested in departments
--    that contain their sub-teams
CREATE POLICY "Sub leaders can read in-scope blockouts"
  ON public.availability_blockouts FOR SELECT
  USING (
    deleted_at IS NULL
    AND volunteer_id IN (
      SELECT vi.volunteer_id
      FROM public.volunteer_interests vi
      JOIN public.departments d ON d.id = vi.department_id
      JOIN public.sub_teams st ON st.department_id = d.id
      WHERE st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
  );

-- ============================================================
-- RLS ADDITION: PROFILES
-- Allows dept_heads and sub_leaders to read the display_name
-- (and other profile columns) of volunteers within their scope.
-- Required so the leader blockout view can join display_name.
-- ============================================================

-- 7. Leaders (dept_head or sub_leader) read in-scope volunteer profiles
CREATE POLICY "Leaders can read in-scope volunteer profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'volunteer'
    AND deleted_at IS NULL
    -- Restrict caller to leader roles only
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS caller
      WHERE caller.id = auth.uid()
        AND caller.role IN ('dept_head', 'sub_leader')
        AND caller.deleted_at IS NULL
    )
    AND (
      -- dept_head: volunteer expressed interest in a dept they own
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        WHERE d.owner_id = auth.uid()
          AND d.deleted_at IS NULL
      )
      OR
      -- sub_leader: volunteer expressed interest in a dept containing their sub-team
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        JOIN public.sub_teams st ON st.department_id = d.id
        WHERE st.owner_id = auth.uid()
          AND st.deleted_at IS NULL
      )
    )
  );
