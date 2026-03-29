# Plan: RS-F005 - Availability And Blockout Management

Status: In Review
Feature: RS-F005
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

## Objective

Allow volunteers to record specific dates they are unavailable to serve (blockouts) and allow leaders to view that blockout information for volunteers in their planning scope. This closes the gap between general availability preferences (captured in RS-F004) and the dated availability signals leaders need during roster planning.

## Scope And Non-Goals

### In Scope

- New `availability_blockouts` table: dated unavailability records owned by individual volunteers
- Volunteer UI at `/availability`: add a blockout date with optional reason, view current blockouts, remove a blockout
- Leader UI at `/availability`: read-only view of blockout dates for volunteers in the leader's planning scope, scoped by department ownership
- RLS covering volunteer self-service reads/writes and leader reads scoped to their owned departments or sub-teams
- Navigation link to `/availability` added to `app-nav.tsx`
- Seed examples for RS-F005

### v1 Scope Interpretation

RS-F005 is **blockout-first** for v1. "Dated unavailability" is the primary deliverable. The `availability_preferences` table from RS-F004 already covers general day/time preferences. RS-F005 adds specific dates a volunteer **cannot** serve. Positive dated availability ("I can serve on this specific date") is not modeled separately in v1 — leaders infer availability from the absence of a blockout combined with the general preference signal from RS-F004. This is a deliberate v1 interpretation, not scope omission.

### Leader Planning Scope Definition

There is no durable volunteer-to-department membership model in the codebase yet (that belongs to RS-F008 assignments). For RS-F005, **leader planning scope** is defined as:

- **dept_head**: volunteers who have expressed interest in a department where `departments.owner_id = auth.uid()` AND `departments.deleted_at IS NULL`
- **sub_leader**: volunteers who have expressed interest in a department that contains a sub-team where `sub_teams.owner_id = auth.uid()` AND `sub_teams.deleted_at IS NULL`
- Source table for both: `volunteer_interests` (volunteer_id, department_id) from RS-F004

This scope uses `volunteer_interests` as the available membership signal. When RS-F008 creates actual assignment records, the leader availability view can be upgraded to use assignment-based scope. The RS-F005 implementation must not block that future change.

### Explicit Scope Boundaries

- **Positive dated availability** — not modeled in v1; leaders infer availability from absence of a blockout
- **Blockout approval flows** — not required; volunteers manage their own blockouts with no leader gate
- **Recurring or repeating blockouts** — not in v1; each blockout is a single date
- **Blockout reminders or notifications** — deferred to RS-F013
- **Blockout visibility in roster planning UI** — deferred to RS-F008; RS-F005 provides the data and a standalone read view only

### Non-Goals

- Editing event, department, or assignment data
- Any write access by leaders to volunteer availability
- Skill, interest, or profile management

## Approach

### Data Model

**New table: `availability_blockouts`** (migration 00007)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `volunteer_id` | uuid NOT NULL | FK → profiles(id) ON DELETE CASCADE |
| `date` | date NOT NULL | the blocked-out date |
| `reason` | text | optional, nullable, `char_length(reason) <= 200` |
| `created_at` | timestamptz | DEFAULT now() |
| `deleted_at` | timestamptz | nullable — soft-delete timestamp |

Constraints:
- Partial unique index on (`volunteer_id`, `date`) WHERE `deleted_at IS NULL` — one active blockout per volunteer per date; soft-deleted rows do not block a re-add of the same date
- Index on `volunteer_id`
- Index on `date`

**Delete behavior:** Soft-delete. Volunteer "removing" a blockout sets `deleted_at = now()` on the row. All normal queries filter `deleted_at IS NULL`. This satisfies the project-wide soft-delete guardrail. Permanent purge of soft-deleted blockout rows is deferred to RS-F014 (Admin oversight, soft delete, and approval controls), consistent with all other soft-deleted entities in the system. No admin approval is required for the volunteer's initial self-service soft-delete action — the approval gate applies only to the permanent hard purge step in RS-F014.

**Confirmation UX:** The remove action is gated by a simple inline confirmation (a "Confirm remove?" state on the row itself) before the soft-delete is applied. A full modal is not required given the low impact of the action, but the two-step confirm satisfies the confirmation guardrail.

### RLS Design

Policies on `availability_blockouts`:

1. **Volunteers read own active blockouts**: `SELECT` WHERE `volunteer_id = auth.uid() AND deleted_at IS NULL`
2. **Volunteers insert own blockouts**: `INSERT` WHERE `volunteer_id = auth.uid()`
3. **Volunteers soft-delete own blockouts**: `UPDATE` WHERE `volunteer_id = auth.uid()` (used to set `deleted_at`)
4. **Super admins read all blockouts**: `SELECT` (role check via profiles subquery; includes soft-deleted rows)
5. **Dept heads read in-scope blockouts**: `SELECT` WHERE `deleted_at IS NULL AND volunteer_id IN (SELECT vi.volunteer_id FROM volunteer_interests vi JOIN departments d ON d.id = vi.department_id WHERE d.owner_id = auth.uid() AND d.deleted_at IS NULL)`
6. **Sub leaders read in-scope blockouts**: `SELECT` WHERE `deleted_at IS NULL AND volunteer_id IN (SELECT vi.volunteer_id FROM volunteer_interests vi JOIN departments d ON d.id = vi.department_id JOIN sub_teams st ON st.department_id = d.id WHERE st.owner_id = auth.uid() AND st.deleted_at IS NULL)`

Also required — **new policy on `profiles` table** (added in migration 00007):
7. **Leaders can read in-scope volunteer profiles**: `SELECT` on `profiles` WHERE `role = 'volunteer' AND deleted_at IS NULL` AND caller is a dept_head or sub_leader with a volunteer in their scope (via `volunteer_interests` + department/sub-team ownership). The existing `00004` policy only exposes leader-role profiles to other leaders; volunteer profiles are not currently visible to leaders. This policy is required for `getBlockoutsForScope()` and `getVolunteersInScope()` to return volunteer display names.

No UPDATE policy for reason/date changes — volunteers soft-delete and re-create if they need to change a blockout.

### Lib Layer (`apps/web/lib/availability/`)

**types.ts**
- `AvailabilityBlockout` — maps the DB row
- `BlockoutWithVolunteer` — for leader views: blockout row joined with volunteer display_name

**schemas.ts**
- `addBlockoutSchema` — Zod: `{ date: z.string().date(), reason: z.string().max(200).optional() }`

**queries.ts**
- `getMyBlockouts(userId)` — SELECT own blockouts WHERE `deleted_at IS NULL`, ordered by date ASC, returns `AvailabilityBlockout[]`
- `getBlockoutsForScope()` — called by leader; SELECTs all readable rows (RLS scopes to in-scope volunteers automatically) WHERE `deleted_at IS NULL`; joins `profiles` for `display_name` — **requires the new in-scope volunteer profile read policy added in migration 00007**, otherwise `display_name` would be null for all volunteer rows
- `getVolunteersInScope()` — returns distinct volunteer profiles readable by the caller; relies on same new profile policy

**actions.ts**
- `addBlockout(formData)` — validates with `addBlockoutSchema`, verifies caller is a volunteer, inserts row; returns `{ success: true }` or `{ error: string }`
- `removeBlockout(blockoutId)` — verifies caller owns the row (re-fetch before delete), deletes; returns `{ success: true }` or `{ error: string }`

### Route Structure

**Single shared route: `(app)/availability/`**

Follows the same pattern as `(app)/dashboard/` — one page.tsx that fetches the session, checks role, and renders the appropriate view component. No separate `/leader/availability` or `/volunteer/availability` route trees. This matches the existing architecture.

```
(app)/availability/
  page.tsx                                    — server component: fetches session + role-appropriate data, renders view
  _components/
    volunteer-availability-view.tsx           — client component: blockout list + add form
    blockout-list.tsx                         — renders existing blockouts with remove action
    add-blockout-form.tsx                     — date input + optional reason, useActionState with addBlockout
    leader-availability-view.tsx              — server/client: grouped table of volunteers + their blockout dates
    volunteer-blockout-card.tsx               — one row/card per volunteer showing their blockouts
```

**`page.tsx` logic:**
1. `getSessionWithProfile()` — redirect to `/sign-in` if no session
2. If volunteer: call `getMyBlockouts(userId)`, render `<VolunteerAvailabilityView>`
3. If leader role: call `getBlockoutsForScope()` + `getVolunteersInScope()`, render `<LeaderAvailabilityView>`
4. Otherwise: `redirect('/dashboard')`

### Navigation

The current `(app)/layout.tsx` only renders `<AppNav />` when `isLeaderRole()` is true, so volunteers currently see no nav links beyond the wordmark. Two files must change together:

1. **`(app)/layout.tsx`**: Remove the `showEventsLink &&` gate around `<AppNav />`. Render `<AppNav role={session.profile.role} />` for all authenticated roles in the app shell. Pass the role as a prop so AppNav can conditionally show role-appropriate links.

2. **`app-nav.tsx`**: Accept a `role` prop. Render "Availability" link for all roles. Render "Events" link only for leader roles (`isLeaderRole(role)`). This keeps the Events area leader-only while giving volunteers access to their Availability page through the shared header.

## Files To Create Or Modify

| File | Action | Reason |
|---|---|---|
| `supabase/migrations/00007_availability_blockouts.sql` | Create | New table + RLS policies |
| `apps/web/lib/availability/types.ts` | Create | TypeScript types for blockout entities |
| `apps/web/lib/availability/schemas.ts` | Create | Zod schema for add-blockout form |
| `apps/web/lib/availability/queries.ts` | Create | getMyBlockouts, getBlockoutsForScope, getVolunteersInScope |
| `apps/web/lib/availability/actions.ts` | Create | addBlockout, removeBlockout server actions |
| `apps/web/app/(app)/availability/page.tsx` | Create | Shared route server component |
| `apps/web/app/(app)/availability/_components/volunteer-availability-view.tsx` | Create | Volunteer blockout management UI |
| `apps/web/app/(app)/availability/_components/blockout-list.tsx` | Create | List of existing blockouts with remove |
| `apps/web/app/(app)/availability/_components/add-blockout-form.tsx` | Create | Add blockout form |
| `apps/web/app/(app)/availability/_components/leader-availability-view.tsx` | Create | Leader scoped read view |
| `apps/web/app/(app)/availability/_components/volunteer-blockout-card.tsx` | Create | Per-volunteer blockout display |
| `apps/web/app/(app)/app-nav.tsx` | Modify | Accept role prop; show Availability for all roles, Events for leaders only |
| `apps/web/app/(app)/layout.tsx` | Modify | Render AppNav for all roles (not leader-only); pass role prop |
| `supabase/seed.sql` | Modify | RS-F005 blockout examples |
| `docs/tracking/progress.md` | Modify | Mark RS-F005 passed on completion |
| `docs/tracking/claude-progress.txt` | Modify | Session handoff update |
| `docs/features/feature-list.json` | Modify | RS-F005 passes: true on completion |

## Rollout / Migration / Access Impact

**Schema:** Additive. New `availability_blockouts` table only. No existing tables are altered. Migration 00007 builds on top of 00006 with no conflicts.

**Auth / access:**
- No new roles
- No existing RLS policies changed
- Six new RLS policies on `availability_blockouts`
- One new RLS policy on `profiles` (added in migration 00007): leaders can read volunteer profiles within their interest-based scope. The existing `00004_leader_profile_read.sql` policy only exposes leader-role profiles to other leaders; volunteer profile display names are not currently accessible to leaders. This new policy is required for leader availability queries that join profiles for display_name.
- The dept_head and sub_leader read policies introduce the first cross-entity volunteer-read pattern (leader sees volunteer data scoped by department interest). This is intentional and bounded.

**Leader visibility boundary:** Leaders see blockouts only for volunteers who have expressed interest in their owned departments/sub-teams. Volunteers who have not yet expressed any interests are invisible to leaders in this view. This is the correct v1 behavior — a volunteer with no interests has not yet entered the leader's planning scope.

**Existing data:** Volunteers with no blockouts see an empty state. No migration of existing data required.

**Downstream contracts:**
- RS-F008 (roster planning) will want to display blockout data inline during assignment creation. The `availability_blockouts` table and `getBlockoutsForScope()` query provide the data layer. RS-F008 can call directly or filter by date range.
- The scope definition (volunteer_interests → departments) should be replaced in RS-F008 by assignment-based scope without requiring a schema change to `availability_blockouts`.

## Implementation Steps

1. Create `supabase/migrations/00007_availability_blockouts.sql`:
   - Create `availability_blockouts` table with all columns (including `deleted_at`), constraints, and indexes; use a partial unique index `(volunteer_id, date) WHERE deleted_at IS NULL`
   - Enable RLS
   - Create the six RLS policies on `availability_blockouts` (volunteer own read/insert/update-for-soft-delete, super_admin read-all, dept_head scoped read, sub_leader scoped read); all leader and volunteer read policies filter `deleted_at IS NULL`; super_admin policy reads all including soft-deleted rows
   - Create one additional RLS policy on `profiles`: leaders can read volunteer profiles where the volunteer has expressed interest in the leader's owned department or sub-team (mirrors the scope logic of the blockout read policies); this is an additive policy alongside the existing `00004` policy

2. Create `apps/web/lib/availability/types.ts`:
   - `AvailabilityBlockout` type (maps DB row)
   - `BlockoutWithVolunteer` type (blockout row + `display_name: string`, `department_name: string`)

3. Create `apps/web/lib/availability/schemas.ts`:
   - `addBlockoutSchema`: Zod object with `date` (ISO string, `.date()` validator) and `reason` (optional, max 200 chars)

4. Create `apps/web/lib/availability/queries.ts`:
   - `getMyBlockouts(userId)`: SELECT from `availability_blockouts` WHERE `volunteer_id = userId`, ordered by `date ASC`
   - `getBlockoutsForScope()`: SELECT from `availability_blockouts` joined with `profiles` for display_name; RLS handles scope filtering; ordered by `date ASC` then `display_name ASC`
   - `getVolunteersInScope()`: SELECT distinct volunteer profiles that are in-scope for the current leader (via `volunteer_interests` + departments/sub-teams ownership); returns `{ id, display_name, department_name }[]`

5. Create `apps/web/lib/availability/actions.ts`:
   - `addBlockout(formData)`: validate with `addBlockoutSchema`; verify caller role is `volunteer` via `getSessionWithProfile()`; insert row; on partial-unique violation (active blockout already exists for that date) return friendly error ("You already have a blockout on this date"); return `{ success: true }` or `{ error: string }`
   - `removeBlockout(blockoutId)`: fetch blockout by id; verify `volunteer_id = caller uid` AND `deleted_at IS NULL`; UPDATE `deleted_at = now()`; return `{ success: true }` or `{ error: string }`

6. Create `apps/web/app/(app)/availability/_components/add-blockout-form.tsx`:
   - Client component; `useActionState` with `addBlockout`
   - Date input (native `<input type="date">`) + optional reason textarea
   - Loading state on submit button ("Saving…" / disabled)
   - Inline error display below form on failure
   - Clear form on success

7. Create `apps/web/app/(app)/availability/_components/blockout-list.tsx`:
   - Client component; receives `AvailabilityBlockout[]` as props
   - Renders each blockout as a row: formatted date, optional reason, remove control
   - Remove control is two-step: initial "Remove" ghost button → inline confirmation state ("Remove this blockout?" with Confirm / Cancel) → on confirm calls `removeBlockout` server action; shows loading state during action
   - Empty state: warm, helpful copy ("No blockouts yet — add a date below when you can't serve.")

8. Create `apps/web/app/(app)/availability/_components/volunteer-availability-view.tsx`:
   - Client component; receives initial blockouts, preferred days/times from RS-F004 as props
   - Composes `<BlockoutList>` and `<AddBlockoutForm>`
   - General preferences (from `availability_preferences`) displayed read-only above blockouts as a summary ("Your general availability: Mon, Wed, Fri · Mornings")

9. Create `apps/web/app/(app)/availability/_components/volunteer-blockout-card.tsx`:
   - Renders one volunteer's blockout info for the leader view: volunteer name, department context, list of blocked dates with reasons

10. Create `apps/web/app/(app)/availability/_components/leader-availability-view.tsx`:
    - Server or client component; receives `BlockoutWithVolunteer[]` and `volunteersInScope` as props
    - Groups blockouts by volunteer
    - If a volunteer in scope has no blockouts, renders them with "No blockouts recorded" so the leader knows the volunteer exists in scope
    - Empty state for when no volunteers are in scope: "No volunteers have expressed interest in your departments yet."

11. Create `apps/web/app/(app)/availability/page.tsx`:
    - Server component
    - `getSessionWithProfile()` → redirect to `/sign-in` if no session
    - If `role === 'volunteer'`: call `getMyBlockouts(userId)` + fetch `availability_preferences` from onboarding lib; render `<VolunteerAvailabilityView>`
    - If `isLeaderRole(role)`: call `getBlockoutsForScope()` + `getVolunteersInScope()`; render `<LeaderAvailabilityView>`
    - Else: `redirect('/dashboard')`

12. Modify `apps/web/app/(app)/app-nav.tsx`:
    - Accept a `role: string` prop
    - Render "Availability" link (`/availability`) for all roles
    - Render "Events" link (`/events`) only when `isLeaderRole(role)` — preserving existing leader-only access to events

13. Modify `apps/web/app/(app)/layout.tsx`:
    - Remove the `showEventsLink &&` gate wrapping `<AppNav />`
    - Render `<AppNav role={session.profile.role} />` for all authenticated roles in the app shell
    - Delete the now-unused `showEventsLink` variable

14. Add RS-F005 seed examples to `supabase/seed.sql` (commented, for local dev reset)

15. Run `npm run typecheck && npm run lint && npm run build` — all must pass

16. Update `docs/tracking/progress.md`, `docs/features/feature-list.json`, and `docs/tracking/claude-progress.txt`

## Acceptance Criteria Mapping

**Feature registry steps (from feature-list.json):**

| Registry Step | How It Is Met |
|---|---|
| Capture dated availability plus broader preference or blockout signals | `availability_blockouts` table for dated blockouts; `availability_preferences` (RS-F004) for general preferences — both surfaces visible in volunteer view |
| Make availability editable over time for volunteers | Volunteer can add and remove blockout dates at any time from `/availability` |
| Surface relevant availability inside leader planning views | Leader `/availability` view shows blockouts for all volunteers in their interest-based department scope |

**PRD validation items (RS-F005):**

| PRD Item | Verification |
|---|---|
| Create or update availability for a volunteer and confirm it persists | Manual: add a blockout as volunteer, confirm row in DB; add duplicate date, confirm friendly error |
| Sign in as a leader with access to that volunteer's planning scope and verify availability is visible | Manual: volunteer expresses interest in dept_head's department; dept_head views `/availability`; volunteer's blockout appears |
| Confirm that volunteers outside the leader's scope are not exposed | Manual: volunteer expresses interest in a different department; dept_head cannot see that volunteer's blockouts |

**Additional validation checks:**
- Sub_leader sees only volunteers in their sub-team's department, not all departments
- Super_admin can see all blockouts
- Volunteer can remove a blockout; it disappears from their list and from the leader's view
- Volunteer with no blockouts sees empty state; leader sees that volunteer with "No blockouts recorded"
- Leader with no volunteers in scope sees scope-empty state

## Style Guardrails For UI Work

**Surface:** Both volunteer and leader — one route, two distinct visual expressions.

**Volunteer view — warm, personal:**
- Page background: `bg-surface-warm` (`#FFF8E8`) — consistent with onboarding
- Heading: `font-display` (Space Grotesk) is borderline for a dashboard sub-page; use `text-h2` in DM Sans unless the page is a focused solo view like onboarding. Prefer `text-h2` DM Sans here since this is a recurring management page, not a welcoming moment.
- Blockout list rows: simple card treatment with `bg-neutral-0` border `neutral.300`, `radius.200`
- Add form: clean single-column, full-border date input and textarea, consistent with RS-F004 form style
- Remove action: two-step inline confirmation — initial ghost "Remove" link; on click transitions to an inline "Remove this blockout? Confirm / Cancel" state on the same row; `semantic.error` color appropriate for the confirm button only (not the initial remove link); no full modal needed for this low-impact action
- Empty state copy: warm and supportive ("No blockouts yet — add a date when you can't serve and we'll let leaders know.")
- General preferences summary (read-only): small `type.body-sm` chip row, `color.neutral.600`

**Leader view — calm, operational:**
- Page background: `bg-surface-cool` (`#F3F7FF`) — consistent with leader surfaces
- Heading: `text-h2` DM Sans, operational tone ("Volunteer availability")
- Content: group by volunteer name, sub-label with department; blockout dates in `type.mono` for compact date display
- No data / empty scope state: calm ("No volunteers have expressed interest in your departments yet.")
- Read-only; no edit affordances visible

**Shared layout:**
- Max content width consistent with other `(app)` pages
- Mobile-first single column; leader table view expands to multi-column from `1024px`
- Active/hover states on remove button must include non-color indicator (underline, border change) per accessibility rule

**States requiring fidelity:**
- Volunteer add-form loading state (button disabled + "Saving…")
- Volunteer add-form duplicate-date error (inline, below date field)
- Volunteer remove loading state (inline per-row spinner or disabled button)
- Leader empty-scope state
- Leader volunteer-with-no-blockouts state (distinct from empty scope)

**Tone:**
- Volunteer copy: warm, first-person ("When can't you serve?", "You're all clear — no blockouts recorded")
- Leader copy: operational, second-person ("Showing volunteers who have expressed interest in your departments")

## Risks Or Blockers

1. **Scope staleness:** The leader scope is derived from `volunteer_interests`. A volunteer who expressed interest but was later removed from a department (if that feature existed) would still appear in scope. In v1 there is no removal of interests by leaders, so this is not a live risk, but the scope query should be documented as provisional pending RS-F008.

2. **Empty leader view in early dev:** If no volunteers have expressed interests, the leader view will always show the empty-scope state. This is correct behavior; document it in seed comments so dev setup is clear.

3. **Native date input behavior:** `<input type="date">` rendering varies across browsers and mobile platforms. This is acceptable for v1; no custom date picker library is introduced.

4. **Sub-leader scope join depth:** The sub_leader RLS policy joins `volunteer_interests → departments → sub_teams`. This is a three-table join inside a policy. It is correct but should be validated against Supabase's RLS performance characteristics. If slow, a DB function can be introduced without a schema change.

5. **Availability_preferences read in volunteer view:** The volunteer view reads from `availability_preferences` (RS-F004 table) to show general preferences. This requires a Supabase client call from the same page. The existing RLS policy ("Volunteers can read own availability") covers this — no new policy needed.

## Validation Plan

### Automated checks
- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm run build` — passes
- `npx supabase db reset` — migration 00007 applies cleanly on top of 00006

### Manual checks
1. Sign in as volunteer → navigate to `/availability` → should see volunteer view (warm background, add form, empty blockout list)
2. Add a blockout with a date and optional reason → row persists, appears in list
3. Add the same date again (with active blockout) → inline error "You already have a blockout on this date" (partial unique index blocks duplicate active rows)
3b. Soft-delete a blockout then add the same date again → succeeds (partial unique only enforces WHERE deleted_at IS NULL)
4. Remove a blockout → inline confirmation appears; confirm → row soft-deleted (deleted_at set), disappears from list; row still exists in DB with deleted_at set
5. Sign in as super_admin → navigate to `/availability` → should see leader view (cool background, operational layout)
6. Sign in as dept_head who owns a department where the volunteer expressed interest → navigate to `/availability` → volunteer's blockout appears
7. Sign in as dept_head who does NOT own the volunteer's department → blockout is not visible
8. Sign in as sub_leader whose sub-team is in a department the volunteer expressed interest in → blockout is visible
9. Volunteer removes interest from department (via onboarding re-run or direct DB) → dept_head no longer sees their blockout
10. No volunteers in scope → leader sees empty-scope state, not an error
11. Volunteer with no blockouts appears in leader view with "No blockouts recorded"
12. Mobile layout check: volunteer form is usable on small screen; leader view collapses to single-column

## Documentation Updates

On completion:
- `docs/tracking/progress.md` — RS-F005: `passed`
- `docs/features/feature-list.json` — RS-F005 `passes: true`
- `docs/tracking/claude-progress.txt` — full handoff update for next session
- This plan file — status updated to `Implemented and merged`
