# Plan: RS-F003 - Department And Sub-Team Structure

Status: Approved
Feature: RS-F003
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

## Objective

Model the church's planning hierarchy so that each event can contain one or more departments, each department can contain one or more sub-teams, and ownership of each level maps cleanly to the real role hierarchy. A Department Head owns and manages a specific department and its sub-teams. A Sub-Leader is assigned ownership of a sub-team and has read-only access in RS-F003 (no create, edit, or delete rights at this stage). Super Admin retains full cross-department visibility and is the only role that can create or edit departments and assign department ownership.

This feature also closes the RS-F002 visibility baseline: the pre-RS-F003 broad leader event-read policy is replaced with ownership-scoped policies so that `dept_head` sees only events containing a department they own, and `sub_leader` sees only events containing a sub-team they own.

## Scope And Non-Goals

### In Scope

- Database schema for `departments` and `sub_teams` tables with required fields, constraints, indexes, soft-delete support
- RLS policies for both tables
- Replacement of the broad pre-RS-F003 `"Leaders can read active events"` policy on the `events` table with two ownership-scoped SELECT policies
- `apps/web/lib/events/queries.ts` and the event list/detail pages updated to remain correct and testable under the new RLS model — these files become part of the RS-F003 feature contract
- Zod validation schemas for creating and editing departments and sub-teams
- Server actions for creating, updating, and soft-deleting departments and sub-teams
- Server-side query functions for departments and sub-teams
- TypeScript types for both entities
- Event detail page (`/events/[id]`) enhanced to display the department list with sub-teams inline
- Department creation page (`/events/[id]/departments/new`) — super_admin only
- Department detail page (`/events/[id]/departments/[deptId]`) — all leader roles, RLS-scoped
- Department edit page (`/events/[id]/departments/[deptId]/edit`) — super_admin only
- Sub-team creation page (`/events/[id]/departments/[deptId]/sub-teams/new`) — super_admin or dept_head (within their owned department)
- Sub-team edit page (`/events/[id]/departments/[deptId]/sub-teams/[subTeamId]/edit`) — super_admin or dept_head (within their owned department)
- Soft-delete with confirmation modal for both departments and sub-teams
- Owner assignment: department owner is a `dept_head` profile; sub-team owner is a `sub_leader` profile; selected via server-loaded role-filtered profile list
- Loading and empty states for all new views

### Sub-Leader Rights in RS-F003 (Explicit)

Sub-leaders are **read-only** in this feature slice. They can view departments and sub-teams within their scoped visibility but cannot create, edit, or soft-delete any structure. "Manage the structures they are responsible for" (PRD) refers to future features — RS-F008 assignments, RS-F011 instructions — where sub-leaders act within their sub-team context. In RS-F003 the boundary is: sub-leaders see their sub-team and its parent department; they do not mutate structure. This is an intentional scoping decision, not an accidental under-implementation.

### Non-Goals

- Volunteer-facing department views (RS-F010)
- Skill association with departments (RS-F007)
- Assignment records referencing departments or sub-teams (RS-F008)
- Interest requests into departments (RS-F006)
- Instruction records scoped to departments (RS-F011)
- Bulk operations, reordering, or nested sub-team hierarchy

## Approach

### Database

Create migration `supabase/migrations/00003_departments.sql` with:

1. `departments` table:
   - `id` uuid PK
   - `event_id` FK to `events.id` NOT NULL
   - `name` text NOT NULL, CHECK 1–100 chars
   - `owner_id` FK to `profiles.id` nullable (assigned separately after creation)
   - `created_by` FK to `profiles.id` NOT NULL
   - `created_at`, `updated_at`, `deleted_at`

2. `sub_teams` table:
   - `id` uuid PK
   - `department_id` FK to `departments.id` NOT NULL
   - `name` text NOT NULL, CHECK 1–100 chars
   - `owner_id` FK to `profiles.id` nullable
   - `created_by` FK to `profiles.id` NOT NULL
   - `created_at`, `updated_at`, `deleted_at`

3. Indexes on FK columns + composite active partial indexes (`WHERE deleted_at IS NULL`) on both tables

4. `update_updated_at()` trigger on both tables (reuse existing function)

5. RLS on `departments`:
   - SELECT super_admin: all departments including soft-deleted
   - SELECT dept_head: active departments where `owner_id = auth.uid()`
   - SELECT sub_leader: active departments that contain at least one active sub-team where `sub_teams.owner_id = auth.uid()`
   - INSERT: super_admin only, `created_by = auth.uid()`
   - UPDATE: super_admin only, active departments only (no hard DELETE)

6. RLS on `sub_teams`:
   - SELECT super_admin: all sub_teams including soft-deleted
   - SELECT dept_head: active sub_teams in departments they own (`departments.owner_id = auth.uid()` — join required; `departments.deleted_at IS NULL` guard required)
   - SELECT sub_leader: active sub_teams where `owner_id = auth.uid()`
   - INSERT super_admin: `created_by = auth.uid()`
   - INSERT dept_head: `created_by = auth.uid()` AND department is active and dept_head owns it
   - UPDATE super_admin: active sub_teams only
   - UPDATE dept_head: active sub_teams in departments they own (same join condition as INSERT)

7. **Updated events RLS**:
   - DROP `"Leaders can read active events"` policy (created in 00002_events.sql)
   - CREATE `"Dept heads can read owned events"`: active events where `EXISTS (SELECT 1 FROM departments WHERE departments.event_id = events.id AND departments.owner_id = auth.uid() AND departments.deleted_at IS NULL)`
   - CREATE `"Sub leaders can read owned events"`: active events where `EXISTS (SELECT 1 FROM sub_teams st JOIN departments d ON d.id = st.department_id WHERE d.event_id = events.id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL AND d.deleted_at IS NULL)`

### Cascade Soft-Delete Invariant

Soft-deleting a department must make its sub-teams inaccessible regardless of the mutation path:

1. **Action layer**: `softDeleteDepartment` sets `deleted_at` on the department and then on all its active sub-teams (two DB updates, wrapped in explicit sequential calls with error handling on both).
2. **RLS layer**: The dept_head sub_team SELECT policy joins to `departments` and includes `AND d.deleted_at IS NULL`. Sub-leaders SELECT only `WHERE st.owner_id = auth.uid()` — if the parent department is soft-deleted, the sub_team query still returns the row, so an additional `AND EXISTS (SELECT 1 FROM departments WHERE id = st.department_id AND deleted_at IS NULL)` guard is added to the sub_leader SELECT policy.
3. **Query layer**: `getSubTeamsByDepartmentId` always filters `sub_teams.deleted_at IS NULL`. `getDepartmentsByEventId` always filters `departments.deleted_at IS NULL`. The invariant does not depend on the action-layer cascade alone.

### Application Layer

Follow RS-F002 patterns exactly:
- `lib/departments/` module with `types.ts`, `schemas.ts`, `actions.ts`, `queries.ts`
- Server actions: `"use server"`, Zod validation, `getSessionWithProfile()` + role checks
- Action results: `{ error: string } | { success: true } | undefined`
- `createSupabaseServerClient()` for all DB access

### URL Structure and Authorization

All routes under the `(app)` route group. Departments exist within an event — no top-level `/departments` route.

| Route | Allowed Roles | Server-Side Enforcement |
|---|---|---|
| `/events/[id]` departments section | super_admin, dept_head, sub_leader | existing `isLeaderRole()` + RLS-scoped query |
| `/events/[id]/departments/new` | super_admin only | `hasMinimumRole('super_admin')` — redirect to `/events/[id]` |
| `/events/[id]/departments/[deptId]` | super_admin, dept_head (owner), sub_leader (via sub_team) | `isLeaderRole()` + null-check on query result (notFound) |
| `/events/[id]/departments/[deptId]/edit` | super_admin only | `hasMinimumRole('super_admin')` — redirect to department detail |
| `/events/[id]/departments/[deptId]/sub-teams/new` | super_admin, owning dept_head | role check + ownership check — redirect to department detail if unauthorized |
| `/events/[id]/departments/[deptId]/sub-teams/[subTeamId]/edit` | super_admin, owning dept_head | role check + ownership check |

### Owner Assignment

Department forms: owner selected from server-loaded `dept_head` profiles. Sub-team forms: owner selected from server-loaded `sub_leader` profiles. Owner is nullable — "No owner assigned" is the default option. The `getProfilesByRole()` query is gated to super_admin or dept_head callers.

## Files To Create Or Modify

### New Files

| Path | Purpose |
|---|---|
| `supabase/migrations/00003_departments.sql` | departments + sub_teams tables, indexes, RLS, updated events RLS |
| `apps/web/lib/departments/types.ts` | Department, SubTeam, DepartmentWithSubTeams types |
| `apps/web/lib/departments/schemas.ts` | Zod schemas for create/update department and sub-team |
| `apps/web/lib/departments/actions.ts` | createDepartment, updateDepartment, softDeleteDepartment, createSubTeam, updateSubTeam, softDeleteSubTeam |
| `apps/web/lib/departments/queries.ts` | getDepartmentsByEventId, getDepartmentById, getSubTeamsByDepartmentId, getSubTeamById, getProfilesByRole |
| `apps/web/app/(app)/events/[id]/departments/new/page.tsx` | Department creation page |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/page.tsx` | Department detail with sub-teams list |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/edit/page.tsx` | Department edit page |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/sub-teams/new/page.tsx` | Sub-team creation page |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/sub-teams/[subTeamId]/edit/page.tsx` | Sub-team edit page |
| `apps/web/app/(app)/events/[id]/departments/_components/department-list-section.tsx` | Department list section for event detail page |
| `apps/web/app/(app)/events/[id]/departments/_components/department-form.tsx` | Shared create/edit form for departments |
| `apps/web/app/(app)/events/[id]/departments/_components/sub-team-list-section.tsx` | Sub-team list section for department detail page |
| `apps/web/app/(app)/events/[id]/departments/_components/sub-team-form.tsx` | Shared create/edit form for sub-teams |
| `apps/web/app/(app)/events/[id]/departments/_components/department-empty-state.tsx` | Empty state for no departments |
| `apps/web/app/(app)/events/[id]/departments/_components/sub-team-empty-state.tsx` | Empty state for no sub-teams |
| `apps/web/app/(app)/events/[id]/departments/_components/delete-confirm-modal.tsx` | Reusable soft-delete confirmation modal |

### Modified Files

| Path | Change |
|---|---|
| `apps/web/app/(app)/events/[id]/page.tsx` | Add DepartmentListSection below EventDetailCard; call getDepartmentsByEventId |
| `apps/web/lib/events/queries.ts` | Verify and document that queries remain correct under new RLS — no logic changes expected but review is part of this feature's contract |
| `supabase/seed.sql` | Add commented department and sub-team seed examples |

## Rollout / Migration / Access Impact

### Event Visibility Cutover — First-Class Migration Concern

The migration drops `"Leaders can read active events"` and replaces it with ownership-scoped policies. This is an **immediate breaking change** for `dept_head` and `sub_leader` users:

- **Before migration**: all active events visible to all leader roles
- **After migration**: dept_head sees only events with departments they own; sub_leader sees only events with sub_teams they own
- **Immediately after migration with no departments/sub_teams created**: both roles see **zero events** — this is correct behavior, not a regression
- **Required operator action**: super_admin must create departments, assign dept_head owners, create sub_teams, and assign sub_leader owners for those roles to regain event access

This must be treated as a deliberate, coordinated rollout step, not a silent schema migration. The seed data added in this feature should include a worked example with ownership assigned so the behavior can be verified end-to-end.

### Schema

Additive migration for `departments` and `sub_teams`. The only change to an existing table is the DROP/CREATE of two RLS policies on `events`.

### Soft-Delete Cascade Invariant

See Approach section. The invariant is enforced at three layers: action, RLS, and query. No single mutation path is trusted alone.

**No environment variable changes required.**

## Implementation Steps

### Step 1: Create the database migration

Create `supabase/migrations/00003_departments.sql`:

a. Create `departments` table (all columns per schema above)

b. Create `sub_teams` table (all columns per schema above)

c. Create indexes:
   - `idx_departments_event_id` on `departments(event_id)`
   - `idx_departments_owner_id` on `departments(owner_id)`
   - `idx_departments_active` on `(event_id, owner_id) WHERE deleted_at IS NULL`
   - `idx_sub_teams_department_id` on `sub_teams(department_id)`
   - `idx_sub_teams_owner_id` on `sub_teams(owner_id)`
   - `idx_sub_teams_active` on `(department_id, owner_id) WHERE deleted_at IS NULL`

d. Enable RLS on both tables

e. Attach `update_updated_at()` trigger to both tables

f. Create RLS policies on `departments` (5 policies as described in Approach)

g. Create RLS policies on `sub_teams` (6 policies: 1 super_admin SELECT, 1 dept_head SELECT, 1 sub_leader SELECT, 2 INSERT, 2 UPDATE — super_admin and dept_head variants for the latter two)

h. Drop existing `"Leaders can read active events"` policy on `events`

i. Create two replacement scoped SELECT policies on `events` (dept_head and sub_leader variants as described in Approach)

### Step 2: Create TypeScript types

Create `apps/web/lib/departments/types.ts`:
- `Department` interface matching the table schema
- `SubTeam` interface matching the table schema
- `DepartmentWithSubTeams = Department & { sub_teams: SubTeam[] }`

### Step 3: Create Zod validation schemas

Create `apps/web/lib/departments/schemas.ts`:
- `createDepartmentSchema`: name (1–100 chars), eventId (uuid), ownerId (uuid optional)
- `updateDepartmentSchema`: id (uuid), name, ownerId (optional)
- `createSubTeamSchema`: name (1–100 chars), departmentId (uuid), ownerId (uuid optional)
- `updateSubTeamSchema`: id (uuid), name, ownerId (optional)
- Export inferred types for all four

### Step 4: Create server-side query functions

Create `apps/web/lib/departments/queries.ts`:
- `getDepartmentsByEventId(eventId)`: active departments with active sub-teams, ordered by created_at; session + `isLeaderRole()` guard
- `getDepartmentById(id)`: active department with active sub-teams; session + `isLeaderRole()` guard
- `getSubTeamById(id)`: active sub-team; session + `isLeaderRole()` guard
- `getProfilesByRole(role: 'dept_head' | 'sub_leader')`: active profiles; session + super_admin or dept_head guard

All return empty array / null on auth failure.

### Step 5: Review events queries

Review `apps/web/lib/events/queries.ts`: confirm `getEvents()` and `getEventById()` remain correct under the new RLS. No logic changes are expected (queries already filter `deleted_at IS NULL` and let RLS do visibility scoping), but this review is part of the RS-F003 contract. Document the outcome in a comment if no change is needed.

### Step 6: Create server actions

Create `apps/web/lib/departments/actions.ts`:
- `createDepartment`: super_admin only; Zod validate; insert; redirect to `/events/[eventId]/departments/[id]`
- `updateDepartment`: super_admin only; Zod validate; update active record; redirect to department detail
- `softDeleteDepartment`: super_admin only; set `deleted_at` on department; then set `deleted_at` on all active sub_teams for that department; handle second call failure with explicit error; redirect to `/events/[eventId]`
- `createSubTeam`: super_admin OR dept_head owning the parent department; Zod validate; verify ownership server-side before insert; redirect to department detail
- `updateSubTeam`: super_admin OR owning dept_head; Zod validate; verify ownership; update active record; redirect to department detail
- `softDeleteSubTeam`: super_admin OR owning dept_head; verify ownership; set `deleted_at`; redirect to department detail

For dept_head mutations: after role check, load the parent department from DB and verify `owner_id = session.user.id`. Return `{ error: "You do not have permission to manage this department." }` if the check fails.

### Step 7: Create UI components

- `department-form.tsx`: client component; `useActionState`; name text input; event_id hidden; owner `<select>` from server-passed profiles; follows auth form pattern (label above, full-border, focus ring)
- `sub-team-form.tsx`: same pattern; department_id hidden; owner select from sub_leader profiles
- `department-list-section.tsx`: renders list of DepartmentWithSubTeams for event detail page; department name, owner display name (or "Unassigned"), sub-team count, link to detail; "Add department" CTA for super_admin; empty state if none
- `sub-team-list-section.tsx`: renders sub-teams within department detail; sub-team name, owner (or "Unassigned"); "Add sub-team" CTA for super_admin and owning dept_head; empty state if none
- `department-empty-state.tsx`: "No departments yet. Add a department to begin structuring this event." + CTA for super_admin
- `sub-team-empty-state.tsx`: similar
- `delete-confirm-modal.tsx`: reusable; accepts entityName, consequenceText, and form action; distinct from RS-F002 status-transition-modal

### Step 8: Create pages

- `departments/new/page.tsx`: super_admin only; load event (notFound if missing); load dept_head profiles; render DepartmentForm create mode
- `departments/[deptId]/page.tsx`: `isLeaderRole()` guard; load department with sub-teams (notFound if null — RLS handles visibility); render DepartmentDetailCard + SubTeamListSection; action buttons scoped by role
- `departments/[deptId]/edit/page.tsx`: super_admin only; load department; load dept_head profiles; render DepartmentForm edit mode
- `sub-teams/new/page.tsx`: super_admin or owning dept_head; load parent department; verify ownership for dept_head; load sub_leader profiles; render SubTeamForm create mode
- `sub-teams/[subTeamId]/edit/page.tsx`: super_admin or owning dept_head; load sub-team + parent department; verify ownership; render SubTeamForm edit mode

### Step 9: Update event detail page

Modify `apps/web/app/(app)/events/[id]/page.tsx`:
- Call `getDepartmentsByEventId(id)` after fetching the event
- Render `<DepartmentListSection>` below `<EventDetailCard>`, passing departments and isSuperAdmin

### Step 10: Update seed data

Add commented department and sub-team INSERT examples to `supabase/seed.sql`, including at least one example with ownership assigned, so the RS-F003 visibility model can be verified end-to-end on db reset.

### Step 11: Validate

See Validation Plan.

## Acceptance Criteria Mapping

### Feature Registry Steps

| Feature Step | Implementation | Verification |
|---|---|---|
| "Model departments and sub-teams beneath each event." | Migration creates departments (FK to events) and sub_teams (FK to departments) with soft-delete | Insert test rows; verify FK constraints; verify sub_team cannot reference a non-existent department |
| "Assign ownership for department heads and sub-leaders inside the hierarchy." | owner_id FK on both tables; forms include role-filtered owner select; actions write owner_id | Create department as super_admin, assign dept_head; create sub_team, assign sub_leader; verify owner stored and displayed |
| "Restrict structure management to authorized planning scopes." | RLS scopes SELECT to owned records; INSERT/UPDATE on departments super_admin only; INSERT/UPDATE on sub_teams super_admin or owning dept_head; page redirects enforce roles | Attempt department creation as dept_head (blocked); attempt sub_team creation in unowned department as dept_head (blocked); verify sub_leader is fully read-only |

### PRD Validation Items

| PRD Validation | Verification |
|---|---|
| "Create an event with multiple departments and sub-teams and verify hierarchy rendering." | As super_admin: create event, add 2 departments each with 2 sub_teams; verify /events/[id] renders full hierarchy with correct names, owners, sub-team counts |
| "Sign in as a Department Head and confirm access is limited to the assigned department." | As dept_head with ownership of one department: verify only the event containing their department is visible in the events list; verify they can access their department detail; verify other department details return notFound or redirect |
| "Sign in as a Sub-Leader and confirm access is limited to the delegated scope." | As sub_leader with ownership of one sub_team: verify only the event containing their sub_team is visible; verify read-only (no create/edit/delete buttons); verify department detail accessible for their parent department only |

### RS-F003 Narrowing Behavior Validation (Additional)

These scenarios must be explicitly tested:

1. **Dept_head scoped**: create two events each with one department; assign dept_head A to department in event 1 only. Sign in as dept_head A — verify event 1 visible, event 2 not visible.
2. **Sub_leader scoped**: assign sub_leader B to a sub_team in event 1's department. Sign in as sub_leader B — verify event 1 visible, event 2 not visible.
3. **No ownership assigned**: create an event with a department but no owner_id assigned. Sign in as any dept_head — verify event is NOT visible (confirms "invisible until assigned" behavior is correct).
4. **Department soft-deleted cascade**: create department with sub_teams and assigned owners. Soft-delete the department as super_admin. Verify: (a) the owning dept_head can no longer see the event via their policy, (b) the sub_team is also inaccessible to the sub_leader.

## Style Guardrails For UI Work

**Target surfaces**: Admin (super_admin) and leader (dept_head read/write within scope; sub_leader read-only).

**Component patterns**:
- Departments rendered as a list section within the event detail page — not a separate full-page table. Each entry: department name, owner display name or "Unassigned", sub-team count, "View" link.
- Sub-teams rendered similarly within department detail.
- Forms: label above, full-border input, clear focus ring — matching auth page input pattern.
- Owner selector: styled `<select>` consistent with other form controls; "No owner assigned" as default.
- Delete modal: describes consequence explicitly ("Deleting this department will also remove all its sub-teams.").

**Tone and copy**:
- Operational, direct. Button labels: "Add department", "Add sub-team", "Save changes", "Delete department", "Delete sub-team".
- Empty states: calm, guiding. "No departments yet. Add a department to begin structuring this event."
- Errors: "This department could not be saved. Please check the fields below." / "You do not have permission to manage this department."
- Unassigned owner: display as "Unassigned" — never empty string or null shown raw.

**Layout and spacing**:
- Mobile-first. Department and sub-team sections stack below the event detail card.
- Section headings: `font-display text-h2`.
- Card rows: `p-400`, `gap-200` between entries, `border border-neutral-300 rounded-200 bg-neutral-0`.
- Page padding inherited from `(app)/layout.tsx`.
- No pill-shaped CTAs on leader surfaces (design system rule).

**States requiring fidelity**:
- **Empty**: Role-scoped guidance (super_admin sees CTA; dept_head and sub_leader see informational copy only)
- **Loading**: Skeleton in section areas
- **Error**: Inline from server actions
- **Confirm**: Delete modal with cascade consequence text
- **Unassigned owner**: Graceful "Unassigned" display — never a blank or broken cell
- **Read-only**: Sub_leader sees no action buttons — absent, not disabled

## Risks Or Blockers

1. **Event visibility cutover** (high priority): Dropping the broad event SELECT policy is an immediate access change. Dept_head and sub_leader see no events until ownership is assigned. Treat this as a first-class rollout step. Seed data must include an ownership-assigned example.
2. **Cascade soft-delete fragility**: Mitigated by enforcing the invariant at three layers (action, RLS, query). The action-layer cascade involves two DB updates — document what happens if the second call fails and surface a clear error rather than leaving a partial state silently.
3. **RLS subquery depth on events**: The sub_leader events policy requires a two-table join. Acceptable at church scale.
4. **Owner nullable on creation**: Forms must gracefully handle null owner. Queries must display "Unassigned" without crashing on null.
5. **Profile list for owner select**: Simple role-filtered query of all profiles. No pagination needed at church scale.
6. **Dept_head ownership check in actions**: Server-side DB round-trip in action body before mutating. Do not skip — RLS is the last line of defense, but the action check provides friendly error messages.
7. **CLAUDE.md and prd.md doc drift**: These higher-level docs lag the live repo. Not a blocker here — ground this feature in the live codebase, the tracking docs, and this plan. Record the sub-leader read-only decision explicitly (done above) so there is no ambiguity in future sessions.

## Validation Plan

### Manual Validation

1. Create department as super_admin — verify appears in event detail
2. Submit department form with empty name — verify inline error
3. Assign dept_head as department owner — verify owner shows on detail
4. Create sub_team — assign sub_leader owner — verify stored and displayed
5. **Narrowing scenario 1**: dept_head with only one owned department sees only that event (not others)
6. **Narrowing scenario 2**: sub_leader with only one owned sub_team sees only that event
7. **Narrowing scenario 3**: event with unowned department is invisible to all dept_head / sub_leader users
8. **Narrowing scenario 4**: soft-delete department — owning dept_head loses event visibility; sub_team becomes inaccessible to sub_leader
9. As dept_head: create sub_team in own department — verify success
10. As dept_head: attempt sub_team creation in unowned department — verify blocked
11. As sub_leader: verify no create/edit/delete buttons appear anywhere
12. Edit department as super_admin — verify change persists
13. Edit sub_team as owning dept_head — verify change persists
14. Soft-delete sub_team alone — confirm modal, verify removed from department detail
15. Soft-delete department with sub_teams — confirm modal (cascade warning), verify both removed
16. Verify "Unassigned" displays gracefully when owner_id is null
17. Test mobile layout — sections stack, forms usable

### Automated Checks

- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm run build` — passes
- Migration applies cleanly on `npx supabase db reset`

## Documentation Updates

- `docs/tracking/progress.md` — mark RS-F003 as passed
- `docs/tracking/claude-progress.txt` — add RS-F003 completion details including events RLS change and sub-leader read-only decision
- `docs/features/feature-list.json` — set RS-F003 `passes` to `true`
- `supabase/seed.sql` — add commented department and sub-team seed examples with ownership assigned
