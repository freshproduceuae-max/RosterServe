I now have comprehensive knowledge of the codebase. Here is the complete implementation plan.

---

# Implementation Plan: RS-F019 â€” Department Task Library + Task Assignment

**Status:** DRAFT â€” Pending approval before implementation begins
**Type:** Feature
**Source PRD:** `/VisionDocument_ChurchRosterApp.md` (centralize assignments and role clarity)
**Migration range:** 00037â€“00038 (RS-F020 owns 00036)

---

## Objective

Each department maintains a persistent, named task library (e.g. "Sound desk", "Projection"). Tasks optionally reference a required skill from the `department_skills` catalog. For each event, Dept Heads and Team Heads assign tasks to specific members from that event's roster. The assignment UI shows a green/amber/red badge per volunteer indicating skill match, skill gap, or availability conflict. The Dept Head dashboard receives an `unassignedTasksCount` metric surfacing tasks with no volunteer for upcoming events in owned departments.

---

## Scope

**In scope:**
- `department_tasks` table â€” persistent task library per department, soft-delete, optional `required_skill_id` FK
- `event_task_assignments` table â€” per-event allocations linking a task slot to a volunteer (nullable = unassigned)
- RLS for both tables following the SECURITY DEFINER helper pattern
- Server actions: create/update/delete tasks in the library; assign/unassign volunteers to event task slots
- Task library management UI on `/departments/[deptId]` â€” new "Tasks" section (dept head only)
- Task assignment UI on `/events/[id]/departments/[deptId]/roster` â€” new "Tasks" section below existing sections
- Badge logic: green (skill match or no skill required), amber (skill gap), red (availability conflict)
- `unassignedTasksCount` added to `getDeptHeadDashboardData` and surfaced on the Dept Head dashboard card

**Non-goals:**
- Tasks are not linked to `assignments` rows â€” this is an independent overlay
- No volunteer notification emails for task assignment (task assignment is internal planning, not a serving commitment)
- No volunteer-facing task view in this phase
- No bulk task creation from template libraries
- No task ordering/priority

---

## Applied Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | `event_task_assignments.volunteer_id` is nullable | Unassigned slots (null volunteer) are the primary gap signal on the dashboard. The alternative of only creating rows when assigning would require a separate "slot count" field on the task. |
| D2 | Unique constraint `(event_id, task_id)` on `event_task_assignments` (not on volunteer) | One slot per task per event. A task like "Sound desk" has exactly one responsible person per event. If the use case later requires multiple people per task, the constraint is dropped in a future migration. |
| D3 | Task library management on `/departments/[deptId]` (dept head only) | Consistent with other department-level settings (teams, headcount). Keeps the "what tasks exist" concern separate from "who does them for this event". |
| D4 | Task assignment on the existing roster page | The roster page already has all the data it needs (event date for blockout checks, approved skills). Adding a section keeps context co-located. No new route is needed. |
| D5 | Badge computation done in the query layer (JS merge), not SQL | Mirrors the exact pattern in `getVolunteersForAssignment` and `getCrossTeamSuggestions`. Avoids complex SQL CASE expressions that are harder to test. |
| D6 | Team head can assign tasks scoped to members of their own sub-teams | Mirrors the pattern in `createAssignment` where team_head is constrained to their owned sub_team. Ownership check: the task's department must have a team owned by the caller. |
| D7 | Soft-delete task library entries via `deleted_at`; cascade to `event_task_assignments` via FK `ON DELETE CASCADE` on `task_id` | When a task is deleted from the library, its event allocations become meaningless and should be cleaned up. Hard cascade is correct here â€” there is no audit need for deleted task slots. |
| D8 | `UNIQUE(department_id, lower(name)) DEFERRABLE` on `department_tasks` | Prevents duplicate task names in the same department case-insensitively. Deferrable so bulk seeds within a transaction can be ordered freely. Note: `lower()` in a unique constraint requires a functional unique index â€” use explicit index, not inline constraint (see migration). |
| D9 | Separate migrations 00037 (task library) and 00038 (event assignments) | Matches the existing pattern of one-concept-per-migration and makes rollback surgical. |
| D10 | `unassignedTasksCount` computed via a single count query in `getDeptHeadDashboardData`, scoped to the same 14-day window as other metrics | Consistent window. Simple count query, no new in-memory aggregation needed. |
| D11 | RLS uses `i_own_dept()` and `i_have_sub_team_in_dept()` helpers exclusively â€” no raw `EXISTS (SELECT â€¦ FROM departments)` in policies | Prevents the recursion cycle documented in migration 00033. Same mandatory rule applied to all new policies on these two tables. |
| D12 | No `team_head` role on `event_task_assignments` â€” team head auth checked server-side via `i_have_sub_team_in_dept()` | The team_head INSERT/UPDATE RLS policy on `event_task_assignments` uses the helper function, not a raw join to teams. |
| D13 | `super_admin` SELECT policy on both tables omits `deleted_at IS NULL` (sees soft-deleted rows) | Intentional and consistent with every other super_admin SELECT policy in this codebase (assignments, department_members, events, etc.). Super admin needs full audit visibility. |

---

## Database Migrations

### Migration 00037 â€” `department_tasks` table + RLS

File: `/supabase/migrations/00037_department_tasks.sql`

```sql
-- RS-F019: Department Task Library
-- Creates the department_tasks table for persistent, reusable tasks per department.
-- Tasks optionally link to a required skill from department_skills.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.department_tasks (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id    uuid        NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name             text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  required_skill_id uuid       REFERENCES public.department_skills(id) ON DELETE SET NULL,
  created_by       uuid        NOT NULL REFERENCES public.profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

-- Case-insensitive unique task name per department (active records only)
-- Uses a partial functional unique index because a constraint expression like
-- UNIQUE(department_id, lower(name)) is not supported directly in DDL.
CREATE UNIQUE INDEX idx_department_tasks_name_unique
  ON public.department_tasks (department_id, lower(name))
  WHERE deleted_at IS NULL;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_department_tasks_dept
  ON public.department_tasks (department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_department_tasks_skill
  ON public.department_tasks (required_skill_id)
  WHERE required_skill_id IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- TRIGGER
-- update_updated_at() defined in 00001_auth_profiles.sql
-- ============================================================

CREATE TRIGGER department_tasks_set_updated_at
  BEFORE UPDATE ON public.department_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.department_tasks ENABLE ROW LEVEL SECURITY;

-- Super admin: full read including soft-deleted
CREATE POLICY "Super admins can read all department tasks"
  ON public.department_tasks FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- Dept head: read active tasks in owned departments
CREATE POLICY "Dept heads can read tasks in owned departments"
  ON public.department_tasks FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- Team head: read active tasks in departments where they own a sub-team
CREATE POLICY "Team heads can read tasks in their department"
  ON public.department_tasks FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- all_depts_leader: read all active tasks
CREATE POLICY "All depts leaders can read department tasks"
  ON public.department_tasks FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- Dept head: create tasks in owned departments
CREATE POLICY "Dept heads can create tasks in owned departments"
  ON public.department_tasks FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
    AND created_by = auth.uid()
  );

-- Dept head: update (rename, change skill) active tasks in owned departments
CREATE POLICY "Dept heads can update tasks in owned departments"
  ON public.department_tasks FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  )
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );
```

### Migration 00038 â€” `event_task_assignments` table + RLS

File: `/supabase/migrations/00038_event_task_assignments.sql`

```sql
-- RS-F019: Per-event task allocations
-- Links a task from the department library to a specific event and optionally
-- a volunteer. volunteer_id IS NULL means the slot is unassigned.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE public.event_task_assignments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  department_id uuid        NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  task_id       uuid        NOT NULL REFERENCES public.department_tasks(id) ON DELETE CASCADE,
  volunteer_id  uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    uuid        NOT NULL REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

-- One active slot per task per event
CREATE UNIQUE INDEX idx_event_task_assignments_unique
  ON public.event_task_assignments (event_id, task_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_event_task_assignments_event_dept
  ON public.event_task_assignments (event_id, department_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_event_task_assignments_volunteer
  ON public.event_task_assignments (volunteer_id)
  WHERE volunteer_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_event_task_assignments_task
  ON public.event_task_assignments (task_id)
  WHERE deleted_at IS NULL;

-- ============================================================
-- TRIGGER
-- ============================================================

CREATE TRIGGER event_task_assignments_set_updated_at
  BEFORE UPDATE ON public.event_task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.event_task_assignments ENABLE ROW LEVEL SECURITY;

-- Super admin: full read
CREATE POLICY "Super admins can read all event task assignments"
  ON public.event_task_assignments FOR SELECT
  USING (public.get_my_role() = 'super_admin');

-- all_depts_leader: read all active
CREATE POLICY "All depts leaders can read event task assignments"
  ON public.event_task_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- Dept head: read active assignments in owned departments
CREATE POLICY "Dept heads can read event task assignments in owned depts"
  ON public.event_task_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- Team head: read active assignments in departments where they own a sub-team
CREATE POLICY "Team heads can read event task assignments in their dept"
  ON public.event_task_assignments FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- Dept head: create task assignment slots in owned departments
CREATE POLICY "Dept heads can create event task assignments in owned depts"
  ON public.event_task_assignments FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
    AND created_by = auth.uid()
  );

-- Team head: create task assignment slots in departments where they own a sub-team
CREATE POLICY "Team heads can create event task assignments in their dept"
  ON public.event_task_assignments FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
    AND created_by = auth.uid()
  );

-- Dept head: update (assign/unassign volunteer) in owned departments
CREATE POLICY "Dept heads can update event task assignments in owned depts"
  ON public.event_task_assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  )
  WITH CHECK (
    public.get_my_role() = 'dept_head'
    AND public.i_own_dept(department_id)
  );

-- Team head: update (assign/unassign volunteer) in their department
CREATE POLICY "Team heads can update event task assignments in their dept"
  ON public.event_task_assignments FOR UPDATE
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  )
  WITH CHECK (
    public.get_my_role() = 'team_head'
    AND public.i_have_sub_team_in_dept(department_id)
  );

-- NOTE: No SELECT policy for role='volunteer' is intentional in RS-F019.
-- Volunteer-facing task visibility (e.g. "see what you're doing this Sunday") is
-- deferred to a future feature. When that feature is built, add a policy here:
--   USING (public.get_my_role() = 'volunteer' AND volunteer_id = auth.uid())
-- Do NOT add a partial implementation of this policy in a hotfix without
-- understanding the full scope of the volunteer task view feature.
```

---

## File Map

### New files to create

| File | Purpose |
|------|---------|
| `/supabase/migrations/00037_department_tasks.sql` | Schema + RLS for task library |
| `/supabase/migrations/00038_event_task_assignments.sql` | Schema + RLS for per-event allocations |
| `/apps/web/lib/tasks/types.ts` | TypeScript types: `DepartmentTask`, `EventTaskAssignment`, `TaskWithBadge`, `EventTaskSlot` |
| `/apps/web/lib/tasks/schemas.ts` | Zod schemas: `createTaskSchema`, `updateTaskSchema` |
| `/apps/web/lib/tasks/queries.ts` | `getTasksForDepartment`, `getEventTaskSlots`, `getVolunteersWithBadges` |
| `/apps/web/lib/tasks/actions.ts` | `createTask`, `updateTask`, `deleteTask`, `upsertEventTaskAssignment`, `removeEventTaskAssignment` |
| `/apps/web/app/(app)/departments/[deptId]/_components/task-library-section.tsx` | Client component: task library CRUD list for dept head |
| `/apps/web/app/(app)/departments/[deptId]/_components/task-form.tsx` | Client component: create/edit task form (name + optional skill dropdown) |
| `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-assignment-section.tsx` | Client component: task slots list with volunteer picker per slot |
| `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-volunteer-badge.tsx` | Pure presentational: renders green/amber/red badge |
| `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-slot-row.tsx` | Client component: single task slot row with inline assign/unassign |

### Files to modify

| File | Change |
|------|--------|
| `/apps/web/app/(app)/departments/[deptId]/page.tsx` | Fetch task library for canManage, render `<TaskLibrarySection>` |
| `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/page.tsx` | Fetch event task slots + volunteer badges data, pass to role views |
| `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/dept-head-roster-view.tsx` | Accept `taskSlots` and `taskVolunteers` props, render `<TaskAssignmentSection>` |
| `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/team-head-roster-view.tsx` | Same â€” receive and render task section |
| `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/super-admin-roster-view.tsx` | Same â€” read-only view of task slots (no assignment controls) |
| `/apps/web/lib/dashboard/types.ts` | Add `unassignedTasksCount: number` to `DeptHeadDashboardData` |
| `/apps/web/lib/dashboard/queries.ts` | Add count query in `getDeptHeadDashboardData`, include in return |
| `/apps/web/app/(app)/dashboard/_components/dept-head-dashboard.tsx` | Render `unassignedTasksCount` alert badge in relevant event card |
| `/apps/web/lib/skills/queries.ts` | Add `getDepartmentSkillsForDropdown(deptId)` â€” single-dept skill list for task form dropdown |
| `/apps/web/lib/skills/gap-queries.ts` | No change â€” badge logic lives in tasks/queries.ts, not here |

---

## Implementation Tasks

### Phase 1: Database

**Task 1 â€” Create migration 00037**

File: `/supabase/migrations/00037_department_tasks.sql`

Write the exact SQL from the migration section above. No deviations.

Verification: `supabase db reset` completes without error. `\d public.department_tasks` in psql shows columns, indexes, and RLS enabled. `SELECT policyname FROM pg_policies WHERE tablename = 'department_tasks'` returns 5 policies.

---

**Task 2 â€” Create migration 00038**

File: `/supabase/migrations/00038_event_task_assignments.sql`

Write the exact SQL from the migration section above. No deviations.

Verification: `supabase db reset` completes without error. `\d public.event_task_assignments` shows columns, the partial unique index, and RLS enabled. `SELECT policyname FROM pg_policies WHERE tablename = 'event_task_assignments'` returns 8 policies.

---

### Phase 2: TypeScript Foundation

**Task 3 â€” Types**

File: `/apps/web/lib/tasks/types.ts`

```typescript
export type DepartmentTask = {
  id: string;
  department_id: string;
  name: string;
  required_skill_id: string | null;
  required_skill_name: string | null; // joined from department_skills
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type EventTaskAssignment = {
  id: string;
  event_id: string;
  department_id: string;
  task_id: string;
  volunteer_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

// A task slot for a specific event, ready for the assignment UI
export type EventTaskSlot = {
  // from event_task_assignments (null if slot not yet created)
  assignment_id: string | null;
  task_id: string;
  task_name: string;
  required_skill_id: string | null;
  required_skill_name: string | null;
  volunteer_id: string | null;
  volunteer_display_name: string | null;
  badge: TaskBadge; // computed on the volunteer currently assigned
};

export type TaskBadge = "skill_match" | "skill_gap" | "availability_conflict" | "unassigned";

// A volunteer candidate enriched for the task assignment picker
export type VolunteerTaskCandidate = {
  id: string;
  display_name: string;
  badge: TaskBadge; // computed against the specific task's required_skill_id
};
```

---

**Task 4 â€” Schemas**

File: `/apps/web/lib/tasks/schemas.ts`

```typescript
import { z } from "zod";

export const createTaskSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID."),
  name: z
    .string()
    .trim()
    .min(1, "Task name is required.")
    .max(100, "Task name must be under 100 characters."),
  requiredSkillId: z.string().uuid("Invalid skill.").optional().or(z.literal("")),
});

export const updateTaskSchema = z.object({
  id: z.string().uuid("Invalid task ID."),
  name: z
    .string()
    .trim()
    .min(1, "Task name is required.")
    .max(100, "Task name must be under 100 characters."),
  requiredSkillId: z.string().uuid("Invalid skill.").optional().or(z.literal("")),
});

export type CreateTaskValues = z.infer<typeof createTaskSchema>;
export type UpdateTaskValues = z.infer<typeof updateTaskSchema>;
```

---

### Phase 3: Query Layer

**Task 5 â€” Task queries**

File: `/apps/web/lib/tasks/queries.ts`

Three exported functions:

**`getTasksForDepartment(deptId: string): Promise<DepartmentTask[]>`**

Steps:
1. `createSupabaseServerClient()`
2. Query `department_tasks` with a join to `department_skills` for the skill name:
   ```
   .from("department_tasks")
   .select("*, required_skill:department_skills!required_skill_id(name)")
   .eq("department_id", deptId)
   .is("deleted_at", null)
   .order("name", { ascending: true })
   ```
3. Map raw rows: flatten `required_skill?.name` into `required_skill_name`. Return `DepartmentTask[]`.

**`getEventTaskSlots(eventId: string, deptId: string): Promise<EventTaskSlot[]>`**

Steps:
1. `createSupabaseServerClient()`
2. Fetch all active tasks for the department via the same query as above.
3. Fetch all active `event_task_assignments` for this event+dept:
   ```
   .from("event_task_assignments")
   .select("*, volunteer:profiles!volunteer_id(display_name)")
   .eq("event_id", eventId)
   .eq("department_id", deptId)
   .is("deleted_at", null)
   ```
4. Build a `Map<task_id, assignment_row>` from step 3.
5. For each task, if an assignment row exists with a `volunteer_id`, compute the badge using the pre-fetched data (see `getVolunteersWithBadgesForTask` below, but inline here to avoid N+1 â€” fetch blockouts and approved skills in bulk before the loop):

   Pre-fetch bulk:
   - `event_date` from `events` table
   - `volunteer_id`s from assignment rows (filter non-null)
   - `availability_blockouts` for those volunteer IDs on `event_date`
   - `volunteer_skills` approved rows for those volunteer IDs in `deptId`

   Badge computation per slot:
   - If `volunteer_id` is null â†’ `"unassigned"`
   - If `availability_blockouts` has a row for this volunteer on event_date â†’ `"availability_conflict"`
   - Else if `task.required_skill_id` is null â†’ `"skill_match"`
   - Else if volunteer has approved `volunteer_skills` row where `skill_id = task.required_skill_id` â†’ `"skill_match"`
   - Else â†’ `"skill_gap"`

6. Return `EventTaskSlot[]` (one slot per task, ordered by task name).

**`getVolunteersWithBadgesForTask(eventId: string, deptId: string, taskId: string): Promise<VolunteerTaskCandidate[]>`**

Used by the assignment picker. Steps:
1. Fetch `event_date` for the event.
2. Fetch task row (required_skill_id) for `taskId`.
3. Fetch volunteers with approved interest in `deptId` (same query as `getVolunteersForAssignment`).
4. Fetch blockouts for those volunteers on event_date.
5. If `task.required_skill_id` is not null, fetch approved `volunteer_skills` rows where `skill_id = task.required_skill_id` for those volunteers.
6. Compute badge per volunteer using the same three-step logic above.
7. Sort: skill_match + available first, then skill_match + blocked, then skill_gap + available, then skill_gap + blocked.
8. Return `VolunteerTaskCandidate[]`.

---

### Phase 4: Server Actions

**Task 6 â€” Task library actions**

File: `/apps/web/lib/tasks/actions.ts`

All actions follow the exact pattern from `/apps/web/lib/assignments/actions.ts`.

**`createTask(deptId, name, requiredSkillId?): Promise<{error?: string; success?: boolean}>`**
1. `getSessionWithProfile()` â†’ error if null
2. Role check: `dept_head` only
3. `createSupabaseServerClient()`
4. Ownership: `.from("departments").select("id").eq("id", deptId).eq("owner_id", session.profile.id).is("deleted_at", null).maybeSingle()` â†’ error if null
5. Zod parse `createTaskSchema` on inputs
6. If `requiredSkillId` provided, verify it belongs to `deptId`: `.from("department_skills").select("id").eq("id", requiredSkillId).eq("department_id", deptId).is("deleted_at", null).maybeSingle()` â†’ error if null
7. `.from("department_tasks").insert({...})`
8. Handle `error.code === "23505"` â†’ "A task with this name already exists in this department"
9. `revalidatePath("/departments/" + deptId)`
10. Return `{ success: true }`

**`updateTask(taskId, name, requiredSkillId?): Promise<{error?: string; success?: boolean}>`**
1â€“3. Same auth/role/client setup.
4. Fetch task row (id, department_id) â†’ error if not found or deleted
5. Ownership check on `task.department_id`
6. Zod parse `updateTaskSchema`
7. Verify `requiredSkillId` belongs to the same department (if provided)
8. `.from("department_tasks").update({name, required_skill_id: requiredSkillId ?? null}).eq("id", taskId).is("deleted_at", null)`
9. Handle 23505 â†’ duplicate name error
10. `revalidatePath("/departments/" + task.department_id)`
11. Return `{ success: true }`

**`deleteTask(taskId): Promise<{error?: string; success?: boolean}>`**
1â€“3. Same setup.
4. Fetch task (id, department_id) â†’ error if not found
5. Ownership check
6. `.from("department_tasks").update({ deleted_at: new Date().toISOString() }).eq("id", taskId).is("deleted_at", null)` â€” soft delete. RLS ON DELETE CASCADE on `event_task_assignments.task_id` is a hard FK cascade â€” soft-deleting the task does NOT hard-cascade event assignment rows; those rows become orphaned. Handle this by also soft-deleting linked event_task_assignments in the same action: `.from("event_task_assignments").update({ deleted_at: now }).eq("task_id", taskId).is("deleted_at", null)` (run this before the task soft-delete so the task is still RLS-accessible during the child update).
7. `revalidatePath("/departments/" + task.department_id)`
8. Return `{ success: true }`

Note on D7 re-evaluation: The FK is `ON DELETE CASCADE` at the DB level, but this only fires on hard DELETE, not on UPDATE to set `deleted_at`. Therefore the action must manually soft-delete child rows. This is the correct pattern â€” other actions like `softDeleteDepartment` manually cascade to teams.

**`upsertEventTaskAssignment(eventId, deptId, taskId, volunteerId: string | null): Promise<{error?: string; success?: boolean}>`**
1. `getSessionWithProfile()` â†’ error if null
2. Role check: `dept_head` OR `team_head`
3. `createSupabaseServerClient()`
4. Auth: if `dept_head` â†’ ownership on `deptId`; if `team_head` â†’ `i_have_sub_team_in_dept` equivalent: fetch a team in deptId where `owner_id = session.profile.id` â†’ error if not found
5. Verify `taskId` belongs to `deptId` and is not deleted
6. If `volunteerId` is not null, verify volunteer has approved interest in `deptId` (consistent with `createAssignment`)
7. Upsert: `.from("event_task_assignments").upsert({ event_id: eventId, department_id: deptId, task_id: taskId, volunteer_id: volunteerId, created_by: session.profile.id }, { onConflict: "event_id,task_id" })` â€” this inserts or updates the slot. Note: upsert by the unique index columns. Because `deleted_at` is in the partial unique index condition (`WHERE deleted_at IS NULL`), a previously soft-deleted row will not conflict. Use upsert with `ignoreDuplicates: false` and handle by fetching the existing row first if needed. Alternatively: attempt `.maybeSingle()` to find existing active row, then UPDATE if found, INSERT if not. Use the fetch-then-write pattern to avoid the partial-index upsert edge case.

   Concrete implementation:
   ```
   const existing = await supabase
     .from("event_task_assignments")
     .select("id")
     .eq("event_id", eventId)
     .eq("task_id", taskId)
     .is("deleted_at", null)
     .maybeSingle();

   if (existing.data) {
     await supabase
       .from("event_task_assignments")
       .update({ volunteer_id: volunteerId })
       .eq("id", existing.data.id);
   } else {
     await supabase
       .from("event_task_assignments")
       .insert({ event_id: eventId, department_id: deptId, task_id: taskId, volunteer_id: volunteerId, created_by: session.profile.id });
   }
   ```
8. `revalidatePath("/events/" + eventId + "/departments/" + deptId + "/roster")`
9. Return `{ success: true }`

**`removeEventTaskAssignment(assignmentId, eventId, deptId): Promise<{error?: string; success?: boolean}>`**
1â€“3. Auth/role/client.
4. Fetch assignment row â†’ error if not found or deleted
5. Ownership check (same as upsert step 4)
6. Soft-delete: `.update({ deleted_at: now }).eq("id", assignmentId)`
7. `revalidatePath(rosterPath)`
8. Return `{ success: true }`

---

### Phase 5: Department Page â€” Task Library Section

**Task 7 â€” `TaskLibrarySection` component**

File: `/apps/web/app/(app)/departments/[deptId]/_components/task-library-section.tsx`

Client component (`"use client"`).

Props:
```typescript
interface TaskLibrarySectionProps {
  departmentId: string;
  tasks: DepartmentTask[];
  availableSkills: { id: string; name: string }[]; // from department_skills for the dropdown
  canManage: boolean; // only dept_head owner sees create/edit/delete
}
```

Renders:
- Section header "Task Library" with "Add task" button (only if `canManage`)
- If no tasks and canManage: empty state prompt
- If no tasks and not canManage: nothing (section hidden)
- List: one row per task showing `task.name`, optional skill badge `(requires: {skill_name})`, Edit and Delete buttons (canManage only)
- Inline form toggle: clicking "Add task" or "Edit" shows `<TaskForm>` (create or edit mode)
- Delete: confirmation modal pattern matching `DeleteConfirmModal` used in `TeamListSection`

State: `showForm: boolean`, `editingTask: DepartmentTask | null`, `deletingTaskId: string | null`

Delete uses `deleteTask` server action wrapped in `useTransition`. Uses the `DeleteConfirmModal` component — import path from `task-library-section.tsx`:
```typescript
import { DeleteConfirmModal } from "../../_components/delete-confirm-modal";
```
(`task-library-section.tsx` lives at `departments/[deptId]/_components/`, so `../../_components/` resolves to `departments/_components/`.)

**Task 8 â€” `TaskForm` component**

File: `/apps/web/app/(app)/departments/[deptId]/_components/task-form.tsx`

Client component (`"use client"`).

Props:
```typescript
interface TaskFormProps {
  departmentId: string;
  availableSkills: { id: string; name: string }[];
  initialValues?: { id: string; name: string; required_skill_id: string | null };
  onSuccess: () => void;
  onCancel: () => void;
}
```

Form fields:
- `name`: text input (required, max 100)
- `required_skill_id`: select dropdown, first option "No skill required" (value ""), then one option per skill in `availableSkills`

Submission: calls `createTask` or `updateTask` server action via `useTransition`. On success calls `onSuccess()`. Shows inline error string on failure. Loading state disables buttons and shows "Saving...".

**Task 8b â€” Add `getDepartmentSkillsForDropdown` to skills queries (REQUIRED before Task 9)**

File: `/apps/web/lib/skills/queries.ts`

This function does not currently exist. `getDepartmentSkillsForLeader()` returns skills across all owned departments with no `deptId` filter. The task form needs a single-dept filtered list for the dropdown.

Add:
```typescript
export async function getDepartmentSkillsForDropdown(
  deptId: string,
): Promise<{ id: string; name: string }[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(“department_skills”)
    .select(“id, name”)
    .eq(“department_id”, deptId)
    .is(“deleted_at”, null)
    .order(“name”, { ascending: true });
  if (error || !data) return [];
  return data as { id: string; name: string }[];
}
```

No auth guard needed — this is called from a server component that already enforces canManage. RLS on `department_skills` will enforce the dept_head ownership check at the DB layer.

**Task 9 â€” Modify department detail page**

File: `/apps/web/app/(app)/departments/[deptId]/page.tsx`

Changes:
1. Import `getTasksForDepartment` from `@/lib/tasks/queries`
2. Import `getDepartmentSkillsForDropdown` from `@/lib/skills/queries` (added in Task 8b above)
3. In the page body, inside the `canManage` branch of data fetching, add:
   ```typescript
   const [ownerNames, members, tasks, skills] = await Promise.all([
     getOwnerDisplayNames(ownerIds),
     canManage ? getDepartmentMembers(deptId) : Promise.resolve([]),
     canManage ? getTasksForDepartment(deptId) : Promise.resolve([]),
     canManage ? getDepartmentSkillsForDropdown(deptId) : Promise.resolve([]),
   ]);
   ```
4. Render `<TaskLibrarySection>` below `<MembersSection>`, only when `canManage`.

---

### Phase 6: Roster Page â€” Task Assignment Section

**Task 10 â€” `TaskVolunteerBadge` component**

File: `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-volunteer-badge.tsx`

Pure presentational, no state.

```typescript
import type { TaskBadge } from "@/lib/tasks/types";

export function TaskVolunteerBadge({ badge }: { badge: TaskBadge }) {
  if (badge === "skill_match") {
    return (
      <span className="rounded-full border border-semantic-success bg-semantic-success/10 px-200 py-50 text-body-sm font-medium text-semantic-success">
        Skill match
      </span>
    );
  }
  if (badge === "skill_gap") {
    return (
      <span className="rounded-full border border-semantic-warning bg-semantic-warning/10 px-200 py-50 text-body-sm font-medium text-semantic-warning">
        Skill gap
      </span>
    );
  }
  if (badge === "availability_conflict") {
    return (
      <span className="rounded-full border border-semantic-error bg-semantic-error/10 px-200 py-50 text-body-sm font-medium text-semantic-error">
        Unavailable
      </span>
    );
  }
  return null; // unassigned â€” no badge on the slot row itself
}
```

**Task 11 â€” `TaskSlotRow` component**

File: `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-slot-row.tsx`

Client component (`"use client"`).

Props:
```typescript
interface TaskSlotRowProps {
  slot: EventTaskSlot;
  eventId: string;
  deptId: string;
  candidates: VolunteerTaskCandidate[]; // for the picker dropdown
  canAssign: boolean;
}
```

Renders one row:
- Task name (left)
- If `slot.volunteer_id` is set: volunteer display name + `<TaskVolunteerBadge>` + "Remove" button (canAssign only)
- If `slot.volunteer_id` is null: "Unassigned" text + select dropdown from `candidates` (canAssign only)

Selecting a candidate calls `upsertEventTaskAssignment` via `useTransition`. "Remove" calls `removeEventTaskAssignment`. Both use `useTransition` for pending state. Error displayed inline.

The candidate dropdown shows each volunteer's display name + their badge inline:
```
[Emma Smith â€” Skill match â–¼]
[Tom Jones â€” Skill gap â–¼]
```
(Badge text in the option label, not as a separate element â€” `<select>` cannot contain styled children.)

**Task 12 â€” `TaskAssignmentSection` component**

File: `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-assignment-section.tsx`

Client component.

Props:
```typescript
interface TaskAssignmentSectionProps {
  eventId: string;
  deptId: string;
  slots: EventTaskSlot[];
  candidatesByTask: Record<string, VolunteerTaskCandidate[]>;
  canAssign: boolean;
  // super_admin/all_depts_leader: read-only (no controls)
}
```

Renders:
- Section header "Task Assignments"
- If `slots.length === 0`: "No tasks configured for this department." (neutral message â€” dept has no library)
- Unassigned count notice: if any slot has badge `"unassigned"`, show amber notice "X task(s) not yet assigned"
- `<ul>` of `<TaskSlotRow>` per slot

**Task 13 â€” Modify roster page**

File: `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/page.tsx`

Import `getEventTaskSlots` and `getVolunteersWithBadgesForTask` from `@/lib/tasks/queries`.

In the `dept_head` branch:
```typescript
const [assignments, gapSummary, headcountGaps, crossTeamSuggestions, taskSlots] =
  await Promise.all([
    getAssignmentsForRoster(eventId, deptId),
    getSkillGapsForDepartmentRoster(eventId, deptId),
    getHeadcountGapsForRoster(eventId, deptId),
    getCrossTeamSuggestions(eventId, deptId),
    getEventTaskSlots(eventId, deptId),
  ]);

// Build candidatesByTask for the assignment pickers
// Only fetch candidates for tasks that are likely to need them â€” all tasks
// Pre-fetch once per page, not once per slot, to avoid N+1
// Use getVolunteersWithBadgesForTask but we need per-task differentiation.
// Strategy: fetch the volunteers list once (all with approved interest),
// then re-compute badges per task using already-fetched skill data.
// See getEventTaskSlotsWithCandidates() â€” a combined query function that
// returns { slots, candidatesByTask } to avoid multiple round trips.
```

Add `getEventTaskSlotsWithCandidates(eventId, deptId, filterMemberIds?: string[])` to `queries.ts`. This combines slot fetching and candidate enrichment in one function with shared sub-queries (one blockout fetch, one approved-skills fetch) to avoid per-task database round trips.

Signature:
```typescript
export async function getEventTaskSlotsWithCandidates(
  eventId: string,
  deptId: string,
  filterMemberIds?: string[], // if set, candidates are filtered to this subset
): Promise<{ slots: EventTaskSlot[]; candidatesByTask: Record<string, VolunteerTaskCandidate[]> }>
```

Pass `taskSlots` and `candidatesByTask` to `DeptHeadRosterView`.

In the `team_head` branch: pass `filterMemberIds` set to the volunteers in the team head's own sub-teams. This enforces D6 — team head can only assign volunteers from their own teams. Without this filter the function returns all department members, violating the scoping rule:
```typescript
// In team_head branch of roster/page.tsx:
const ownTeamMemberIds = assignments
  .filter(a => a.sub_team_id === ownTeamId)
  .map(a => a.volunteer_id);
const { slots, candidatesByTask } = await getEventTaskSlotsWithCandidates(
  eventId, deptId, ownTeamMemberIds
);
```
Where `ownTeamId` is the team the team_head owns (from `session.profile.id` matched against `teams.owner_id`). If `ownTeamMemberIds` is empty, `candidatesByTask` values will be empty arrays — the team head sees slots but no picker options until members are assigned to the event.

In the `super_admin`/`all_depts_leader` branch: pass task slots with `canAssign: false` for read-only view (no `filterMemberIds` needed).

**Task 14 â€” Modify `DeptHeadRosterView`**

File: `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/dept-head-roster-view.tsx`

Add props:
```typescript
taskSlots: EventTaskSlot[];
candidatesByTask: Record<string, VolunteerTaskCandidate[]>;
```

Render `<TaskAssignmentSection>` below `<CrossTeamSuggestionsPanel>`:
```tsx
<TaskAssignmentSection
  eventId={eventId}
  deptId={deptId}
  slots={taskSlots}
  candidatesByTask={candidatesByTask}
  canAssign={true}
/>
```

**Task 15 â€” Modify `TeamHeadRosterView`**

File: `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/team-head-roster-view.tsx`

Same pattern as task 14.

**Task 16 â€” Modify `SuperAdminRosterView`**

File: `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/super-admin-roster-view.tsx`

Add `taskSlots: EventTaskSlot[]` prop. Render `<TaskAssignmentSection canAssign={false} candidatesByTask={{}} slots={taskSlots} ... />`.

---

### Phase 7: Dashboard Integration

**Task 17 â€” Update dashboard types**

File: `/apps/web/lib/dashboard/types.ts`

Add `unassignedTasksCount: number` to `DeptHeadDashboardData`:
```typescript
export type DeptHeadDashboardData = {
  eventSummaries: EventWithDeptHealth[];
  pendingInterests: number;
  pendingSkillApprovals: number;
  rotationEntries: ...;
  rotationTeamsByDept: ...;
  unassignedTasksCount: number; // NEW
};
```

**Task 18 â€” Update `getDeptHeadDashboardData`**

File: `/apps/web/lib/dashboard/queries.ts`

After fetching `deptIds` (step 1 of the existing function), add this count query in the final parallel block:

```typescript
const [interestRes, skillRes, rotationResult, unassignedTasksRes] = await Promise.all([
  // ... existing queries ...
  supabase
    .from("event_task_assignments")
    .select("id", { count: "exact", head: true })
    .in("department_id", deptIds)
    .is("volunteer_id", null)
    .is("deleted_at", null)
    // Join to events for the date window â€” use an inner join filter approach:
    // Supabase client doesn't support JOIN filters on count-only queries directly.
    // Strategy: fetch event IDs for the window first (already available from step 2
    // via eventInfoMap), then filter by those eventIds.
]);
```

Concrete approach: collect the set of `upcomingEventIds` from `eventInfoMap` keys (already computed). Then:
```typescript
const upcomingEventIds = [...eventInfoMap.keys()];
const unassignedTasksRes = upcomingEventIds.length > 0
  ? await supabase
      .from("event_task_assignments")
      .select("id", { count: "exact", head: true })
      .in("department_id", deptIds)
      .in("event_id", upcomingEventIds)
      .is("volunteer_id", null)
      .is("deleted_at", null)
  : { count: 0 };
```

Return: add `unassignedTasksCount: unassignedTasksRes.count ?? 0` to the return object.

If `deptRows` is empty (early return branch), change the early return to include `unassignedTasksCount: 0`.

**Task 19 â€” Update `DeptHeadDashboard` component**

File: `/apps/web/app/(app)/dashboard/_components/dept-head-dashboard.tsx`

Add a visual indicator for `unassignedTasksCount` in the dashboard header area or in a dedicated summary row, consistent with `pendingInterests` and `pendingSkillApprovals`. Use the same amber notice pattern already used for pending items:

```tsx
{data.unassignedTasksCount > 0 && (
  <div className="rounded-200 border border-semantic-warning bg-semantic-warning/10 p-300">
    <p className="text-body-sm font-semibold text-semantic-warning">
      {data.unassignedTasksCount === 1
        ? "1 task slot is unassigned across upcoming events."
        : `${data.unassignedTasksCount} task slots are unassigned across upcoming events.`}
    </p>
  </div>
)}
```

Position: after the existing `pendingSkillApprovals` notice, before the event summaries table.

---

### Phase 8: Verification

**Task 20 â€” `npm run build` must pass**

Run from `/apps/web`. Fix all TypeScript errors before marking complete.

**Task 21 â€” `npm run lint` must pass**

Fix all lint errors before marking complete.

**Task 22 â€” Manual verification checklist**

- [ ] As dept_head: open `/departments/[deptId]` â†’ "Task Library" section visible, "Add task" button present
- [ ] Create task with no skill â†’ appears in list
- [ ] Create task with a required skill â†’ skill name badge shown
- [ ] Create duplicate task name â†’ error "A task with this name already exists"
- [ ] Edit task name â†’ saved, list updated
- [ ] Delete task â†’ soft-deleted, disappears from list
- [ ] As super_admin: verify same department page shows task list (read-only, no controls)
- [ ] Open `/events/[id]/departments/[deptId]/roster` as dept_head â†’ "Task Assignments" section visible below Cross-Team Suggestions
- [ ] Task with no assignment shows "Unassigned" + volunteer dropdown
- [ ] Assign volunteer with correct skill â†’ green "Skill match" badge
- [ ] Assign volunteer missing the required skill â†’ amber "Skill gap" badge
- [ ] Assign volunteer with a blockout on event date â†’ red "Unavailable" badge
- [ ] Remove assignment â†’ slot reverts to "Unassigned"
- [ ] As team_head: same assignment controls visible and functional
- [ ] As super_admin on roster: task slots visible, no controls (read-only)
- [ ] Dept Head dashboard shows "X task slots are unassigned across upcoming events" when applicable
- [ ] Delete task from library â†’ task disappears from roster task section on next page load (event_task_assignments soft-deleted in action)

---

## Data Flow

```
[Dept Head: /departments/[deptId]]
  page.tsx
    getTasksForDepartment(deptId)        â†’ DepartmentTask[]
    getDepartmentSkillsForDropdown(deptId) â†’ {id, name}[]
    â†’ <TaskLibrarySection tasks skills canManage />
        â†’ <TaskForm> â†’ createTask()/updateTask() server action
                         â†’ department_tasks INSERT/UPDATE
                         â†’ revalidatePath
        â†’ deleteTask() server action
            â†’ event_task_assignments soft-delete WHERE task_id
            â†’ department_tasks soft-delete
            â†’ revalidatePath

[Dept Head / Team Head: /events/[id]/departments/[deptId]/roster]
  page.tsx
    getEventTaskSlotsWithCandidates(eventId, deptId)
      â†’ department_tasks (all for dept)
      â†’ event_task_assignments (for event+dept)
      â†’ events (event_date)
      â†’ availability_blockouts (bulk)
      â†’ volunteer_skills approved (bulk, scoped to deptId)
      â†’ volunteer_interests approved (volunteers eligible for this dept)
      â†’ merge â†’ { slots: EventTaskSlot[], candidatesByTask: Record<taskId, VolunteerTaskCandidate[]> }
    â†’ DeptHeadRosterView { taskSlots, candidatesByTask }
        â†’ <TaskAssignmentSection>
            â†’ <TaskSlotRow> per slot
                â†’ upsertEventTaskAssignment() server action
                    â†’ ownership check
                    â†’ fetch-then-write (select existing â†’ insert or update)
                    â†’ revalidatePath
                â†’ removeEventTaskAssignment() server action
                    â†’ soft-delete
                    â†’ revalidatePath

[Dept Head: /dashboard]
  getDeptHeadDashboardData(userId)
    â†’ existing queries
    â†’ event_task_assignments count WHERE volunteer_id IS NULL AND event_id IN upcoming
    â†’ { ...existing, unassignedTasksCount }
  â†’ <DeptHeadDashboard data />
      â†’ unassigned tasks amber notice
```

---

## Build Sequence Checklist

- [ ] **Phase 1:** Write migrations 00037 and 00038. Run `supabase db reset`. Confirm no errors.
- [ ] **Phase 2:** Create `lib/tasks/types.ts` and `lib/tasks/schemas.ts`.
- [ ] **Phase 3:** Create `lib/tasks/queries.ts` with all three exported functions. Verify TypeScript compiles.
- [ ] **Phase 4:** Create `lib/tasks/actions.ts`. Verify TypeScript compiles. Verify `revalidatePath` calls are correct.
- [ ] **Phase 5a:** Check if `getDepartmentSkillsForDropdown` (or equivalent) exists in skills queries. If not, add it to `/apps/web/lib/skills/queries.ts`.
- [ ] **Phase 5b:** Create `task-form.tsx`, `task-library-section.tsx`. Modify `departments/[deptId]/page.tsx`.
- [ ] **Phase 6a:** Create `task-volunteer-badge.tsx`, `task-slot-row.tsx`, `task-assignment-section.tsx`.
- [ ] **Phase 6b:** Modify `roster/page.tsx` to fetch task slots and candidates.
- [ ] **Phase 6c:** Modify `dept-head-roster-view.tsx`, `team-head-roster-view.tsx`, `super-admin-roster-view.tsx`.
- [ ] **Phase 7a:** Add `unassignedTasksCount` to `lib/dashboard/types.ts`.
- [ ] **Phase 7b:** Update `getDeptHeadDashboardData` in `lib/dashboard/queries.ts`. Handle empty dept early-return.
- [ ] **Phase 7c:** Update `dept-head-dashboard.tsx` to display the count.
- [ ] **Phase 8:** `npm run build` passes. `npm run lint` passes. Run manual verification checklist.

---

## Self-Review Table

| Concern | Status | Notes |
|---------|--------|-------|
| RLS recursion risk | Addressed | All policies use `i_own_dept()` or `i_have_sub_team_in_dept()`. No raw `EXISTS (SELECT â€¦ FROM departments)` in any policy. |
| N+1 query in roster page | Addressed | `getEventTaskSlotsWithCandidates` fetches blockouts and skills in bulk before the per-task loop. |
| Soft-delete cascade for task library | Addressed | `deleteTask` action soft-deletes `event_task_assignments` first, then the task. DB hard cascade is not relied upon. |
| Upsert edge case with partial unique index | Addressed | Using fetch-then-write pattern instead of raw upsert to avoid the partial index gap. |
| Team head authorization in actions | Addressed | Uses inline supabase query `teams WHERE department_id = deptId AND owner_id = caller` rather than raw EXISTS in SQL policy. |
| Dashboard early-return path | Addressed | The empty-dept early return in `getDeptHeadDashboardData` must include `unassignedTasksCount: 0`. |
| Duplicate task name error | Addressed | Partial unique index on `(department_id, lower(name)) WHERE deleted_at IS NULL` + 23505 error code handling in action. |
| `required_skill_id` orphan on skill delete | Addressed by schema | `ON DELETE SET NULL` on the FK â€” task becomes a no-skill-required task if its skill is deleted. No special action handling needed. |
| Super admin read without controls | Addressed | `canAssign: false` prop on `TaskAssignmentSection` hides all mutation controls. |
| TypeScript strict mode | Must verify | All types are non-nullable or explicitly optional. No `any` casts. |
| Mobile-first layout | Must verify | Task library and assignment section use `flex-col` by default, `sm:flex-row` where needed. Badge text is body-sm. |

---

## Edge Cases and Contingencies

**EC1: Task soft-deleted while an event task assignment references it.**
The `event_task_assignments` rows are soft-deleted in the `deleteTask` action before the task is soft-deleted. If the action fails midway (assignments deleted, task not), the task is still visible in the library. The orphaned event rows with a now-present task are harmless and invisible (soft-deleted). Retry is safe.

**EC2: Volunteer removed from approved interests after task assignment.**
`getEventTaskSlotsWithCandidates` fetches candidates from `volunteer_interests WHERE status = 'approved'`. If a previously assigned volunteer loses their approved interest, they remain assigned (no automatic unassignment) but will not appear in the dropdown for future assignments. The badge computation does not re-check approved interest â€” the badge only checks blockouts and skill_id match. This is intentional: the assignment should be reviewed manually by the head, not silently cleared.

**EC3: `required_skill_id` FK points to a skill that is later soft-deleted in `department_skills`.**
`department_skills` soft-delete sets `deleted_at` on the skill row, but the FK on `department_tasks.required_skill_id` references `id` with `ON DELETE SET NULL`. If the skill row is hard-deleted (only possible by super_admin running raw SQL), the FK cascades to NULL. If it is soft-deleted (the application path), the FK still points to the row and `getTasksForDepartment`'s join will return the row with the skill name. To prevent showing a deleted skill name, the join in `getTasksForDepartment` should add `.is("required_skill.deleted_at", null)` â€” or more practically, filter in the mapper: if the joined skill row has a non-null `deleted_at`, treat `required_skill_name` as null.

**EC4: Event with no registered volunteers for the department.**
`getEventTaskSlotsWithCandidates` returns `candidatesByTask` with empty arrays for every task. The task slot rows show dropdowns with no options. The section should not crash â€” `<select>` with no options renders as an empty picker, which communicates that no eligible volunteers exist.

**EC5: Department with tasks but no `event_task_assignments` rows yet (first time opening roster).**
`getEventTaskSlots` step 4 produces an empty assignment map. All tasks produce slots with `assignment_id: null`, `volunteer_id: null`, badge `"unassigned"`. The section renders correctly with all slots showing "Unassigned".

**EC6: `event_task_assignments` unique constraint conflict on concurrent assignment.**
Two heads assign the same task slot simultaneously. The second upsert's INSERT will fail with a 23505 if both arrive at the "slot not found" branch simultaneously. Handle in the action: on 23505, return `{ error: "This task was just assigned by someone else. Please refresh and try again." }`.

---

## Key File Paths Reference

New files:
- `/supabase/migrations/00037_department_tasks.sql`
- `/supabase/migrations/00038_event_task_assignments.sql`
- `/apps/web/lib/tasks/types.ts`
- `/apps/web/lib/tasks/schemas.ts`
- `/apps/web/lib/tasks/queries.ts`
- `/apps/web/lib/tasks/actions.ts`
- `/apps/web/app/(app)/departments/[deptId]/_components/task-library-section.tsx`
- `/apps/web/app/(app)/departments/[deptId]/_components/task-form.tsx`
- `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-assignment-section.tsx`
- `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-volunteer-badge.tsx`
- `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/task-slot-row.tsx`

Modified files:
- `/apps/web/app/(app)/departments/[deptId]/page.tsx`
- `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/page.tsx`
- `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/dept-head-roster-view.tsx`
- `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/team-head-roster-view.tsx` (verify path: file shown in glob as `team-head-roster-view.tsx`)
- `/apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/super-admin-roster-view.tsx`
- `/apps/web/lib/dashboard/types.ts`
- `/apps/web/lib/dashboard/queries.ts`
- `/apps/web/app/(app)/dashboard/_components/dept-head-dashboard.tsx`
- `/apps/web/lib/skills/queries.ts` (add `getDepartmentSkillsForDropdown` if not already present)