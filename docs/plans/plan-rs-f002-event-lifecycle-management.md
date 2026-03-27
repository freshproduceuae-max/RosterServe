# Plan: RS-F002 - Event Lifecycle Management

Status: Implemented
Feature: RS-F002
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

## Objective

Allow authorized leaders and admins to create, edit, and manage event records that serve as the root planning unit for all downstream rostering workflows. Events represent weekly programmes (such as "Sunday Service — April 6") and progress through a controlled lifecycle of draft, published, and completed states.

## Scope And Non-Goals

### In Scope

- Database schema for the `events` table with all required fields, constraints, indexes, and soft-delete support
- RLS policies governing who can create, read, update, and soft-delete events
- Event type enum (`regular`, `ad_hoc`, `special_day`)
- Event status enum (`draft`, `published`, `completed`) with enforced valid transitions
- Zod validation schemas for event creation and editing
- Server actions for creating, updating, transitioning event status, and soft-deleting
- Event list page (`/events`) with role-filtered display
- Event creation page (`/events/new`)
- Event detail page (`/events/[id]`)
- Event edit page (`/events/[id]/edit`)
- Navigation integration into the existing `(app)` layout
- Status badge component with semantic coloring
- Confirmation modal for irreversible status transitions and soft-delete
- Loading, empty, error, and success states for all views and actions
- TypeScript types for the event entity

### Non-Goals

- Department or sub-team creation within events (RS-F003)
- Volunteer-facing event views (volunteers access events via dashboards in RS-F010)
- Assignment, instruction, or notification records referencing events (later features)
- Recurring event automation
- Bulk event operations
- Event search or advanced filtering

## Approach

### Database

Create migration `supabase/migrations/00002_events.sql` with:

1. `event_type` enum: `regular`, `ad_hoc`, `special_day`
2. `event_status` enum: `draft`, `published`, `completed`
3. `events` table with columns: `id` (uuid PK), `title` (text, 1-200 chars), `event_type`, `event_date` (date), `status` (default `draft`), `created_by` (FK to profiles.id), `created_at`, `updated_at`, `deleted_at` (nullable soft-delete)
4. Indexes on `event_date`, `status`, `created_by`, and a composite partial index for active events
5. Status transition trigger that enforces valid transitions at the database level
6. Reuse existing `update_updated_at()` trigger
7. RLS policies:
   - SELECT: super_admin sees all events (including soft-deleted for oversight); dept_head and sub_leader see active events only; volunteers have no access
   - INSERT: super_admin only, `created_by` must match `auth.uid()`
   - UPDATE: super_admin only, active events only
   - No hard DELETE via RLS

### Status Transition Rules

| From | To | Allowed | Use Case |
|------|-----|---------|----------|
| draft | published | Yes | Event ready for planning |
| draft | completed | Yes | Retroactive record-keeping |
| published | completed | Yes | Event has occurred |
| published | draft | No | Cannot unpublish |
| completed | * | No | Completed is terminal |

Enforcement: Postgres BEFORE UPDATE trigger raises exception on invalid transitions.

### Application Layer

Follow established patterns:
- Server actions with `"use server"` directive and Zod validation
- `createSupabaseServerClient()` for database access
- `getSessionWithProfile()` + role checks for authorization
- Action results follow the `{ error: string } | { success: true }` pattern

### URL Structure and Page-Level Authorization

All under the `(app)` route group (authenticated):

| Route | Allowed Roles | Server-Side Enforcement |
|-------|--------------|------------------------|
| `/events` | super_admin, dept_head, sub_leader | Check `isLeaderRole()`; redirect volunteers to `/dashboard` |
| `/events/new` | super_admin only | Check `hasMinimumRole(profile.role, 'super_admin')`; redirect non-admins to `/events` |
| `/events/[id]` | super_admin, dept_head, sub_leader | Check `isLeaderRole()`; redirect volunteers to `/dashboard` |
| `/events/[id]/edit` | super_admin only | Check `hasMinimumRole(profile.role, 'super_admin')`; redirect non-admins to `/events/[id]` |

Authorization is enforced server-side at the page level via `getSessionWithProfile()` + role checks, not merely by hiding UI buttons. Every mutating route performs its own redirect for unauthorized roles.

### Navigation

Add "Events" link to the header in `(app)/layout.tsx`, visible only to leader roles via `isLeaderRole()`.

## Files To Create Or Modify

### New Files

| Path | Purpose |
|------|---------|
| `supabase/migrations/00002_events.sql` | Event table, enums, indexes, RLS, triggers |
| `apps/web/lib/events/types.ts` | TypeScript types: Event, EventType, EventStatus, labels, transitions map |
| `apps/web/lib/events/schemas.ts` | Zod schemas for create/update validation |
| `apps/web/lib/events/actions.ts` | Server actions: create, update, transition status, soft-delete |
| `apps/web/lib/events/queries.ts` | Server-side query functions |
| `apps/web/app/(app)/events/page.tsx` | Event list page |
| `apps/web/app/(app)/events/new/page.tsx` | Event creation page |
| `apps/web/app/(app)/events/[id]/page.tsx` | Event detail page |
| `apps/web/app/(app)/events/[id]/edit/page.tsx` | Event edit page |
| `apps/web/app/(app)/events/_components/event-form.tsx` | Shared create/edit form |
| `apps/web/app/(app)/events/_components/event-list-table.tsx` | Event list table/cards |
| `apps/web/app/(app)/events/_components/event-status-badge.tsx` | Status badge component |
| `apps/web/app/(app)/events/_components/status-transition-modal.tsx` | Confirmation modal |
| `apps/web/app/(app)/events/_components/event-detail-card.tsx` | Event detail display |
| `apps/web/app/(app)/events/_components/event-empty-state.tsx` | Empty state |
| `apps/web/app/(app)/events/loading.tsx` | List page skeleton |
| `apps/web/app/(app)/events/[id]/loading.tsx` | Detail page skeleton |

### Modified Files

| Path | Change |
|------|--------|
| `apps/web/app/(app)/layout.tsx` | Add "Events" nav link for leader roles |
| `supabase/seed.sql` | Add commented example event seed data |

## Rollout / Migration / Access Impact

**Schema**: Additive migration `00002_events.sql`. Does not modify existing tables.

**Authorization**: RLS restricts event creation/update to super_admin. Read access for dept_head and sub_leader (all active events — this is a pre-RS-F003 baseline; department-scoped visibility tightening is a planned refinement in RS-F003). Volunteers excluded. This matches the vision's role hierarchy.

**Soft-delete**: Same `deleted_at` pattern as profiles table.

**No environment variable changes required.**

## Implementation Steps

### Step 1: Create the database migration

Create `supabase/migrations/00002_events.sql`:

a. Create `event_type` enum: `regular`, `ad_hoc`, `special_day`

b. Create `event_status` enum: `draft`, `published`, `completed`

c. Create `events` table:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200)`
   - `event_type public.event_type NOT NULL`
   - `event_date date NOT NULL`
   - `status public.event_status NOT NULL DEFAULT 'draft'`
   - `created_by uuid NOT NULL REFERENCES public.profiles(id)`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - `updated_at timestamptz NOT NULL DEFAULT now()`
   - `deleted_at timestamptz`

d. Create indexes:
   - `idx_events_date` on `event_date`
   - `idx_events_status` on `status`
   - `idx_events_created_by` on `created_by`
   - `idx_events_active` on `(event_date, status) WHERE deleted_at IS NULL`

e. Enable RLS on `events`

f. Create `enforce_event_status_transition()` trigger function:
   - Validates OLD.status → NEW.status is in the allowed set
   - Raises exception with descriptive message on invalid transitions

g. Create BEFORE UPDATE trigger using the function

h. Reuse existing `update_updated_at()` trigger for `updated_at`

i. Create RLS policies:
   - Leaders (super_admin, dept_head, sub_leader) can SELECT active events
   - Super admin can SELECT all events including soft-deleted (oversight)
   - Super admin can INSERT (created_by = auth.uid())
   - Super admin can UPDATE active events

### Step 2: Create TypeScript types

Create `apps/web/lib/events/types.ts`:
- `EventType` and `EventStatus` union types with const arrays
- `Event` interface matching the table schema
- Label records: `EVENT_TYPE_LABELS`, `EVENT_STATUS_LABELS`
- `VALID_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]>`

### Step 3: Create Zod validation schemas

Create `apps/web/lib/events/schemas.ts`:
- `createEventSchema`: title (1-200 chars), eventType, eventDate (valid date)
- `updateEventSchema`: same fields optional plus id
- Export inferred types

### Step 4: Create server-side query functions

Create `apps/web/lib/events/queries.ts`:
- `getEvents(filters?)`: fetch active events, ordered by date desc, optional status filter
- `getEventById(id)`: fetch single active event
- Both verify session + leader role before querying

### Step 5: Create server actions

Create `apps/web/lib/events/actions.ts`:
- `createEvent`: validate, check super_admin, insert, redirect to detail
- `updateEvent`: validate, check super_admin, update, redirect to detail
- `transitionEventStatus`: check super_admin, update status (DB trigger enforces valid transitions), catch and surface friendly error on invalid transition
- `softDeleteEvent`: check super_admin, set deleted_at, redirect to list
- All follow the `EventActionResult` pattern: `{ error: string } | { success: true } | undefined`

### Step 6: Create UI components

- `event-status-badge.tsx`: pill with mono font, semantic colors per status
- `status-transition-modal.tsx`: client component, dialog with confirm/cancel, describes consequence
- `event-form.tsx`: client component, shared create/edit form with `useActionState`
- `event-list-table.tsx`: dense table from `lg` breakpoint, stacked cards below, links to detail
- `event-detail-card.tsx`: displays all event fields with status transitions
- `event-empty-state.tsx`: calm guidance copy + CTA for super_admin

### Step 7: Create pages

- `/events/page.tsx`: server component, list with status filter, role-gated
- `/events/new/page.tsx`: super_admin only, renders form in create mode
- `/events/[id]/page.tsx`: detail with transitions, edit link, delete action
- `/events/[id]/edit/page.tsx`: super_admin only, renders form in edit mode
- Loading skeletons for list and detail pages

### Step 8: Update app layout navigation

Modify `apps/web/app/(app)/layout.tsx`:
- Add "Events" nav link visible to leader roles only
- Active state styling with `brand-calm-600`

### Step 9: Update seed data

Add commented event INSERT examples to `supabase/seed.sql`.

### Step 10: Validate

- Apply migration with `npx supabase db reset`
- Test CRUD as super_admin
- Test read-only access as dept_head and sub_leader
- Test volunteer is blocked from /events
- Test all valid status transitions
- Test invalid transitions produce friendly errors
- Test soft-delete with confirmation
- Test form validation
- Run `npm run typecheck`, `npm run lint`, `npm run build`
- Design-fidelity review against design-system.md

## Acceptance Criteria Mapping

### Feature Registry Steps

| Feature Step | Implementation | Verification |
|---|---|---|
| "Model event records and lifecycle states." | Migration creates `events` table with `event_type` and `event_status` enums, status transition trigger, soft-delete | Insert test rows, verify enum constraints, verify trigger rejects invalid transitions |
| "Create authorized event creation and editing flows." | Server actions enforce super_admin; RLS restricts INSERT/UPDATE; Zod validates input; UI pages at /events/new and /events/[id]/edit | Create and edit as super_admin; attempt as dept_head and confirm rejection |
| "Use the event state as the root context for downstream planning data." | Events table uses uuid PK for FK references; schema supports future department/assignment/instruction FKs; soft-delete and status lifecycle enforced at DB level | Confirm schema supports FK referencing; confirm soft-deleted events excluded from queries |

### PRD Validation Items

| PRD Validation | Verification |
|---|---|
| "Create an event and verify required fields are stored and visible." | Create via /events/new, confirm in /events list with correct title, type, date, status |
| "Move an event through each allowed status and confirm invalid transitions are rejected." | Transition draft→published→completed via detail page; attempt invalid transitions and confirm error |
| "Confirm downstream planning records cannot exist without an event reference." | RS-F002 establishes the canonical event root (`events.id` uuid PK, NOT NULL). Downstream features (RS-F003 departments, RS-F008 assignments, RS-F011 instructions, RS-F013 notifications) must add required foreign keys to this root when their tables are introduced. Full FK verification is deferred to each downstream feature's own acceptance criteria. In RS-F002, verify the schema supports FK referencing and that soft-deleted events are excluded from normal queries. |

## Style Guardrails For UI Work

**Target surfaces**: Admin and leader. Super_admin performs CRUD; dept_head and sub_leader read only.

**Component patterns**:
- Tables for event list (leader/admin operational surface)
- Cards for event detail
- Form inputs: labels above, full-border, clear focus ring (following auth page pattern)
- Modal for confirmations
- Status badges: mono font, semantic coloring

**Tone and copy**:
- Leader copy: concise, direct, operational
- Button labels: "Create event", "Publish event", "Mark completed", "Save changes", "Delete event"
- Errors: calm, actionable ("This event could not be saved. Please check the fields below.")
- Empty state: calm, helpful ("No events yet. Create your first event to begin planning.")

**Layout and spacing**:
- Mobile-first, stacks to cards below `lg` breakpoint
- Dense table layout from `lg` (1024px) upward, matching the design system's "denser from 1024px upward" leader surface posture
- Page padding: `px-300 py-500 sm:px-500`
- Card spacing: `p-500` interior, `gap-300` between sections

**States requiring fidelity**:
- **Empty**: Helpful guidance + CTA for super_admin
- **Loading**: Skeleton placeholders
- **Error**: Inline error messages from server actions
- **Confirm**: Modal for publish, complete, and delete — explicit consequence description
- **Unauthorized**: Non-super_admin sees read-only views; action buttons absent (not disabled)

## Risks Or Blockers

1. **RLS subquery performance**: SELECT policies query `profiles` per row. Acceptable at church scale. Can optimize later if needed.
2. **Past date validation**: Draft events may have dates that pass. Allow this for record-keeping. Zod validates on create but permits past dates on edit.
3. **Status trigger error handling**: DB trigger raises Postgres exception on invalid transition. Server action must catch and surface a friendly error.
4. **Soft-delete cascade**: When an event is soft-deleted, downstream records (departments, assignments) must also become inaccessible. Enforced in future features' RLS/queries. This feature designs for it but doesn't implement the cascade.
5. **Downstream FK verifiability**: The PRD validation "downstream planning records cannot exist without an event reference" is only partially verifiable in RS-F002 because those downstream tables do not exist yet. RS-F002 can only prove that the event schema supports FK referencing and that soft-deleted events are excluded from queries. Do not mark the third PRD validation item as fully satisfied — note explicitly in the wrap-up that full FK enforcement is deferred to RS-F003 and later features.
6. **Broad leader read access is a pre-RS-F003 baseline**: In RS-F002, all dept_head and sub_leader users can read all active events. This is intentional as a temporary baseline before department-scoped visibility exists. When RS-F003 introduces department ownership, event visibility for dept_head and sub_leader should be tightened to events containing departments they own. This is a planned hierarchy refinement, not an unplanned behavior change.

## Validation Plan

### Manual Validation

1. Create event as super_admin — verify in list with draft status
2. Submit form with empty/invalid fields — verify inline errors
3. Edit event title — verify change persists
4. Publish draft event — confirm modal, verify status change
5. Complete published event — confirm modal with "cannot be undone", verify status
6. Attempt invalid transition (completed → anything) — verify no transition buttons shown
7. Soft-delete event — confirm modal, verify removed from list
8. Access /events as dept_head — verify read-only (no create/edit/delete buttons)
9. Access /events as sub_leader — same as dept_head
10. Access /events as volunteer — verify redirect to /dashboard
11. Verify empty state renders when no events exist
12. Verify loading skeletons appear during page load
13. Test mobile layout — event list stacks to cards, forms remain usable

### Automated Checks

- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm run build` — passes
- Migration applies cleanly on `npx supabase db reset`

## Documentation Updates

- `docs/tracking/progress.md` — mark RS-F002 as passed
- `docs/tracking/claude-progress.txt` — add RS-F002 completion details
- `docs/features/feature-list.json` — set RS-F002 `passes` to `true`
- `supabase/seed.sql` — add commented event seed examples
