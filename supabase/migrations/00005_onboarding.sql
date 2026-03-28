-- RS-F004: Volunteer onboarding and profile setup
-- Adds three tables for availability preferences, department interests,
-- and skill submissions. Purely additive — no existing tables altered.

-- ============================================================
-- AVAILABILITY PREFERENCES
-- One row per volunteer, upserted on save.
-- ============================================================

CREATE TABLE public.availability_preferences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id    uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_days  text[] NOT NULL DEFAULT '{}',
  preferred_times text[] NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT availability_preferences_days_check
    CHECK (preferred_days <@ ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']::text[]),
  CONSTRAINT availability_preferences_times_check
    CHECK (preferred_times <@ ARRAY['morning','afternoon','evening']::text[])
);

CREATE INDEX idx_availability_preferences_volunteer_id
  ON public.availability_preferences(volunteer_id);

ALTER TABLE public.availability_preferences ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_availability_preferences_updated_at
  BEFORE UPDATE ON public.availability_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- VOLUNTEER INTERESTS
-- Many-to-one: volunteer -> department.
-- No status column — RS-F006 adds routing/status logic.
-- ============================================================

CREATE TABLE public.volunteer_interests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id   uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (volunteer_id, department_id)
);

CREATE INDEX idx_volunteer_interests_volunteer_id
  ON public.volunteer_interests(volunteer_id);
CREATE INDEX idx_volunteer_interests_department_id
  ON public.volunteer_interests(department_id);

ALTER TABLE public.volunteer_interests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- VOLUNTEER SKILLS
-- Status column exists from day one so RS-F007 can drive
-- approval/rejection without a migration.
-- ============================================================

CREATE TABLE public.volunteer_skills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_volunteer_skills_volunteer_id
  ON public.volunteer_skills(volunteer_id);
CREATE INDEX idx_volunteer_skills_status
  ON public.volunteer_skills(status) WHERE deleted_at IS NULL;

ALTER TABLE public.volunteer_skills ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_volunteer_skills_updated_at
  BEFORE UPDATE ON public.volunteer_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS: AVAILABILITY PREFERENCES
-- ============================================================

CREATE POLICY "Volunteers can read own availability"
  ON public.availability_preferences FOR SELECT
  USING (auth.uid() = volunteer_id);

CREATE POLICY "Volunteers can insert own availability"
  ON public.availability_preferences FOR INSERT
  WITH CHECK (auth.uid() = volunteer_id);

CREATE POLICY "Volunteers can update own availability"
  ON public.availability_preferences FOR UPDATE
  USING (auth.uid() = volunteer_id)
  WITH CHECK (auth.uid() = volunteer_id);

CREATE POLICY "Super admins can read all availability"
  ON public.availability_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ============================================================
-- RLS: VOLUNTEER INTERESTS
-- ============================================================

CREATE POLICY "Volunteers can read own interests"
  ON public.volunteer_interests FOR SELECT
  USING (auth.uid() = volunteer_id);

CREATE POLICY "Volunteers can insert own interests"
  ON public.volunteer_interests FOR INSERT
  WITH CHECK (auth.uid() = volunteer_id);

CREATE POLICY "Volunteers can delete own interests"
  ON public.volunteer_interests FOR DELETE
  USING (auth.uid() = volunteer_id);

CREATE POLICY "Super admins can read all interests"
  ON public.volunteer_interests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ============================================================
-- RLS: VOLUNTEER SKILLS
-- ============================================================

CREATE POLICY "Volunteers can read own skills"
  ON public.volunteer_skills FOR SELECT
  USING (auth.uid() = volunteer_id);

-- Volunteers may only insert skills with status = 'pending'.
-- Approval writes are reserved for RS-F007.
CREATE POLICY "Volunteers can insert own pending skills"
  ON public.volunteer_skills FOR INSERT
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
  );

CREATE POLICY "Super admins can read all skills"
  ON public.volunteer_skills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ============================================================
-- RLS ADDITIONS: VOLUNTEER READ ACCESS FOR ONBOARDING
-- The interests step reads departments (and their parent event titles)
-- so volunteers can select serving areas. Without these policies the
-- step always returns an empty list and cannot be used.
--
-- Department policy: active (non-deleted) departments only.
-- Events policy: published, non-deleted events only — this simultaneously
-- gates the inner join in getActiveDepartmentsForInterests so that only
-- departments from published events appear in the interests list.
-- ============================================================

CREATE POLICY "Volunteers can read active departments for onboarding"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'volunteer'
    )
  );

CREATE POLICY "Volunteers can read published events for onboarding context"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'volunteer'
    )
  );
