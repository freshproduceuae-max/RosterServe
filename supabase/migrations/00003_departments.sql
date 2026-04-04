-- RS-F003: Department and sub-team structure
-- Models the church planning hierarchy: event -> department -> sub-team.
-- Also replaces the pre-RS-F003 broad leader event-read policy with
-- ownership-scoped policies so visibility follows responsibility.

-- ============================================================
-- DEPARTMENTS TABLE
-- ============================================================

CREATE TABLE public.departments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id),
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  owner_id      uuid REFERENCES public.profiles(id),
  created_by    uuid NOT NULL REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE INDEX idx_departments_event_id  ON public.departments(event_id);
CREATE INDEX idx_departments_owner_id  ON public.departments(owner_id);
CREATE INDEX idx_departments_active    ON public.departments(event_id, owner_id) WHERE deleted_at IS NULL;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_departments_updated_at
  BEFORE UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- SUB_TEAMS TABLE
-- ============================================================

CREATE TABLE public.sub_teams (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id   uuid NOT NULL REFERENCES public.departments(id),
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  owner_id        uuid REFERENCES public.profiles(id),
  created_by      uuid NOT NULL REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX idx_sub_teams_department_id  ON public.sub_teams(department_id);
CREATE INDEX idx_sub_teams_owner_id       ON public.sub_teams(owner_id);
CREATE INDEX idx_sub_teams_active         ON public.sub_teams(department_id, owner_id) WHERE deleted_at IS NULL;

ALTER TABLE public.sub_teams ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_sub_teams_updated_at
  BEFORE UPDATE ON public.sub_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS: DEPARTMENTS
-- ============================================================

-- Super admin: full visibility including soft-deleted (oversight)
CREATE POLICY "Super admins can read all departments"
  ON public.departments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Dept head: see active departments they own
CREATE POLICY "Dept heads can read their departments"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
  );

-- Sub-leader: see active departments that contain a sub-team they own
-- Also guards that the parent department itself is active.
CREATE POLICY "Sub leaders can read departments via sub-team ownership"
  ON public.departments FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.sub_teams AS st
      WHERE st.department_id = id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'sub_leader'
    )
  );

-- Super admin only: create departments
CREATE POLICY "Super admins can create departments"
  ON public.departments FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin only: update active departments
CREATE POLICY "Super admins can update active departments"
  ON public.departments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- ============================================================
-- RLS: SUB_TEAMS
-- ============================================================

-- Super admin: full visibility including soft-deleted
CREATE POLICY "Super admins can read all sub teams"
  ON public.sub_teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Dept head: see active sub-teams in departments they own
-- Guards that the parent department is also active.
CREATE POLICY "Dept heads can read sub teams in their departments"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
  );

-- Sub-leader: see active sub-teams they own
-- Also guards that the parent department is active (cascade invariant).
CREATE POLICY "Sub leaders can read their sub teams"
  ON public.sub_teams FOR SELECT
  USING (
    deleted_at IS NULL
    AND owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id AND d.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'sub_leader'
    )
  );

-- Super admin: create sub-teams
CREATE POLICY "Super admins can create sub teams"
  ON public.sub_teams FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Dept head: create sub-teams in departments they own
CREATE POLICY "Dept heads can create sub teams in their departments"
  ON public.sub_teams FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
  );

-- Super admin: update active sub-teams
CREATE POLICY "Super admins can update active sub teams"
  ON public.sub_teams FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Dept head: update active sub-teams in departments they own
CREATE POLICY "Dept heads can update sub teams in their departments"
  ON public.sub_teams FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
  );

-- ============================================================
-- OWNER ROLE ENFORCEMENT TRIGGERS
-- Enforce that departments.owner_id must reference a dept_head profile
-- and sub_teams.owner_id must reference a sub_leader profile.
-- This guards the ownership invariant at the database level beyond the UI.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_department_owner_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.owner_id AND role = 'dept_head' AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Department owner must be a user with role dept_head';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_department_owner_role
  BEFORE INSERT OR UPDATE ON public.departments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_department_owner_role();

CREATE OR REPLACE FUNCTION public.enforce_sub_team_owner_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.owner_id AND role = 'sub_leader' AND deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Sub-team owner must be a user with role sub_leader';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_sub_team_owner_role
  BEFORE INSERT OR UPDATE ON public.sub_teams
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sub_team_owner_role();

-- ============================================================
-- EVENTS RLS: REPLACE BROAD LEADER POLICY WITH SCOPED POLICIES
--
-- The "Leaders can read active events" policy from 00002_events.sql
-- gave all dept_head and sub_leader users access to every active event.
-- RS-F003 replaces it with ownership-scoped policies.
--
-- IMPORTANT ROLLOUT NOTE:
-- After this migration runs, dept_head and sub_leader users will see
-- NO events until super_admin creates departments/sub_teams and assigns
-- owners. This is intentional — visibility follows responsibility.
-- ============================================================

DROP POLICY IF EXISTS "Leaders can read active events" ON public.events;

-- Dept head: sees active events that contain a department they own
CREATE POLICY "Dept heads can read events with their departments"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.departments AS d
      WHERE d.event_id = events.id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
  );

-- Sub-leader: sees active events that contain a sub-team they own
-- Guards that the parent department is also active.
CREATE POLICY "Sub leaders can read events with their sub teams"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.sub_teams AS st
      JOIN public.departments AS d ON d.id = st.department_id
      WHERE d.event_id = events.id
        AND st.owner_id = auth.uid()
        AND st.deleted_at IS NULL
        AND d.deleted_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'sub_leader'
    )
  );
