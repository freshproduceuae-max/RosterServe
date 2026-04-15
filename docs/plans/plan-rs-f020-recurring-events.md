Now I have all the information needed to write a complete, grounded plan.

---

# Implementation Plan: RS-F020 â€” Recurring Events + Forecast View

**Status:** Draft â€” Awaiting approval before implementation  
**Type:** Feature  
**Source:** Feature description provided by user, grounded in codebase audit  
**Migration number range:** 00036  
**Branch convention:** `feat/rs-f020-recurring-events`

---

## Objective

Enable leaders to mark an event as recurring with a weekly, fortnightly, monthly (first Sunday), or annual cadence. When a recurring event is saved, the system immediately generates 12 draft stub events. A new Forecast tab on `/events` lets leaders scan upcoming stubs, spot planning gaps, and plan team rotation across the full window. Department membership is inherited from a new `event_departments` join table rather than replicated through assignment rows. A `copyEvent` action provides one-off duplication. A daily cron job keeps stubs rolling forward as time passes.

---

## Schema Grounding (Critical Prerequisite Facts)

Before reading the architectural decisions, the following facts from the codebase audit constrain the design:

- `departments` is **org-level** since migration 00024. `departments.event_id` was dropped. Departments are not event-scoped.
- `assignments` rows link `event_id + department_id + volunteer_id`. The `event-alerts` cron finds departments for events via `assignments.department_id`. So `getRotationSchedule` (which uses the same join) also finds events via assignments.
- `dept_rotation_overrides` stores which team served at a given `event_id + department_id` combo.
- The highest migration file is `00035_account_deletion_request.sql`. RS-F020 starts at `00036`.
- `createSupabaseAdminClient()` returns null if `SUPABASE_SERVICE_ROLE_KEY` is not set. All cron and server-action admin paths must guard against null.
- The DB trigger `enforce_event_status_transition` allows `draftâ†’published`, `draftâ†’completed`, `publishedâ†’completed` only. Stubs created as `draft` can be published individually. This is correct behavior.

---

## Scope

**In scope:**

- Four recurrence rules: `weekly`, `fortnightly`, `monthly_first_sunday`, `annual`
- Generate 12 forward stubs synchronously on create/update of a recurring event
- `event_departments` join table for department inheritance from parent to stubs
- Forecast tab on `/events` showing stubs sorted by date with rotation suggestions
- `softDeleteEvent` extended to cascade-soft-delete stubs when the parent is deleted
- `copyEvent` server action for one-off event duplication
- Daily cron (`/api/cron/stub-rollover`) that generates the next stub when the nearest existing draft stub is within 14 days
- `getRotationSchedule` window extended from 30 to 84 days and switched from assignments to `event_departments` as the stub-discovery join

**Non-goals for RS-F020:**

- Editing recurrence rule after stubs exist (deferred; requires a "regenerate stubs" confirmation UX)
- Per-stub recurrence exceptions ("skip this occurrence")
- Volunteer assignment copying from parent to stubs (stubs start empty)
- Public-facing calendar or iCal export
- Recurring blockout patterns for volunteers

---

## Applied Decisions

| # | Decision | Justification |
|---|----------|---------------|
| D1 | Introduce `event_departments(event_id, department_id)` join table | Departments decoupled from events since 00024; no other join table exists. Stubs need dept membership before any volunteer is assigned. Assignments cannot serve this role for empty stubs. |
| D2 | Stub generation is synchronous in the server action, using `createSupabaseAdminClient()` | Stubs must exist immediately after the form submits so the Forecast tab is populated without a cron delay. The service-role client bypasses RLS for the batch insert, keeping the action simple. |
| D3 | `getRotationSchedule` switches from `assignments` join to `event_departments` join | The current code misses stubs that have no assignment rows yet. `event_departments` is populated at stub creation time. The window is extended to 84 days (12 Ã— 7). |
| D4 | `event_departments` rows are inserted for stubs at stub-generation time, mirroring the parent | This is the "department inheritance" mechanism. If a dept head later adds a new org-dept to the parent, a separate action cascades that to active stubs. |
| D5 | `copyEvent` is a standalone server action, not a form submission flow | Matches the pattern of `softDeleteEvent` â€” called from a detail-card button with a FormData containing only `sourceEventId`. Redirects to the new event's page. |
| D6 | Forecast tab uses a URL query param `?view=forecast` (not a separate route) | Consistent with the existing `?status=` filter pattern on `/events/page.tsx`. Avoids a new route segment. |
| D7 | Cron runs daily to roll one new stub forward per recurring series | Ensures a 12-occurrence horizon is maintained without a spike of inserts. Uses the same `Authorization: Bearer <CRON_SECRET>` pattern as `event-alerts`. |
| D8 | Soft-deleting a parent event also soft-deletes its `draft` stubs | Completed/published stubs are not touched (they represent served history). A `draft` stub that has never been acted on is meaningless without a parent. |
| D9 | `is_stub` column on `events` is kept at the DB layer but is NOT exposed in the public Zod schema for creation | Leaders never manually create a stub. The column is set server-side during stub generation. |
| D10 | Forecast view is read-only for `dept_head`/`team_head`; only `canManageEvents` users can publish stubs from the detail page | Matches existing permission model. No new role gates introduced. |

---

## Database Migration â€” `00036_recurring_events.sql`

File: `/supabase/migrations/00036_recurring_events.sql`

```sql
-- RS-F020: Recurring events + forecast view
-- Adds recurrence metadata to events, an event_departments join table,
-- and supporting indexes + RLS policies.

-- ============================================================
-- STEP 1: Extend events table
-- ============================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_recurring    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_rule text
    CHECK (recurrence_rule IN ('weekly','fortnightly','monthly_first_sunday','annual')),
  ADD COLUMN IF NOT EXISTS parent_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_stub         boolean NOT NULL DEFAULT false;

-- Constraint: recurrence_rule is required when is_recurring is true
ALTER TABLE public.events
  ADD CONSTRAINT chk_recurrence_rule_required
  CHECK (
    (is_recurring = false) OR (is_recurring = true AND recurrence_rule IS NOT NULL)
  );

-- Constraint: stubs must reference a parent
ALTER TABLE public.events
  ADD CONSTRAINT chk_stub_parent_required
  CHECK (
    (is_stub = false) OR (is_stub = true AND parent_event_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_events_parent_id
  ON public.events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_stubs_active
  ON public.events(parent_event_id, event_date, status)
  WHERE is_stub = true AND deleted_at IS NULL;

-- Deduplication safety net: prevents duplicate stubs for same series + date
-- even under concurrent form submissions (application layer is not atomic).
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_unique_stub_date
  ON public.events(parent_event_id, event_date)
  WHERE is_stub = true AND deleted_at IS NULL;

-- ============================================================
-- STEP 2: event_departments join table
-- Records which org-level departments are candidates for a given event.
-- Used by stubs before any assignment rows exist.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_departments (
  event_id      uuid NOT NULL REFERENCES public.events(id)      ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_event_departments_dept_id
  ON public.event_departments(department_id);

ALTER TABLE public.event_departments ENABLE ROW LEVEL SECURITY;

-- super_admin: full access
CREATE POLICY "super_admin_manage_event_departments"
  ON public.event_departments
  FOR ALL
  USING (public.get_my_role() = 'super_admin')
  WITH CHECK (public.get_my_role() = 'super_admin');

-- all_depts_leader: full access
CREATE POLICY "all_depts_leader_manage_event_departments"
  ON public.event_departments
  FOR ALL
  USING (public.get_my_role() = 'all_depts_leader')
  WITH CHECK (public.get_my_role() = 'all_depts_leader');

-- dept_head: read + insert rows for departments they own
-- IMPORTANT: Must use i_own_dept() helper — never raw EXISTS/IN on departments.
-- Raw subqueries on departments inside policies trigger infinite RLS recursion
-- (see migration 00014 and 00033 for the documented fix pattern).
CREATE POLICY "dept_head_read_event_departments"
  ON public.event_departments
  FOR SELECT
  USING (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

CREATE POLICY "dept_head_insert_event_departments"
  ON public.event_departments
  FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- team_head: read-only for events where they have a team in the department
-- IMPORTANT: Use i_have_sub_team_in_dept() — not a raw JOIN to teams/departments.
CREATE POLICY "team_head_read_event_departments"
  ON public.event_departments
  FOR SELECT
  USING (
    public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- ============================================================
-- STEP 3: Backfill event_departments from existing assignments
-- The rotation schedule query switches from assignments to event_departments.
-- Without this backfill, all existing published events have zero rows in
-- event_departments and the rotation schedule silently breaks at migration time.
-- ON CONFLICT DO NOTHING makes this idempotent (safe to re-run).
-- ============================================================

INSERT INTO public.event_departments (event_id, department_id)
SELECT DISTINCT a.event_id, a.department_id
FROM   public.assignments a
JOIN   public.events e ON e.id = a.event_id
WHERE  e.deleted_at IS NULL
  AND  a.deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

---

## File Map

### Files to Create

| Path | Purpose |
|------|---------|
| `/supabase/migrations/00036_recurring_events.sql` | DB migration (above) |
| `/apps/web/lib/events/recurrence.ts` | Pure date-math utility â€” `computeStubDates(baseDate, rule, count)` |
| `/apps/web/app/api/cron/stub-rollover/route.ts` | Cron route handler for stub rolling |
| `/apps/web/app/(app)/events/_components/forecast-tab.tsx` | Client component rendering the forecast list |
| `/apps/web/app/(app)/events/_components/recurring-badge.tsx` | Small badge component showing "Recurring" / recurrence rule label |

### Files to Modify

| Path | Changes |
|------|---------|
| `/apps/web/lib/events/types.ts` | Add `RecurrenceRule`, extend `Event` type, add `RECURRENCE_RULE_LABELS` |
| `/apps/web/lib/events/schemas.ts` | Add recurrence fields to `createEventSchema` and `updateEventSchema`; add `copyEventSchema` |
| `/apps/web/lib/events/actions.ts` | Extend `createEvent`, `updateEvent`, `softDeleteEvent`; add `generateStubs()` helper; add `copyEvent()` action |
| `/apps/web/lib/events/queries.ts` | Add `getForecastEvents()` query; add `getEventDepartments()` |
| `/apps/web/app/(app)/events/page.tsx` | Add Forecast tab (reads `?view=forecast`), render `ForecastTab` component |
| `/apps/web/app/(app)/events/_components/event-form.tsx` | Add `isRecurring` checkbox and `recurrenceRule` select |
| `/apps/web/app/(app)/events/_components/event-list-table.tsx` | Add recurring badge column |
| `/apps/web/app/(app)/events/_components/event-detail-card.tsx` | Show recurrence metadata; add "Copy this event" button |
| `/apps/web/lib/departments/queries.ts` | Extend `getRotationSchedule` window to 84 days; switch event-discovery join from assignments to event_departments |
| `/apps/web/vercel.json` | Register `/api/cron/stub-rollover` on daily schedule |

---

## Implementation Tasks

### Phase 1 â€” Database Foundation

**Task 1.1 â€” Write migration 00036**

File: `/supabase/migrations/00036_recurring_events.sql`

Write the exact SQL shown in the Database Migration section above. Apply locally with `supabase db push` or `supabase migration up`. Verify with:

```sql
\d public.events          -- confirms is_recurring, recurrence_rule, parent_event_id, is_stub columns
\d public.event_departments  -- confirms table + PK + FK + indexes
\dp public.event_departments -- confirms RLS policies
```

Verification: `supabase db push` exits 0. `supabase status` shows no pending migrations.

---

### Phase 2 â€” Pure Logic Layer

**Task 2.1 â€” Create `/apps/web/lib/events/recurrence.ts`**

This module has zero Supabase dependencies. It takes a base date string (`yyyy-mm-dd`), a recurrence rule, and a count, and returns an array of ISO date strings for the next N occurrences. All date math uses UTC arithmetic only.

```typescript
export type RecurrenceRule = "weekly" | "fortnightly" | "monthly_first_sunday" | "annual";

/**
 * Returns `count` future occurrence date strings (yyyy-mm-dd) after baseDate.
 * baseDate itself is NOT included â€” these are the stub dates.
 */
export function computeStubDates(
  baseDate: string,   // yyyy-mm-dd
  rule: RecurrenceRule,
  count: number = 12
): string[] {
  const dates: string[] = [];
  let cursor = new Date(baseDate + "T00:00:00Z");

  for (let i = 0; i < count; i++) {
    cursor = nextOccurrence(cursor, rule);
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function nextOccurrence(from: Date, rule: RecurrenceRule): Date {
  const d = new Date(from);
  switch (rule) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      return d;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      return d;
    case "monthly_first_sunday": {
      // Advance to the first Sunday of the NEXT calendar month
      d.setUTCMonth(d.getUTCMonth() + 1, 1); // first day of next month
      const dayOfWeek = d.getUTCDay(); // 0=Sun
      const offset = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      d.setUTCDate(d.getUTCDate() + offset);
      return d;
    }
    case "annual":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      return d;
  }
}
```

Verification: Write a Jest unit test (or inline console test) asserting:
- `weekly` from `2025-01-01` produces `2025-01-08` as first stub
- `monthly_first_sunday` from `2025-01-05` produces `2025-02-02` (first Sunday of February 2025)
- `annual` from `2025-01-01` produces `2026-01-01`

---

**Task 2.2 â€” Extend `/apps/web/lib/events/types.ts`**

Add the following to the file:

```typescript
export const RECURRENCE_RULES = [
  "weekly",
  "fortnightly",
  "monthly_first_sunday",
  "annual",
] as const;
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number];

export const RECURRENCE_RULE_LABELS: Record<RecurrenceRule, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly_first_sunday: "Monthly (1st Sunday)",
  annual: "Annual",
};
```

Extend the `Event` type:

```typescript
export type Event = {
  id: string;
  title: string;
  event_type: EventType;
  event_date: string;
  status: EventStatus;
  is_recurring: boolean;
  recurrence_rule: RecurrenceRule | null;
  parent_event_id: string | null;
  is_stub: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
```

Verification: Run `npm run build` â€” TypeScript will flag any component reading `event.is_recurring` or `event.recurrence_rule` that is not handling null correctly.

---

**Task 2.3 â€” Extend `/apps/web/lib/events/schemas.ts`**

```typescript
import { RECURRENCE_RULES } from "./types";

// Add to createEventSchema:
export const createEventSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be under 200 characters."),
  eventType: z.enum(EVENT_TYPES, { error: "Please select an event type." }),
  eventDate: z.string().min(1, "Event date is required.").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Please enter a valid date." }
  ),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.enum(RECURRENCE_RULES).optional(),
}).refine(
  (data) => !data.isRecurring || !!data.recurrenceRule,
  { message: "Please select a recurrence pattern.", path: ["recurrenceRule"] }
);

// updateEventSchema â€” same shape
export const updateEventSchema = z.object({
  id: z.string().uuid("Invalid event ID."),
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be under 200 characters."),
  eventType: z.enum(EVENT_TYPES, { error: "Please select an event type." }),
  eventDate: z.string().min(1, "Event date is required.").refine(
    (val) => !isNaN(Date.parse(val)),
    { message: "Please enter a valid date." }
  ),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.enum(RECURRENCE_RULES).optional(),
}).refine(
  (data) => !data.isRecurring || !!data.recurrenceRule,
  { message: "Please select a recurrence pattern.", path: ["recurrenceRule"] }
);

// New: copy event schema
export const copyEventSchema = z.object({
  sourceEventId: z.string().uuid("Invalid source event ID."),
});
```

Note: FormData does not encode booleans. In the action layer, parse `isRecurring` as `formData.get("isRecurring") === "true"` before passing to `safeParse`.

---

### Phase 3 â€” Server Actions

**Task 3.1 â€” Extend `/apps/web/lib/events/actions.ts`**

Add a private helper `generateStubs` that is called from `createEvent` and `updateEvent`. Add the `copyEvent` action.

**Helper `generateStubs`** (not exported, used internally):

```typescript
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { computeStubDates } from "./recurrence";
import type { RecurrenceRule } from "./types";

async function generateStubs(
  parentEventId: string,
  parentTitle: string,
  parentEventType: string,
  parentEventDate: string,
  recurrenceRule: RecurrenceRule,
  createdBy: string
): Promise<void> {
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    console.error("[generateStubs] Admin client unavailable â€” stubs not generated for", parentEventId);
    return;
  }

  // Collect existing active stub dates to avoid duplicates
  const { data: existing } = await adminClient
    .from("events")
    .select("event_date")
    .eq("parent_event_id", parentEventId)
    .eq("is_stub", true)
    .is("deleted_at", null);

  const existingDates = new Set((existing ?? []).map((r: { event_date: string }) => r.event_date));

  const stubDates = computeStubDates(parentEventDate, recurrenceRule, 12);
  const newDates = stubDates.filter((d) => !existingDates.has(d));

  if (newDates.length === 0) return;

  const stubs = newDates.map((date) => ({
    title: parentTitle,
    event_type: parentEventType,
    event_date: date,
    status: "draft" as const,
    is_recurring: true,
    recurrence_rule: recurrenceRule,
    parent_event_id: parentEventId,
    is_stub: true,
    created_by: createdBy,
  }));

  const { data: insertedStubs, error: stubError } = await adminClient
    .from("events")
    .insert(stubs)
    .select("id, event_date");

  if (stubError) {
    console.error("[generateStubs] Stub insert failed:", stubError);
    return;
  }

  // Inherit event_departments from parent
  const { data: parentDepts } = await adminClient
    .from("event_departments")
    .select("department_id")
    .eq("event_id", parentEventId);

  const deptIds = (parentDepts ?? []).map((r: { department_id: string }) => r.department_id);

  if (deptIds.length > 0 && insertedStubs && insertedStubs.length > 0) {
    const edRows = (insertedStubs as { id: string }[]).flatMap((stub) =>
      deptIds.map((deptId: string) => ({
        event_id: stub.id,
        department_id: deptId,
      }))
    );
    const { error: edError } = await adminClient.from("event_departments").insert(edRows);
    if (edError) {
      console.error("[generateStubs] event_departments insert failed:", edError);
    }
  }
}
```

**Updated `createEvent`**: After the `supabase.from("events").insert(...)` succeeds, call `generateStubs` if `parsed.data.isRecurring` is true:

```typescript
// Inside createEvent, after inserting parent event:
const { data, error } = await supabase
  .from("events")
  .insert({
    title: parsed.data.title,
    event_type: parsed.data.eventType,
    event_date: parsed.data.eventDate,
    is_recurring: parsed.data.isRecurring,
    recurrence_rule: parsed.data.recurrenceRule ?? null,
    created_by: session.user.id,
  })
  .select("id")
  .single();

if (error) return { error: "This event could not be created. Please try again." };

if (parsed.data.isRecurring && parsed.data.recurrenceRule) {
  await generateStubs(
    data.id,
    parsed.data.title,
    parsed.data.eventType,
    parsed.data.eventDate,
    parsed.data.recurrenceRule,
    session.user.id
  );
}

redirect(`/events/${data.id}`);
```

**Updated `updateEvent`**: After updating the parent, re-run stub generation for the new date if `isRecurring` is true. Because `computeStubDates` uses the new `eventDate` as the base, and `generateStubs` skips dates already in `existingDates`, this is safe to call on every update â€” new stubs are only created when the base date shifts forward.

**Updated `softDeleteEvent`**: After soft-deleting the parent, also soft-delete its `draft` stubs. Use the admin client because RLS would prevent one user from deleting stubs owned by the system:

```typescript
// After soft-deleting parent:
const adminClient = createSupabaseAdminClient();
if (adminClient) {
  await adminClient
    .from("events")
    .update({ deleted_at: new Date().toISOString() })
    .eq("parent_event_id", id)
    .eq("is_stub", true)
    .eq("status", "draft")
    .is("deleted_at", null);
}
```

**New `copyEvent` action**:

```typescript
export async function copyEvent(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to copy events." };
  }

  const parsed = copyEventSchema.safeParse({ sourceEventId: formData.get("sourceEventId") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServerClient();

  // Fetch source event
  const { data: source, error: fetchError } = await supabase
    .from("events")
    .select("title, event_type, event_date")
    .eq("id", parsed.data.sourceEventId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !source) return { error: "Source event not found." };

  // Insert copy â€” standalone, not recurring, not a stub
  const { data: copy, error: insertError } = await supabase
    .from("events")
    .insert({
      title: `${source.title} (copy)`,
      event_type: source.event_type,
      event_date: source.event_date,
      status: "draft",
      is_recurring: false,
      created_by: session.user.id,
    })
    .select("id")
    .single();

  if (insertError || !copy) return { error: "Could not copy event. Please try again." };

  // Copy event_departments rows
  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    const { data: srcDepts } = await adminClient
      .from("event_departments")
      .select("department_id")
      .eq("event_id", parsed.data.sourceEventId);

    if (srcDepts && srcDepts.length > 0) {
      await adminClient.from("event_departments").insert(
        srcDepts.map((r: { department_id: string }) => ({
          event_id: copy.id,
          department_id: r.department_id,
        }))
      );
    }
  }

  redirect(`/events/${copy.id}`);
}
```

Verification: After each action extension, run `npm run build`. No TypeScript errors. Test `createEvent` with `isRecurring=true` locally: confirm 12 stub rows in the `events` table with the correct parent_event_id.

---

### Phase 4 â€” Query Layer

**Task 4.1 â€” Add `getForecastEvents` to `/apps/web/lib/events/queries.ts`**

```typescript
export type ForecastEvent = Event & {
  departmentCount: number;
};

export async function getForecastEvents(limitDays: number = 84): Promise<ForecastEvent[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const today = new Date().toISOString().slice(0, 10);
  const windowEnd = new Date(Date.now() + limitDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Note: Supabase PostgREST does not support table(count) aggregate syntax in .select().
  // Fetch events first, then scope the department count query to those event IDs only.
  // This prevents an unbounded scan of all event_departments rows as the DB grows.
  const eventsResult = await supabase
    .from("events")
    .select("*")
    .eq("is_stub", true)
    .is("deleted_at", null)
    .gte("event_date", today)
    .lte("event_date", windowEnd)
    .order("event_date", { ascending: true });

  if (eventsResult.error || !eventsResult.data) return [];

  const stubIds = eventsResult.data.map((e) => e.id);

  const deptResult = stubIds.length > 0
    ? await supabase.from("event_departments").select("event_id").in("event_id", stubIds)
    : { data: [] as { event_id: string }[], error: null };

  const deptCountMap = (deptResult.data ?? []).reduce<Record<string, number>>(
    (acc, row) => { acc[row.event_id] = (acc[row.event_id] ?? 0) + 1; return acc; },
    {},
  );

  return (eventsResult.data as Event[]).map((e) => ({
    ...e,
    departmentCount: deptCountMap[e.id] ?? 0,
  }));
}
```

**Task 4.2 â€” Add `getEventDepartments` to `/apps/web/lib/events/queries.ts`**

This powers the "add department to event" workflow that needs to cascade to stubs:

```typescript
import type { Department } from "@/lib/departments/types";

export async function getEventDepartments(eventId: string): Promise<Department[]> {
  const session = await getSessionWithProfile();
  if (!session || !isLeaderRole(session.profile.role)) return [];

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("event_departments")
    .select("departments(*)")
    .eq("event_id", eventId);

  if (error || !data) return [];
  return (data as { departments: Department }[]).map((r) => r.departments);
}
```

**Task 4.3 â€” Extend `getRotationSchedule` in `/apps/web/lib/departments/queries.ts`**

Change the `windowEnd` constant from `30` to `84` days. Change the event-discovery step (Step 2 in the function) from joining `assignments` to joining `event_departments`:

Replace the `assignRows` query block:

```typescript
// BEFORE (line 198-207 approx):
const { data: assignRows } = await supabase
  .from("assignments")
  .select("event_id, department_id, events!inner(id, title, event_date, event_type, status)")
  .in("department_id", activeDeptIds)
  .is("deleted_at", null)
  .gte("events.event_date", today)
  .lte("events.event_date", windowEnd)
  .eq("events.status", "published");

// AFTER:
const { data: edRows } = await supabase
  .from("event_departments")
  .select("event_id, department_id, events!inner(id, title, event_date, event_type, status)")
  .in("department_id", activeDeptIds)
  .gte("events.event_date", today)
  .lte("events.event_date", windowEnd)
  .in("events.status", ["published", "draft"])   // include draft stubs for forecast
  .is("events.deleted_at", null);
```

Update all downstream references to `assignRows` / `assignRows_` to use `edRows` and the new type shape. The `event_id` and `department_id` field names are identical so minimal changes are needed.

Rationale for including `draft` status: Forecast stubs are always `draft` until a leader explicitly publishes them. Excluding draft would make the forecast empty. The rotation suggestion is still useful for planning even before publishing.

Verification: Load the Departments page and confirm rotation schedule entries appear for both published events and forecast stubs. The 84-day window should now show up to 12 weekly stubs.

---

### Phase 5 â€” UI Components

**Task 5.1 â€” Create `/apps/web/app/(app)/events/_components/recurring-badge.tsx`**

```tsx
import { RECURRENCE_RULE_LABELS, type RecurrenceRule } from "@/lib/events/types";

export function RecurringBadge({ rule }: { rule: RecurrenceRule }) {
  return (
    <span className="inline-flex items-center rounded-100 border border-brand-calm-600/30 bg-brand-calm-600/10 px-200 py-50 font-mono text-mono text-brand-calm-600 uppercase">
      {RECURRENCE_RULE_LABELS[rule]}
    </span>
  );
}
```

**Task 5.2 â€” Update `/apps/web/app/(app)/events/_components/event-form.tsx`**

Add two new controlled fields below the `eventDate` field. Because this is a client component that uses `useActionState`, use local `useState` for the `isRecurring` checkbox:

```tsx
"use client";
import { useState } from "react";
// ... existing imports ...
import { RECURRENCE_RULES, RECURRENCE_RULE_LABELS } from "@/lib/events/types";

export function EventForm({ event }: { event?: Event }) {
  const [isRecurring, setIsRecurring] = useState(event?.is_recurring ?? false);
  // ... existing useActionState setup ...

  // In the form JSX, after the eventDate field:

  // Parse isRecurring as string "true" for FormData compatibility
  // The hidden input below carries the boolean as a string
}
```

Add to the form JSX (after the date field, before the error/submit):

```tsx
<input type="hidden" name="isRecurring" value={isRecurring ? "true" : "false"} />

<div className="flex items-center gap-200">
  <input
    id="isRecurring"
    type="checkbox"
    checked={isRecurring}
    onChange={(e) => setIsRecurring(e.target.checked)}
    className="h-400 w-400 rounded-100 border-neutral-300 accent-brand-calm-600"
  />
  <label htmlFor="isRecurring" className="text-body-sm font-semibold text-neutral-800">
    Recurring event
  </label>
</div>

{isRecurring && (
  <div className="flex flex-col gap-100">
    <label htmlFor="recurrenceRule" className="text-body-sm font-semibold text-neutral-800">
      Recurrence pattern
    </label>
    <select
      id="recurrenceRule"
      name="recurrenceRule"
      required
      defaultValue={event?.recurrence_rule ?? ""}
      className={INPUT_CLASS}
    >
      <option value="" disabled>Select pattern</option>
      {RECURRENCE_RULES.map((rule) => (
        <option key={rule} value={rule}>
          {RECURRENCE_RULE_LABELS[rule]}
        </option>
      ))}
    </select>
  </div>
)}
```

Note: The edit form is intentionally simple here â€” changing the recurrence rule on an existing recurring event is a non-goal for RS-F020. The `recurrenceRule` field on the edit form will be shown as read-only (display only) if stubs already exist. Implement this guard: if `event?.is_recurring && event?.recurrence_rule`, render the rule as a static text label instead of a select.

**Task 5.3 â€” Update `/apps/web/app/(app)/events/_components/event-list-table.tsx`**

Add a `Recurring` column header on desktop. In the row, render `<RecurringBadge rule={event.recurrence_rule} />` if `event.is_recurring`. On mobile cards, add the badge inline next to the status badge. Keep the column narrow (no `pr-300` overflow).

**Task 5.4 â€” Update `/apps/web/app/(app)/events/_components/event-detail-card.tsx`**

Add to the details grid (as a new grid item):
- If `event.is_recurring && event.recurrence_rule`: show "Recurrence" label + `<RecurringBadge />`
- If `event.is_stub && event.parent_event_id`: show "Series" label + a link to `/events/${event.parent_event_id}`

Add a "Copy this event" button in the actions section (visible to `canManage` users). It submits `copyEvent` via `useActionState` with `sourceEventId = event.id`.

**Task 5.5 â€” Create `/apps/web/app/(app)/events/_components/forecast-tab.tsx`**

This is a server component (or can be client if we pass data as props from the page). Since the page is already a server component, pass data as props:

```tsx
import Link from "next/link";
import { RecurringBadge } from "./recurring-badge";
import { formatEventDate } from "@/lib/format-date";
import { EVENT_TYPE_LABELS } from "@/lib/events/types";
import type { ForecastEvent } from "@/lib/events/queries";

export function ForecastTab({ events }: { events: ForecastEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-300 border border-dashed border-neutral-300 p-500 text-center">
        <p className="text-body text-neutral-600">No upcoming recurring events in the next 12 weeks.</p>
        <p className="mt-100 text-body-sm text-neutral-500">
          Mark an event as recurring when creating it to see stubs here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-200">
      {events.map((event) => (
        <Link
          key={event.id}
          href={`/events/${event.id}`}
          className="flex flex-col gap-100 rounded-300 border border-neutral-300 bg-neutral-0 p-300 transition-colors duration-fast hover:border-brand-calm-600/30"
        >
          <div className="flex flex-wrap items-center justify-between gap-200">
            <span className="text-body font-semibold text-neutral-950">{event.title}</span>
            <span className="rounded-100 border border-neutral-300 px-200 py-50 font-mono text-mono text-neutral-600 uppercase">
              Draft stub
            </span>
          </div>
          <div className="flex flex-wrap gap-300 text-body-sm text-neutral-600">
            <span>{formatEventDate(event.event_date)}</span>
            <span>{EVENT_TYPE_LABELS[event.event_type]}</span>
            {event.is_recurring && event.recurrence_rule && (
              <RecurringBadge rule={event.recurrence_rule} />
            )}
            {event.departmentCount > 0 && (
              <span>{event.departmentCount} dept{event.departmentCount !== 1 ? "s" : ""} planned</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}
```

**Task 5.6 â€” Update `/apps/web/app/(app)/events/page.tsx`**

Add a `view` param to the `searchParams` type. Read `?view=forecast`. Show a second row of tabs: "Events" and "Forecast". When `view === "forecast"`, fetch `getForecastEvents()` and render `<ForecastTab />`. When not forecast, render the existing events list.

```tsx
// In EventsPage:
const params = await searchParams;
const view = params.view === "forecast" ? "forecast" : "list";
const statusFilter = /* existing logic */;

const events = view === "list"
  ? await getEvents(statusFilter ? { status: statusFilter } : undefined)
  : [];
const forecastEvents = view === "forecast"
  ? await getForecastEvents()
  : [];

// JSX:
// Add view tabs before the status filter row:
<div className="flex gap-100">
  <ViewTab label="Events" href="/events" active={view === "list"} />
  <ViewTab label="Forecast" href="/events?view=forecast" active={view === "forecast"} />
</div>

{view === "list" && (/* existing status tabs + event list */)}
{view === "forecast" && <ForecastTab events={forecastEvents} />}
```

Add a `ViewTab` function component similar to the existing `FilterTab`, using the same styling.

---

### Phase 6 â€” Cron Job

**Task 6.1 â€” Create `/apps/web/app/api/cron/stub-rollover/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { computeStubDates } from "@/lib/events/recurrence";
import type { RecurrenceRule } from "@/lib/events/types";

/**
 * GET /api/cron/stub-rollover
 *
 * Secured by Authorization: Bearer <CRON_SECRET>.
 * For each active recurring parent event, checks whether the furthest-future
 * active stub is within 14 days of today. If so, appends one new stub to
 * keep the 12-occurrence horizon rolling forward.
 *
 * Returns JSON: { extended: number, skipped: number, errors: number }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminClient = createSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Admin client unavailable â€” SUPABASE_SERVICE_ROLE_KEY not set" },
      { status: 500 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Find recurring parent events that have stubs whose max date <= horizon
  const { data: parents, error: parentError } = await adminClient
    .from("events")
    .select("id, title, event_type, event_date, recurrence_rule, created_by")
    .eq("is_recurring", true)
    .eq("is_stub", false)
    .is("deleted_at", null);

  if (parentError) {
    return NextResponse.json({ error: "Parent query failed" }, { status: 500 });
  }

  let extended = 0, skipped = 0, errors = 0;

  for (const parent of (parents ?? []) as {
    id: string; title: string; event_type: string;
    event_date: string; recurrence_rule: RecurrenceRule; created_by: string;
  }[]) {
    try {
      const { data: stubs } = await adminClient
        .from("events")
        .select("event_date")
        .eq("parent_event_id", parent.id)
        .eq("is_stub", true)
        .is("deleted_at", null)
        .order("event_date", { ascending: false })
        .limit(1);

      const latestStubDate = stubs?.[0]?.event_date ?? parent.event_date;

      if (latestStubDate > horizon) {
        skipped++;
        continue;
      }

      // Generate one new stub from the latest existing stub date
      const [nextDate] = computeStubDates(latestStubDate, parent.recurrence_rule, 1);

      const { data: inserted, error: insertError } = await adminClient
        .from("events")
        .insert({
          title: parent.title,
          event_type: parent.event_type,
          event_date: nextDate,
          status: "draft",
          is_recurring: true,
          recurrence_rule: parent.recurrence_rule,
          parent_event_id: parent.id,
          is_stub: true,
          created_by: parent.created_by,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        errors++;
        continue;
      }

      // Inherit departments
      const { data: parentDepts } = await adminClient
        .from("event_departments")
        .select("department_id")
        .eq("event_id", parent.id);

      const deptIds = (parentDepts ?? []).map((r: { department_id: string }) => r.department_id);
      if (deptIds.length > 0) {
        await adminClient.from("event_departments").insert(
          deptIds.map((deptId: string) => ({
            event_id: (inserted as { id: string }).id,
            department_id: deptId,
          }))
        );
      }

      extended++;
    } catch (err) {
      console.error("[cron/stub-rollover] error for parent", parent.id, err);
      errors++;
    }
  }

  return NextResponse.json({ extended, skipped, errors });
}
```

**Task 6.2 â€” Register cron in `/apps/web/vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/event-alerts",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/stub-rollover",
      "schedule": "0 1 * * *"
    }
  ]
}
```

Run daily at 01:00 UTC, before the day's activity.

---

### Phase 7 â€” Add `event_departments` Management to Event Actions

The above phases create stubs with inherited `event_departments` rows, but the current `createDepartment` / `createEvent` flow does not write to `event_departments`. We need a new server action that leaders can call to link an org-department to an event (and cascade to its stubs).

**Task 7.1 â€” Add `addEventDepartment` and `removeEventDepartment` to `/apps/web/lib/events/actions.ts`**

```typescript
export async function addEventDepartment(
  _prev: EventActionResult,
  formData: FormData
): Promise<EventActionResult> {
  const session = await getSessionWithProfile();
  if (!session || !canManageEvents(session.profile)) {
    return { error: "You do not have permission to manage event departments." };
  }

  const eventId = formData.get("eventId");
  const departmentId = formData.get("departmentId");
  if (typeof eventId !== "string" || typeof departmentId !== "string") {
    return { error: "Invalid input." };
  }

  // Use admin client to insert into event_departments (bypasses RLS for stubs)
  const adminClient = createSupabaseAdminClient();
  if (!adminClient) return { error: "Service unavailable." };

  // Insert for the parent event
  const { error } = await adminClient
    .from("event_departments")
    .insert({ event_id: eventId, department_id: departmentId });

  if (error && error.code !== "23505") {  // 23505 = unique violation (already linked)
    return { error: "Could not link department to event." };
  }

  // Cascade to active draft stubs
  const { data: stubs } = await adminClient
    .from("events")
    .select("id")
    .eq("parent_event_id", eventId)
    .eq("is_stub", true)
    .eq("status", "draft")
    .is("deleted_at", null);

  if (stubs && stubs.length > 0) {
    const stubRows = (stubs as { id: string }[]).map((s) => ({
      event_id: s.id,
      department_id: departmentId,
    }));
    await adminClient
      .from("event_departments")
      .upsert(stubRows, { onConflict: "event_id,department_id", ignoreDuplicates: true });
  }

  return { success: true };
}
```

This action is not directly wired to the UI in RS-F020 (the assignment and department UI flows are in a different feature scope), but it needs to exist for the forecast department count to be accurate after a dept head adds a department to the parent event via the existing department flow.

---

## Data Flow

**Creating a recurring event:**

1. User fills `EventForm` with `isRecurring=true`, `recurrenceRule=weekly`
2. `createEvent` server action parses FormData via `createEventSchema`
3. Inserts parent event row with `is_recurring=true, recurrence_rule='weekly', is_stub=false`
4. Calls `generateStubs(parentId, ...)` which calls `computeStubDates` for 12 dates
5. Admin client inserts 12 stub rows into `events`
6. For each stub, admin client inserts `event_departments` rows copying from parent (empty at this point)
7. Redirect to `/events/<parentId>`

**Viewing the forecast:**

1. User navigates to `/events?view=forecast`
2. `EventsPage` reads `view=forecast` from searchParams
3. Calls `getForecastEvents(84)` â€” queries `events` where `is_stub=true`, `event_date` in next 84 days
4. Passes result to `<ForecastTab>` which renders the stub list
5. Each stub links to `/events/<stubId>` where the detail card shows its parent link

**Rotation schedule (extended):**

1. Dept Head opens the rotation planning view
2. `getRotationSchedule(deptIds)` queries `event_departments` instead of `assignments`
3. Returns entries for both published events and draft stubs in the 84-day window
4. Dept Head can set overrides for future stubs, same as for published events

**Stub rollover (daily cron):**

1. Vercel triggers `GET /api/cron/stub-rollover` at 01:00 UTC
2. Fetches all non-stub recurring parent events
3. For each parent, fetches the latest-dated active stub
4. If that date is within 14 days of today, generates one new stub
5. Inherits `event_departments` from parent
6. Returns `{ extended, skipped, errors }`

---

## Self-Review Table

| Concern | Risk | Mitigation |
|---------|------|-----------|
| `generateStubs` called synchronously in server action | Blocking 12 DB inserts on form submit adds latency | Acceptable for v1 â€” 12 inserts is a trivial batch. Use `waitUntil` in a future iteration if p99 latency becomes a concern. |
| Stub date deduplication is done by checking existing DB rows | A race condition could produce duplicate stubs | The `PRIMARY KEY(event_id, department_id)` on `event_departments` prevents duplicate dept rows. Stubs themselves have no unique key on `(parent_event_id, event_date)` but `generateStubs` reads existing dates before inserting. Add a unique index `UNIQUE(parent_event_id, event_date) WHERE is_stub=true` to migration 00036 as a safety net. |
| Changing `getRotationSchedule` to use `event_departments` | Could break existing rotation schedule if no `event_departments` rows exist for published events | Migration 00036 creates the table empty. Existing published events have no rows. Add a DB migration step that backfills `event_departments` from existing `assignments.department_id` for published/draft events. See Edge Case EC-1 below. |
| `softDeleteEvent` uses admin client to cascade to stubs | If admin client is unavailable, stubs are orphaned | Log the failure. The stubs will still show as draft in forecast, which is confusing. Add a `TODO` comment to implement a DB-level cascade or a Postgres trigger in a follow-up. |
| `canManageThisEvent` check for stubs | A stub is created by the server (using the parent creator's `created_by`). A dept_head who did not create the original event cannot manage the stub through the current `canManageThisEvent` check. | Extend `canManageThisEvent` in `/apps/web/lib/auth/roles.ts` to also allow canManage if the event `is_stub=true` and the user can manage the parent. For RS-F020, a simpler fix: stubs' `created_by` is set to the same user as the parent, so the check still works for the creator. Document this assumption. |
| Forecast tab shows stubs to all leader roles | `team_head` and `dept_head` can see stubs for events they are not related to | Intentional. Forecast is a planning view. The existing `isLeaderRole()` gate is sufficient. Stub editing is blocked by `canManageThisEvent`. |
| `monthly_first_sunday` algo | If the parent event falls on a non-Sunday, the first stub will be the first Sunday of the next month, not 4 weeks later | This is the defined behavior for the rule. The rule name is explicit. Document in the UI tooltip: "Generates events on the first Sunday of each month." |

---

## Edge Cases and Contingencies

**EC-1 â€” Backfill `event_departments` for existing events**

The rotation schedule migration switches from `assignments` to `event_departments`. All existing events have zero rows in `event_departments`. This will break the rotation schedule for existing published events until rows are added.

Add to the migration SQL as Step 3:

```sql
-- STEP 3: Backfill event_departments from assignments for all non-deleted events
INSERT INTO public.event_departments (event_id, department_id)
SELECT DISTINCT a.event_id, a.department_id
FROM   public.assignments a
JOIN   public.events e ON e.id = a.event_id
WHERE  e.deleted_at IS NULL
  AND  a.deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

This is idempotent (ON CONFLICT DO NOTHING). It populates the join table retroactively from existing assignment history.

**EC-2 â€” Recurring event updated to non-recurring**

If a leader unchecks "Recurring event" on an edit, `isRecurring=false` and `recurrenceRule=null` will be written to the parent. The existing stubs are NOT deleted automatically (they could have been published). The UI should show a warning: "Removing the recurrence rule will stop new stubs from being created. Existing stubs are not deleted."

The `updateEvent` action should skip calling `generateStubs` when `isRecurring=false`. The cron will also skip this parent (it checks `is_recurring=true`).

**EC-3 â€” `monthly_first_sunday` with a base date that is a Sunday**

If the base event date is already a Sunday (e.g., `2025-02-02`), the first stub should be the first Sunday of March 2025 (`2025-03-02`), not the same day. The `nextOccurrence` function advances to the next calendar month's first day first, then finds the first Sunday, so it naturally skips the base date. Verify with a unit test.

**EC-4 â€” Stub event_date collision with an existing non-stub event**

Two events can share the same date (no uniqueness constraint on `event_date`). This is by design (multiple events on the same day). No action needed.

**EC-5 â€” `annual` recurrence over leap years**

`2024-02-29 + 1 year` using `setUTCFullYear(2025)` produces `2025-02-29` which JavaScript normalizes to `2025-03-01`. This is the correct (and only reasonable) behavior for a non-existent date. Document it.

**EC-6 â€” Admin client null guard in `generateStubs`**

If `SUPABASE_SERVICE_ROLE_KEY` is not set in the deployment environment, `generateStubs` logs an error and returns without stubs. The parent event is still created successfully. The user sees the event detail page with no forecast stubs. This is a degraded-but-not-broken state. The Forecast tab will simply be empty until the env var is set and the cron runs.

---

## Build Sequence Checklist

- [ ] **Phase 1**: Write and apply migration `00036_recurring_events.sql` (including EC-1 backfill in Step 3). Verify locally with `supabase db push`.
- [ ] **Phase 2a**: Create `recurrence.ts`. Write unit tests for all four rules including edge cases EC-3 and EC-5. Run tests.
- [ ] **Phase 2b**: Extend `types.ts` with `RecurrenceRule`, `RECURRENCE_RULES`, `RECURRENCE_RULE_LABELS`, and the extended `Event` type.
- [ ] **Phase 2c**: Extend `schemas.ts` with recurrence fields and `copyEventSchema`.
- [ ] **Phase 3**: Extend `actions.ts` â€” add `generateStubs` helper, update `createEvent`, update `updateEvent`, update `softDeleteEvent`, add `copyEvent`, add `addEventDepartment`.
- [ ] **Phase 4a**: Add `getForecastEvents` and `getEventDepartments` to `queries.ts`.
- [ ] **Phase 4b**: Update `getRotationSchedule` in `departments/queries.ts` â€” change window to 84 days and switch join to `event_departments`.
- [ ] **Phase 5a**: Create `recurring-badge.tsx`.
- [ ] **Phase 5b**: Update `event-form.tsx` with checkbox and conditional select.
- [ ] **Phase 5c**: Update `event-list-table.tsx` with recurring badge column.
- [ ] **Phase 5d**: Update `event-detail-card.tsx` with recurrence metadata and Copy button.
- [ ] **Phase 5e**: Create `forecast-tab.tsx`.
- [ ] **Phase 5f**: Update `events/page.tsx` with view tabs and conditional forecast render.
- [ ] **Phase 6a**: Create `api/cron/stub-rollover/route.ts`.
- [ ] **Phase 6b**: Update `vercel.json` with the new cron entry.
- [ ] **Verification**: `npm run build` passes with zero TypeScript errors.
- [ ] **Verification**: `npm run lint` passes.
- [ ] **Verification**: Manual smoke test â€” create a weekly recurring event, confirm 12 stubs in Supabase table, confirm Forecast tab shows them, confirm rotation schedule shows them, confirm soft-delete cascades to draft stubs.
- [ ] **Verification**: Trigger cron manually via `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/stub-rollover` and confirm `{ extended: 0, skipped: N, errors: 0 }` on a fresh series.

---

## Files Referenced in This Plan

The following absolute paths are the implementation targets:

- `/supabase/migrations/00036_recurring_events.sql` â€” create new
- `/apps/web/lib/events/recurrence.ts` â€” create new
- `/apps/web/lib/events/types.ts` â€” modify
- `/apps/web/lib/events/schemas.ts` â€” modify
- `/apps/web/lib/events/actions.ts` â€” modify
- `/apps/web/lib/events/queries.ts` â€” modify
- `/apps/web/lib/departments/queries.ts` â€” modify (lines 154â€“156 window, lines 196â€“207 join)
- `/apps/web/app/(app)/events/page.tsx` â€” modify
- `/apps/web/app/(app)/events/_components/event-form.tsx` â€” modify
- `/apps/web/app/(app)/events/_components/event-list-table.tsx` â€” modify
- `/apps/web/app/(app)/events/_components/event-detail-card.tsx` â€” modify
- `/apps/web/app/(app)/events/_components/recurring-badge.tsx` â€” create new
- `/apps/web/app/(app)/events/_components/forecast-tab.tsx` â€” create new
- `/apps/web/app/api/cron/stub-rollover/route.ts` â€” create new
- `/apps/web/vercel.json` â€” modify