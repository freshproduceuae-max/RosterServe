-- RS-F002: Event lifecycle management
-- Creates the event entity that anchors all downstream planning workflows.

-- Enum for event types
CREATE TYPE public.event_type AS ENUM (
  'regular',
  'ad_hoc',
  'special_day'
);

-- Enum for event lifecycle status
CREATE TYPE public.event_status AS ENUM (
  'draft',
  'published',
  'completed'
);

-- Events table
CREATE TABLE public.events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  event_type  public.event_type NOT NULL,
  event_date  date NOT NULL,
  status      public.event_status NOT NULL DEFAULT 'draft',
  created_by  uuid NOT NULL REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Indexes
CREATE INDEX idx_events_date ON public.events(event_date);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_events_active ON public.events(event_date, status) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Trigger: enforce valid status transitions at the database level
-- Valid: draft->published, draft->completed, published->completed
-- Invalid: published->draft, completed->anything
CREATE OR REPLACE FUNCTION public.enforce_event_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT (
      (OLD.status = 'draft' AND NEW.status = 'published') OR
      (OLD.status = 'draft' AND NEW.status = 'completed') OR
      (OLD.status = 'published' AND NEW.status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid event status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_event_status
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_event_status_transition();

-- Reuse the existing updated_at trigger function from 00001
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- SELECT: super_admin can read all events including soft-deleted (for admin oversight)
CREATE POLICY "Super admins can read all events"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- SELECT: dept_head and sub_leader can read active events only
-- Note: This is a pre-RS-F003 baseline. When RS-F003 introduces department
-- ownership, visibility for dept_head/sub_leader should be tightened to events
-- containing departments they own. This is a planned hierarchy refinement.
CREATE POLICY "Leaders can read active events"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid()
      AND p.role IN ('dept_head', 'sub_leader')
    )
  );

-- INSERT: only super_admin can create events
CREATE POLICY "Super admins can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles AS p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- UPDATE: only super_admin can update active (non-deleted) events
CREATE POLICY "Super admins can update active events"
  ON public.events FOR UPDATE
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
