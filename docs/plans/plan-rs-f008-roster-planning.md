# Plan: RS-F008 - Roster Planning and Assignment Management

Status: Draft
Feature: RS-F008
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

---

## Objective

Give department heads a structured way to assign volunteers into events, departments, and sub-teams. Surface availability and approved skill context while assigning, and treat removal as a high-impact action requiring confirmation. Sub-leaders get write access (create, edit, remove) scoped strictly to sub-teams they own — they cannot touch dept-level assignments, other sub-leaders' sub-teams, or assign the `dept_head` role. Super admins see read-only oversight across all departments.

---

## Scope And Non-Goals

### In Scope

- New `assignments` table: ties an event, department, optional sub-team, and volunteer together with a serving role and status
- Migration `00011_assignments.sql`: table, indexes, RLS, and a trigger to keep `updated_at` current
- Lib layer at `apps/web/lib/assignments/`: types, queries, actions
- New route `(app)/events/[id]/departments/[deptId]/roster/` with role-dispatched page
- Dept_head UI: current assignments list, assign-volunteer form (volunteer selector with availability + skill context), edit serving role, remove assignment with two-step confirmation
- Sub-leader UI: write-enabled roster view scoped to their owned sub-teams — can assign, edit, and remove within owned sub-teams; cannot manage dept-level assignments or other sub-leaders' sub-teams; cannot assign the `dept_head` role; handles sub-leaders owning multiple sub-teams in the same dept
- Super_admin UI: read-only roster overview across all departments (accessible via existing event/dept structure)
- Nav/link: "Roster" link in `DepartmentDetailCard` for authorized roles
- Seed examples for RS-F008

### Explicit Scope Boundaries

- Assignment response (accept/decline by volunteer) — deferred to RS-F012
- Skill-gap detection and planning signals — deferred to RS-F009
- Personalized weekly volunteer dashboard — deferred to RS-F010
- Assignment notifications (email) — deferred to RS-F013
- Instructions and media sharing — deferred to RS-F011
- Marking assignments as `served` — deferred to RS-F012
- Volunteer-facing assignment view — deferred to RS-F010/RS-F012

### Approved Scope Decision — Sub-Leader Write Access

Sub-leaders may create, edit, and remove assignments scoped to sub-teams they own. They may not touch dept-level assignments (`sub_team_id IS NULL`), other sub-leaders' sub-teams, or assign the `dept_head` role. Aligns with PRD §8.3 and the RS-F003 deferral note (write authority was explicitly deferred to RS-F008+). Enforced at both RLS layer (policies 5 & 6) and server action layer.

A sub-leader may own multiple sub-teams in the same department. The page collects all owned sub-teams with `.filter()` on `department.sub_teams`; the sub-leader view and actions cover them all.

### Non-Goals

- Bulk assignment
- Volunteer self-assignment
- Cross-event assignment copying

---

## Approach

### Data Model (Migration 00011)

**New table: `assignments`**

```sql
CREATE TABLE public.assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  sub_team_id   uuid REFERENCES public.sub_teams(id) ON DELETE SET NULL,
  volunteer_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'volunteer'
                  CHECK (role IN ('volunteer', 'sub_leader', 'dept_head')),
  status        text NOT NULL DEFAULT 'invited'
                  CHECK (status IN ('invited', 'accepted', 'declined', 'served')),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
```

**Indexes:**

```sql
CREATE INDEX idx_assignments_event_dept
  ON public.assignments(event_id, department_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_assignments_volunteer
  ON public.assignments(volunteer_id) WHERE deleted_at IS NULL;

CREATE INDEX idx_assignments_sub_team
  ON public.assignments(sub_team_id) WHERE deleted_at IS NULL AND sub_team_id IS NOT NULL;
```

**Partial unique index** — one active assignment per volunteer per event per department (sub_team_id is a placement field on the row, not a separate slot dimension):

```sql
-- One active assignment per volunteer per event per department
CREATE UNIQUE INDEX idx_assignments_vol_event_dept
  ON public.assignments(volunteer_id, event_id, department_id)
  WHERE deleted_at IS NULL;
```

**updated_at trigger** — `set_updated_at()` function already exists (defined in `00010_fix_profiles_rls_recursion.sql`). Only add the trigger:

```sql
CREATE TRIGGER assignments_set_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Do **not** re-create the function — Postgres will error on duplicate function creation.

**RLS:**

```sql
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
```

1. **Dept_head reads assignments in owned departments:**
   ```sql
   CREATE POLICY "Dept heads can read assignments in owned depts"
     ON public.assignments FOR SELECT
     USING (
       deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
       AND EXISTS (SELECT 1 FROM public.departments d
                   WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
     );
   ```

2. **Dept_head creates assignments in owned departments:**
   ```sql
   CREATE POLICY "Dept heads can insert assignments in owned depts"
     ON public.assignments FOR INSERT
     WITH CHECK (
       EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
       AND EXISTS (SELECT 1 FROM public.departments d
                   WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
       AND status = 'invited'
       AND created_by = auth.uid()
     );
   ```

3. **Dept_head updates (edit role/sub-team) or soft-deletes assignments in owned departments:**
   ```sql
   CREATE POLICY "Dept heads can update assignments in owned depts"
     ON public.assignments FOR UPDATE
     USING (
       deleted_at IS NULL
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'dept_head')
       AND EXISTS (SELECT 1 FROM public.departments d
                   WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
     )
     WITH CHECK (
       EXISTS (SELECT 1 FROM public.departments d
               WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)
     );
   ```

4. **Sub-leader reads assignments in their sub-teams:**
   ```sql
   CREATE POLICY "Sub-leaders can read assignments in owned sub-teams"
     ON public.assignments FOR SELECT
     USING (
       deleted_at IS NULL
       AND sub_team_id IS NOT NULL
       AND public.get_my_role() = 'sub_leader'
       AND EXISTS (SELECT 1 FROM public.sub_teams st
                   WHERE st.id = sub_team_id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL)
     );
   ```

5. **Sub-leader creates assignments in their sub-teams** (confirmed scope: sub-leaders manage their delegated sub-teams):
   ```sql
   CREATE POLICY "Sub-leaders can insert assignments in owned sub-teams"
     ON public.assignments FOR INSERT
     WITH CHECK (
       sub_team_id IS NOT NULL
       AND role IN ('volunteer', 'sub_leader')
       AND status = 'invited'
       AND created_by = auth.uid()
       AND public.get_my_role() = 'sub_leader'
       AND EXISTS (SELECT 1 FROM public.sub_teams st
                   WHERE st.id = sub_team_id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL)
     );
   ```

6. **Sub-leader updates (edit role / soft-delete) assignments in their sub-teams:**
   ```sql
   CREATE POLICY "Sub-leaders can update assignments in owned sub-teams"
     ON public.assignments FOR UPDATE
     USING (
       deleted_at IS NULL
       AND sub_team_id IS NOT NULL
       AND public.get_my_role() = 'sub_leader'
       AND EXISTS (SELECT 1 FROM public.sub_teams st
                   WHERE st.id = sub_team_id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL)
     )
     WITH CHECK (
       sub_team_id IS NOT NULL
       AND role IN ('volunteer', 'sub_leader')
       AND EXISTS (SELECT 1 FROM public.sub_teams st
                   WHERE st.id = sub_team_id AND st.owner_id = auth.uid() AND st.deleted_at IS NULL)
     );
   ```

7. **Super_admin reads all:**
   ```sql
   CREATE POLICY "Super admins can read all assignments"
     ON public.assignments FOR SELECT
     USING (
       public.get_my_role() = 'super_admin'
     );
   ```

8. **Volunteer reads own assignments** (foundation for RS-F010/RS-F012):
   ```sql
   CREATE POLICY "Volunteers can read own assignments"
     ON public.assignments FOR SELECT
     USING (
       auth.uid() = volunteer_id
       AND deleted_at IS NULL
     );
   ```

### Lib Layer (`apps/web/lib/assignments/`)

**types.ts**

- `Assignment` — maps the full `assignments` row (all columns)
- `AssignmentWithContext` — for leader views: assignment + `volunteer_display_name`, `sub_team_name` (nullable), `department_name`, `event_title`
- `VolunteerForAssignment` — for the assignment form: `id`, `display_name`, `is_available` (bool), `approved_skills` (string[]), `already_assigned` (bool)

**queries.ts**

- `getAssignmentsForRoster(eventId, deptId)` — dept_head: all active assignments for event+dept; RLS scopes automatically; JOIN profiles (display_name), sub_teams (name); ordered by sub_team name ASC NULLS LAST, volunteer display_name ASC
- `getSubLeaderAssignments(eventId, deptId, subTeamIds: string[])` — sub_leader: assignments for event+dept where `sub_team_id IN (subTeamIds)`; RLS scopes automatically; same JOINs as above; caller passes all sub-team IDs owned by the sub-leader in this dept
- `getAllAssignmentsForEventDept(eventId, deptId)` — super_admin: all active assignments for event+dept; RLS restricts to super_admin; same JOINs
- `getVolunteersForAssignment(deptId, eventId)` — used to populate the volunteer selector; returns `VolunteerForAssignment[]`:
  - Volunteers with `role = 'volunteer'` who have an approved interest in `deptId` (via `volunteer_interests`)
  - `is_available`: `NOT EXISTS (blockout on event date)` — JOIN events to get `event_date`, then check `availability_blockouts.date = event_date AND deleted_at IS NULL`
  - `already_assigned`: `EXISTS (assignment for volunteer in this event+dept, deleted_at IS NULL)`
  - `approved_skills`: array of skill names from `volunteer_skills WHERE status='approved' AND department_id = deptId AND deleted_at IS NULL`
  - Ordered by: available first (is_available DESC), then already_assigned ASC, then display_name ASC

**actions.ts** — follow the same patterns as `lib/skills/actions.ts`

- `createAssignment(eventId, deptId, volunteerId, role, subTeamId?)`:
  - If caller is `dept_head`: verify ownership of `deptId`; `subTeamId` optional
  - If caller is `sub_leader`: `subTeamId` is **required**; verify they own that sub-team; block `role = 'dept_head'`
  - Both: if `subTeamId` provided, verify it belongs to `deptId`; verify volunteer has approved interest in `deptId`
  - INSERT with `status = 'invited'`, `created_by = session.profile.id`
  - On 23505 return `"This volunteer is already assigned in this department for this event"`
  - `revalidatePath("/events/[id]/departments/[deptId]/roster")` using the actual IDs
  - Return `{ success: true }` or `{ error: string }`

- `updateAssignment(assignmentId, { role?, subTeamId? })`:
  - If caller is `dept_head`: verify ownership of assignment's department
  - If caller is `sub_leader`: verify they own the assignment's sub_team; block setting `role = 'dept_head'`
  - Fetch assignment; verify `deleted_at IS NULL`; UPDATE role and/or sub_team_id
  - `revalidatePath(...)`, return result

- `removeAssignment(assignmentId)`:
  - If caller is `dept_head`: verify ownership of assignment's department
  - If caller is `sub_leader`: verify they own the assignment's sub_team; verify `sub_team_id IS NOT NULL`
  - Fetch assignment; verify `deleted_at IS NULL`; UPDATE `deleted_at = now()`
  - `revalidatePath(...)`, return result
  - Note: confirmation is enforced in the UI; this action performs the soft-delete unconditionally once called

### Route Structure

```
(app)/events/[id]/departments/[deptId]/
  roster/
    page.tsx
    _components/
      dept-head-roster-view.tsx
      assignment-list.tsx
      assignment-row.tsx
      assign-volunteer-form.tsx
      volunteer-selector.tsx
      sub-leader-roster-view.tsx
      super-admin-roster-view.tsx
```

**`page.tsx` role dispatch:**

```typescript
// params is a Promise in Next.js 15 — must be awaited
const { id: eventId, deptId } = await params;

if (role === 'dept_head' && department.owner_id === profile.id) {
  const [assignments, volunteers] = await Promise.all([
    getAssignmentsForRoster(eventId, deptId),
    getVolunteersForAssignment(deptId, eventId),
  ]);
  return <DeptHeadRosterView ... />;
}

if (role === 'sub_leader') {
  // collect ALL sub-teams owned by this sub-leader in this dept (can be multiple)
  const mySubTeams = department.sub_teams.filter(
    st => st.owner_id === profile.id && st.deleted_at === null
  );
  if (mySubTeams.length === 0) redirect('/dashboard');
  const subTeamIds = mySubTeams.map(st => st.id);
  const [assignments, volunteers] = await Promise.all([
    getSubLeaderAssignments(eventId, deptId, subTeamIds),
    getVolunteersForAssignment(deptId, eventId),
  ]);
  return <SubLeaderRosterView assignments={assignments} subTeams={mySubTeams} volunteers={volunteers} eventId={eventId} deptId={deptId} />;
}

if (role === 'super_admin') {
  const assignments = await getAllAssignmentsForEventDept(eventId, deptId);
  return <SuperAdminRosterView ... />;
}

redirect('/dashboard');
```

**`dept-head-roster-view.tsx`:**
- Page heading: "Roster — {department name}" with event title subtitle
- `<AssignmentList>` showing current assignments; remove action with two-step inline confirm
- "Assign volunteer" button → opens `<AssignVolunteerForm>` as an inline expanded section or modal
- Empty state: "No volunteers assigned yet."

**`assignment-list.tsx`:**
- Table layout on desktop; stacked rows on mobile
- Columns: Volunteer name | Sub-team (if any) | Serving role | Status badge | Actions
- Status badge: invited (neutral), accepted (success), declined (error), served (muted) — using `StatusBadge` pattern from RS-F007 or creating an `AssignmentStatusBadge`
- Remove: two-step inline confirm per row (same pattern as RS-F006/RS-F007 — "Remove this assignment?" / Confirm / Cancel)
- Edit (role/sub-team): inline edit within the row or a compact form in a drawer

**`assign-volunteer-form.tsx` / `volunteer-selector.tsx`:**
- Client component; receives `VolunteerForAssignment[]`, `DepartmentSkill[]`, sub-teams list
- Sub-team selector (optional): dropdown of available sub-teams
- Serving role selector: dropdown ('volunteer' | 'sub_leader')
- Volunteer list: filterable; each row shows volunteer name + availability chip (green "Available" / amber "Blocked") + approved skills (small badges); already-assigned volunteers shown muted/disabled
- Submit: "Assign volunteer"; loading state; inline error on duplicate
- Success: form resets; assignment list refreshes via revalidatePath

**`sub-leader-roster-view.tsx`:**
- Props: `assignments`, `subTeams` (all owned sub-teams in dept), `volunteers`, `eventId`, `deptId`
- Write-enabled: sub-leader can assign, edit, and remove within their owned sub-teams
- Heading: "Your teams" (or single sub-team name if only one)
- `<AssignVolunteerForm>` with sub-team selector limited to owned sub-teams; role selector excludes `dept_head`
- `<AssignmentList readOnly={false} />` with edit/remove controls per row
- Server actions (`createAssignment`, `updateAssignment`, `removeAssignment`) enforce sub-team scope at both RLS and action layer
- Empty: "No one has been assigned to your teams yet."

**`super-admin-roster-view.tsx`:**
- Read-only; shows all assignments for the dept+event
- Heading: "Roster — {dept name} (read only)"

### Navigation

Add a "View Roster" link/button in `DepartmentDetailCard` pointing to `/events/{eventId}/departments/{deptId}/roster`.

The existing `canManage` prop (`isSuperAdmin || isDeptHeadOwner`) does **not** cover sub-leaders. Add a dedicated `canViewRoster` prop:

**In `department/[deptId]/page.tsx`:**
```typescript
const isSubLeaderInDept =
  session.profile.role === 'sub_leader' &&
  department.sub_teams.some(
    st => st.owner_id === session.profile.id && st.deleted_at === null
  );
const canViewRoster = canManage || isSubLeaderInDept;
```

Pass `canViewRoster` to `DepartmentDetailCard`. Show the "View Roster" link when `canViewRoster` is true. The link is a secondary action button consistent with the existing "Edit" link style.

---

## Files To Create Or Modify

| File | Action | Reason |
|---|---|---|
| `supabase/migrations/00011_assignments.sql` | Create | New `assignments` table, indexes, RLS, updated_at trigger |
| `apps/web/lib/assignments/types.ts` | Create | Assignment, AssignmentWithContext, VolunteerForAssignment |
| `apps/web/lib/assignments/queries.ts` | Create | getAssignmentsForRoster, getSubLeaderAssignments, getAllAssignmentsForEventDept, getVolunteersForAssignment |
| `apps/web/lib/assignments/actions.ts` | Create | createAssignment, updateAssignment, removeAssignment |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/page.tsx` | Create | Role-dispatched server component |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/dept-head-roster-view.tsx` | Create | Full dept_head roster management |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assignment-list.tsx` | Create | Assignments table with status badges and remove action |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assignment-row.tsx` | Create | Single assignment row with inline edit + confirm-remove |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assign-volunteer-form.tsx` | Create | Assignment creation form with role/sub-team selection |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/volunteer-selector.tsx` | Create | Volunteer list with availability and skill context |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/sub-leader-roster-view.tsx` | Create | Read-only sub-team roster for sub_leader |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/super-admin-roster-view.tsx` | Create | Read-only oversight roster for super_admin |
| `apps/web/app/(app)/events/[id]/departments/[deptId]/_components/department-detail-card.tsx` | Modify | Add "Roster" navigation link |
| `supabase/seed.sql` | Modify | RS-F008 seed examples |
| `docs/tracking/progress.md` | Modify | Status updates on completion |
| `docs/tracking/claude-progress.txt` | Modify | Session handoff update |
| `docs/features/feature-list.json` | Modify | RS-F008 passes: true on completion |

---

## Rollout / Migration / Access Impact

**Schema:** New table `assignments`. No existing tables are altered. Purely additive.

**RLS:** Eight new policies on `assignments`. No changes to existing policies on other tables.

**Downstream contracts:**
- RS-F009 (skill-gap detection) will query `assignments WHERE deleted_at IS NULL AND event_id = ? AND department_id = ?` plus `volunteer_skills WHERE status = 'approved'` for the same volunteers. The columns and foreign keys introduced here provide that join path without further migration.
- RS-F010 (weekly dashboard) will query `assignments WHERE volunteer_id = auth.uid() AND deleted_at IS NULL` using the volunteer read RLS policy added here.
- RS-F012 (assignment response) will add status-transition actions (`acceptAssignment`, `declineAssignment`) that UPDATE the `status` column. The `status` check constraint defined here already includes `accepted`, `declined`, and `served` to avoid a later ALTER TABLE.

**Auth/roles:** No new roles. No changes to profile roles or the `profiles` table.

**Sub-leader scope:** Sub-leaders may create, edit, and remove assignments scoped to sub-teams they own (`sub_team_id IS NOT NULL`, ownership verified). They cannot touch dept-level assignments (`sub_team_id IS NULL`), other sub-leaders' sub-teams, or assign the `dept_head` role. Enforced at both RLS layer (policies 5 & 6) and server action layer.

**No environment variable changes. No storage changes. No background job changes.**

---

## Implementation Steps

1. **Create `supabase/migrations/00011_assignments.sql`:**
   - Create `assignments` table with all columns and constraints
   - Add five indexes (two lookup, two partial-unique, one sub_team)
   - Add `assignments_set_updated_at` trigger only — `set_updated_at()` function already exists in `00010_fix_profiles_rls_recursion.sql`; do not re-create the function
   - Enable RLS
   - Create all eight RLS policies as described in Approach

2. **Create `apps/web/lib/assignments/types.ts`:**
   - `Assignment`, `AssignmentWithContext`, `VolunteerForAssignment` as described in Approach

3. **Create `apps/web/lib/assignments/queries.ts`:**
   - `getAssignmentsForRoster(eventId, deptId)` — SELECT with JOIN profiles + sub_teams; ordered sub_team then name
   - `getSubLeaderAssignments(eventId, deptId, subTeamIds: string[])` — same SELECT filtered to `sub_team_id IN (subTeamIds)`
   - `getAllAssignmentsForEventDept(eventId, deptId)` — same SELECT; RLS scopes to super_admin
   - `getVolunteersForAssignment(deptId, eventId)` — volunteers with approved interest + is_available flag (blockout check against event_date from events JOIN) + already_assigned flag + approved_skills array; ordered available-first

4. **Create `apps/web/lib/assignments/actions.ts`:**
   - `createAssignment` — branches on caller role; dept_head: owns deptId, subTeamId optional; sub_leader: subTeamId required, owns sub-team, blocks role='dept_head'; both: verify interest + INSERT; 23505 → inline error
   - `updateAssignment` — branches on caller role; dept_head: owns dept; sub_leader: owns sub_team, blocks role='dept_head'; UPDATE role/sub_team_id
   - `removeAssignment` — branches on caller role; dept_head: owns dept; sub_leader: owns sub_team + sub_team_id IS NOT NULL; UPDATE deleted_at; revalidatePath

5. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/volunteer-selector.tsx`:**
   - Client component; receives `VolunteerForAssignment[]` as prop
   - Renders filterable list; each row: name + availability chip + skill tags
   - Highlights already-assigned volunteers as muted/disabled with "(already assigned)" label
   - Selected volunteer highlighted; single-select

6. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assign-volunteer-form.tsx`:**
   - Client component; receives volunteer list, sub-teams list (already scoped by caller), server action
   - Sub-team dropdown: dept_head sees all sub-teams + "No sub-team" option; sub_leader sees only owned sub-teams (required, no "No sub-team" option)
   - Serving role dropdown: "Volunteer" | "Sub-leader" only — `dept_head` option never rendered
   - Embeds `<VolunteerSelector>`
   - Submit: "Assign volunteer"; loading/disabled state; success resets form; inline error

7. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assignment-row.tsx`:**
   - Client component; receives one `AssignmentWithContext` + `onRemove` action + optional `onUpdate` action
   - Default state: row cells + status badge + "Remove" ghost button
   - Remove: two-step inline confirm — "Remove from roster?" → Confirm / Cancel (same RS-F007 pattern)
   - Edit: "Edit" button → inline edit mode for role/sub-team selectors within the row; "Save" + "Cancel"

8. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assignment-list.tsx`:**
   - Receives `AssignmentWithContext[]`, `readOnly` flag
   - Desktop: table with sticky header (Volunteer | Sub-team | Role | Status | Actions)
   - Mobile: stacked `<AssignmentRow>` cards
   - Empty state: "No volunteers assigned yet."
   - When `readOnly`: passes `readOnly={true}` to `AssignmentRow` — no action controls

9. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/sub-leader-roster-view.tsx`:**
   - Props: `assignments`, `subTeams` (all owned sub-teams in dept), `volunteers`, `eventId`, `deptId`
   - Heading: "Your teams" (or single sub-team name if only one)
   - Write-enabled: `<AssignVolunteerForm>` with sub-team selector limited to owned sub-teams; role selector excludes `dept_head`
   - `<AssignmentList readOnly={false} />` with edit/remove controls wired to server actions
   - Empty state: "No one has been assigned to your teams yet."

10. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/super-admin-roster-view.tsx`:**
    - Receives all assignments for the dept+event
    - Heading: "Roster — {dept name}" with "(read only)" label
    - `<AssignmentList readOnly={true} />`

11. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/dept-head-roster-view.tsx`:**
    - Receives assignments, volunteers, sub-teams, event+dept context
    - Page heading: "Roster — {dept name}" / event title
    - "Assign volunteer" toggle button → expands `<AssignVolunteerForm>`
    - `<AssignmentList>` (not readOnly); actions wired to server actions
    - Empty state when no assignments yet

12. **Create `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/page.tsx`:**
    - `getSessionWithProfile()` → guard
    - `getDepartmentById(deptId)` → notFound if missing
    - `getEventById(eventId)` → notFound if missing (reuse or add to events queries)
    - Role dispatch as described in Approach
    - Sub-leader: verify sub-leader has a sub-team in this dept; otherwise redirect to `/dashboard`

13. **Modify `apps/web/app/(app)/events/[id]/departments/[deptId]/page.tsx`:**
    - Compute `isSubLeaderInDept = session.profile.role === 'sub_leader' && department.sub_teams.some(st => st.owner_id === session.profile.id && st.deleted_at === null)`
    - Compute `canViewRoster = canManage || isSubLeaderInDept`
    - Pass `canViewRoster` to `DepartmentDetailCard`

    **Modify `apps/web/app/(app)/events/[id]/departments/[deptId]/_components/department-detail-card.tsx`:**
    - Add `canViewRoster: boolean` to props interface
    - Add "View Roster" `<Link>` pointing to `/events/${eventId}/departments/${department.id}/roster` when `canViewRoster` is true
    - Position: in the dept header actions row, secondary style consistent with existing "Edit" link

14. **Append RS-F008 seed examples to `supabase/seed.sql`:**
    - Commented examples: one assignment record (dept_head assigns a volunteer into their department)

15. **Run `npm run typecheck && npm run lint && npm run build` — all must pass**

16. **Update docs:** `docs/tracking/progress.md`, `docs/features/feature-list.json`, `docs/tracking/claude-progress.txt`, this plan (status → Implemented)

---

## Acceptance Criteria Mapping

**Feature registry steps (from feature-list.json):**

| Registry Step | How It Is Met |
|---|---|
| Create assignment records tied to event structure and volunteer context | `assignments` table links event_id + department_id + sub_team_id (optional) + volunteer_id + role; `createAssignment` action inserts with FK integrity |
| Expose relevant planning context while leaders assign or adjust rosters | `getVolunteersForAssignment` surfaces availability flag (blockout on event date) and approved skills per volunteer in the dept |
| Treat removal and reassignment as controlled high-impact actions | `removeAssignment` soft-deletes; confirmation enforced via two-step inline UI; re-assignment requires removing the old row first (duplicate insert → inline error) |

**PRD validation items:**

| PRD Item | Verification |
|---|---|
| Create assignments across departments and verify stored with required references | Manual: dept_head assigns volunteer in two different depts in same event; verify DB rows have correct event_id, department_id, volunteer_id |
| Edit an assignment and confirm updated role or placement reflected | Manual: dept_head changes role from 'volunteer' to 'sub_leader' or changes sub-team; verify DB and UI update |
| Remove an assignment and confirm confirmation required before change applied | Manual: click Remove → confirm step appears → Confirm → row disappears; clicking Cancel leaves row intact |

**Additional validation checks:**

- Sub-leader sees only their sub-team's assignments; cannot assign or remove
- Super_admin sees all assignments for a dept+event; no action controls
- Volunteer with no approved interest in dept cannot be assigned (action returns error)
- Duplicate assignment (same volunteer + event + dept/sub-team slot) returns inline error "This volunteer is already assigned to this slot"
- Availability context: volunteer with a blockout on the event date shows amber "Blocked" chip in selector; assignment can still be created (availability is advisory)
- Approved skills shown in volunteer selector for each candidate
- Assignment status is `invited` on creation; status transitions are deferred to RS-F012
- Mobile: assignment list collapses to stacked cards at < 640px; no horizontal overflow; confirm/edit controls reachable

---

## Style Guardrails For UI Work

**Target surfaces:** Leader (dept_head, sub_leader, super_admin) — operational, cool-toned.

**Background:** `bg-surface-cool` (`#F3F7FF`) — apply at the roster page level or within the main view component, consistent with other leader surfaces.

**Headings:** `text-h2` DM Sans — "Roster — {department name}"; event title as `text-body-sm text-neutral-600` subtitle.

**Assignment list (desktop):**
- Use a table layout from `1024px` upward per design-system guidance on dense leader data
- Sticky header (if list grows long): column labels in `text-body-sm font-semibold text-neutral-600`
- Row hover: `hover:bg-surface-cool/50` with no color-only highlight (underline or border change on active rows)
- Status badge per row: use or extend `StatusBadge` from RS-F007; assignment statuses use semantic tokens — `invited` (neutral/muted), `accepted` (success), `declined` (error), `served` (neutral)

**Assignment list (mobile):** Single-column stacked cards per row; same border/radius as existing management cards.

**Volunteer selector:**
- Availability chip: "Available" — `bg-semantic-success/10 text-semantic-success`; "Blocked" — `bg-semantic-warning/10 text-semantic-warning`
- Skill tags: small inline pills, `bg-surface-cool text-neutral-700 border border-neutral-300`
- Already-assigned: muted row with `text-neutral-400`, `(assigned)` label, `cursor-not-allowed`

**Forms:**
- Sub-team and role dropdowns: consistent with existing `<select>` style (`rounded-200 border border-neutral-300 ...`)
- "Assign volunteer" primary button: `bg-brand-calm-600` style (same as other leader primary actions)
- Inline error: `text-semantic-error text-body-sm`

**Remove / confirm pattern:** Follow the RS-F006/RS-F007 two-step inline confirm exactly — "Remove from roster?" / Confirm (error-red underline) / Cancel (neutral underline). No modal for row-level remove.

**Tone:** Direct and operational. Button labels: "Assign volunteer", "Save changes", "Remove from roster". No promotional language. Error messages calm and actionable.

**States requiring fidelity:**
- Volunteer selector: loading (initial), populated with availability + skills, empty (no eligible volunteers)
- Assignment form: loading on submit, success (form resets, list updates), duplicate error
- Remove: per-row inline confirm → loading → row disappears
- Edit role/sub-team: per-row inline edit mode → loading → row updates
- Assignment list: empty state, partial (some assigned), populated

---

## Risks Or Blockers

1. **`getVolunteersForAssignment` query complexity:** Joining events (for event_date), availability_blockouts (for blockout check), volunteer_interests (for approved interest gate), and volunteer_skills (for skill list) in one query is complex. Consider whether to split into two queries (one for volunteer eligibility + availability, one for skills per volunteer) to avoid over-joining. Verify Supabase client can handle the JS-side aggregation if skills come back as multiple rows.

2. **Sub-leader access to roster page:** Sub-leaders need to land on `/events/[id]/departments/[deptId]/roster` but can only see their sub-team. The page needs to verify the sub-leader actually has a sub-team in this department before rendering — a sub-leader navigating to a department they don't belong to should be redirected cleanly.

3. **Duplicate assignment UX:** One active assignment per volunteer per event per department — enforced by `idx_assignments_vol_event_dept` on `(volunteer_id, event_id, department_id) WHERE deleted_at IS NULL`. `sub_team_id` is a placement field on the row, not a separate slot dimension. A volunteer cannot hold two active assignments in the same dept for the same event regardless of sub_team. Duplicate INSERT → 23505 → inline error.

4. **`set_updated_at` function:** Confirmed exists in `00010_fix_profiles_rls_recursion.sql`. Migration 00011 must only add the trigger — not re-declare the function.

5. **`getEventById` reuse:** The roster page needs to fetch the event record (for title and event_date context). Check whether an existing `getEventById` query exists in `lib/events/queries.ts` or whether one needs to be added. Do not duplicate the query.

6. **Availability is advisory:** The availability flag in the volunteer selector is informational only — the leader can still assign a blocked volunteer. The UI must communicate this clearly (amber chip + tooltip or label), not block the action.

---

## Validation Plan

### Automated checks
- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm run build` — passes
- Migration 00011 applies cleanly on top of 00010 (verify with `npx supabase db reset` when Docker available)

### Manual checks (20 items)

1. Sign in as dept_head → open an event → open their department → see "Roster" link/button in the dept detail card; sub_leader also sees it
2. Navigate to `/events/[id]/departments/[deptId]/roster` → leader view renders with correct event + dept heading
3. Dept_head assigns a volunteer (no sub-team): assignment row appears with status "Invited"; DB row confirms event_id, department_id, volunteer_id, role, status='invited', created_by set
4. Assign the same volunteer to the same slot → inline error "This volunteer is already assigned in this department for this event"
5. Volunteer in the selector with a blockout on the event date → shows amber "Blocked" chip; can still be assigned
6. Volunteer with no approved interest in dept → not visible in the selector
7. Volunteer with approved skills for the dept → skills visible as tags in the selector row
8. Dept_head assigns a volunteer to a specific sub-team → assignment row shows sub-team name; DB confirms sub_team_id set
9. Dept_head edits assignment role from "Volunteer" to "Sub-leader" → row updates; DB confirms
10. Dept_head removes an assignment → "Remove from roster?" confirm step appears → Cancel → row remains; Confirm → row disappears; DB row has deleted_at set
11. Sign in as sub_leader with owned sub-team(s) in the department → roster page renders **write-enabled** view; assign form visible with sub-team selector limited to owned sub-teams; role dropdown excludes `dept_head`
12. Sub_leader assigns a volunteer to one of their owned sub-teams → assignment appears; DB row has sub_team_id set correctly
13. Sub_leader attempts to assign with role = dept_head → option absent from dropdown; if action called directly it returns an error
14. Sub_leader attempts to remove an assignment in a sub-team they do not own → action returns unauthorized
15. Sub_leader owning two sub-teams in the same dept → both appear in the sub-team selector; assignments from both shown in the list
16. Sub_leader with no owned sub-teams in this dept → redirected to `/dashboard`
17. Sign in as super_admin → roster page renders read-only view of all assignments for the dept; no action controls
18. Sign in as volunteer → navigating to `/events/[id]/departments/[deptId]/roster` redirects to `/dashboard`
19. Assignment list on mobile (320–375px): stacked card layout, no horizontal overflow, confirm and cancel controls reachable
20. Dept_head with no assignments yet → empty state "No volunteers assigned yet." shown; design-fidelity review: cool-tone palette, DM Sans, correct spacing tokens, status badge semantic colours, two-step confirm matches RS-F006/RS-F007 pattern

---

## Documentation Updates

On completion:
- `docs/tracking/progress.md` — RS-F008 status: `passed`
- `docs/features/feature-list.json` — RS-F008 `passes: true`
- `docs/tracking/claude-progress.txt` — full handoff update for next session
- This plan file — status updated to `Implemented and Validated`
