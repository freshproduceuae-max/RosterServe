# Implementation Plan: RS-F001 — Role Hierarchy Revision

**Status:** Implemented — browser validation outstanding  
**Feature:** RS-F001 Authentication and role access  
**Revision:** PRD v2 (2026-04-07) — expand from 4 roles to 6 roles  
**Branch:** `codex/rs-f001-role-hierarchy-revision`  
**Depends on:** None (this is the foundation all other revisions depend on)

---

## 1. Revision Summary

The existing implementation supports four roles: `super_admin`, `dept_head`, `sub_leader`, `volunteer`.

Implementation outcome (2026-04-08):
- Merged via PR #18 with follow-up migration split in PR #19
- Final migration shape differs from the original draft: `00019_role_hierarchy_revision.sql` now contains only enum value additions, and `00020_role_hierarchy_followup.sql` contains the row migration, `supporter_of` column, constraint/trigger updates, and policy recreation
- Browser validation for `team_head`, `all_depts_leader`, and `supporter` is still outstanding

PRD v2 requires six roles:

| Old Role | New Role | Notes |
|---|---|---|
| `super_admin` | `super_admin` | Unchanged |
| — | `all_depts_leader` | New — cross-department leader, reporting dashboards |
| `dept_head` | `dept_head` | Unchanged in name; permissions expand |
| `sub_leader` | `team_head` | Renamed — same structural position, terminology corrected |
| — | `supporter` | New — mirrors one assigned leader's permissions minus admin |
| `volunteer` | `volunteer` | Unchanged |

**Role hierarchy (highest → lowest):**  
`super_admin` > `all_depts_leader` > `dept_head` > `team_head` > `supporter` > `volunteer`

---

## 2. Scope

This revision covers:

1. Database enum migration (add new values, rename `sub_leader` → `team_head`, add `supporter_of` FK)
2. Explicit per-policy drop/recreate for every live policy referencing `sub_leader`
3. TypeScript type and constant updates
4. Careful review of `isLeaderRole` and `hasMinimumRole` call sites to prevent accidental access changes
5. Dashboard page branching for new roles (stubs for new roles)
6. UI label updates wherever "Sub-Leader" appears

**Out of scope for this revision (explicitly documented in PRD and feature-list.json):**
- Supporter permission mirroring logic — owned by RS-F018
- All Departments Leader cross-department data scope — established in RS-F003
- Team Head assignment scoping beyond auth — covered in RS-F006, RS-F007, RS-F008
- `event_creation_grant` mechanism — owned by RS-F002

---

## 2a. Acceptance Criteria

Mapped to RS-F001 feature-registry steps:

| Step | Criterion | Verified by |
|---|---|---|
| Six roles in DB and TS | `app_role` enum has exactly 6 values; `APP_ROLES` array has exactly 6 entries; `AppRole` union type covers all 6 | `db reset` + typecheck |
| Role-appropriate entry experience | Sign-in routes each role to `/dashboard`; dashboard renders role-specific content (stub acceptable for new roles in this revision) | Browser: all 6 roles |
| Baseline RLS enforced | All live policies updated; no policy references `sub_leader`; protected data not accessible without a valid session | `db reset` + SQL grep |
| Dashboard stubs for new roles | `all_depts_leader`, `team_head`, `supporter` reach a renderable dashboard without JS errors | Browser |

**Not validated in RS-F001:**
- Supporter sees exactly their assigned leader's data (RS-F018)
- Event creation grant works for Dept Head / Team Head (RS-F002)
- Cross-department read scope for All Departments Leader (RS-F003)

---

## 3. Files to Change

### 3a. New migration file
- **`supabase/migrations/00019_role_hierarchy_revision.sql`** — create new

### 3b. TypeScript files

Core auth:
- **`apps/web/lib/auth/types.ts`** — update APP_ROLES, AppRole, Profile (add supporter_of)
- **`apps/web/lib/auth/roles.ts`** — update ROLE_RANK, ROLE_LABELS, ROLE_HOME_PATH, isLeaderRole

Dashboard:
- **`apps/web/app/(app)/dashboard/page.tsx`** — add branches for all_depts_leader, team_head, supporter
- **`apps/web/lib/dashboard/queries.ts`** — rename getSubLeaderDashboardData → getTeamHeadDashboardData; audit for sub_leader references

Role-gated pages (consume `isLeaderRole` or `hasMinimumRole` — must be audited, not just string-replaced):
- **`apps/web/app/(app)/events/page.tsx`** — uses isLeaderRole to gate event list access
- **`apps/web/app/(app)/events/new/page.tsx`** — uses isLeaderRole/hasMinimumRole to gate event creation
- **`apps/web/app/(app)/availability/page.tsx`** — uses isLeaderRole to determine view mode
- **`apps/web/app/(app)/app-nav.tsx`** — nav link visibility gated on role

String-substitution only (sub_leader → team_head, no logic change):
- **`apps/web/lib/events/queries.ts`**
- **`apps/web/lib/departments/queries.ts`**
- **`apps/web/lib/departments/actions.ts`**
- **`apps/web/lib/assignments/types.ts`**
- **`apps/web/lib/assignments/actions.ts`**
- **`apps/web/app/(app)/events/[id]/departments/[deptId]/page.tsx`**
- **`apps/web/app/(app)/events/[id]/departments/[deptId]/roster/page.tsx`**
- **`apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assign-volunteer-form.tsx`**
- **`apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/assignment-row.tsx`**
- **`apps/web/app/(app)/dashboard/_components/assignment-card.tsx`**
- **`apps/web/app/(app)/events/[id]/departments/[deptId]/sub-teams/new/page.tsx`**
- **`apps/web/app/(app)/events/[id]/departments/[deptId]/sub-teams/[subTeamId]/edit/page.tsx`**

New component files to create:
- **`apps/web/app/(app)/dashboard/_components/all-depts-leader-dashboard.tsx`** — stub
- **`apps/web/app/(app)/dashboard/_components/team-head-dashboard.tsx`** — rename from sub-leader-dashboard
- **`apps/web/app/(app)/dashboard/_components/supporter-dashboard.tsx`** — stub

---

## 4. Migration: `00019_role_hierarchy_revision.sql`

### Step 1 — Add new enum values

PostgreSQL enum values can only be added, not removed directly. Add the three new roles first:

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'all_depts_leader' AFTER 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_head' AFTER 'dept_head';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supporter' AFTER 'team_head';
```

### Step 2 — Migrate existing `sub_leader` rows to `team_head`

```sql
UPDATE public.profiles SET role = 'team_head' WHERE role = 'sub_leader';
```

### Step 3 — Remove `sub_leader` from the enum

PostgreSQL does not support `ALTER TYPE ... DROP VALUE`. The only safe approach is to create a replacement enum, migrate the column, and swap:

```sql
-- Create the new clean enum
CREATE TYPE public.app_role_v2 AS ENUM (
  'super_admin',
  'all_depts_leader',
  'dept_head',
  'team_head',
  'supporter',
  'volunteer'
);

-- Migrate the column (text cast bridges the two enum types)
ALTER TABLE public.profiles
  ALTER COLUMN role TYPE public.app_role_v2
  USING role::text::public.app_role_v2;

-- Drop the old enum and rename the new one
DROP TYPE public.app_role;
ALTER TYPE public.app_role_v2 RENAME TO app_role;
```

> **Note:** Any SECURITY DEFINER functions that declare `RETURNS public.app_role` must be recreated after the type swap. `get_my_role()` is the only such function and is recreated in Step 5.

### Step 4 — Add `supporter_of` column to profiles

Links a Supporter to their assigned leader. Nullable for all other roles:

```sql
ALTER TABLE public.profiles
  ADD COLUMN supporter_of uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Index for look-ups: "who supports this leader?"
CREATE INDEX idx_profiles_supporter_of ON public.profiles(supporter_of)
  WHERE supporter_of IS NOT NULL;
```

### Step 5 — Recreate `get_my_role()` after type swap

The function signature references the old `app_role` type. Recreate it so it references the renamed type:

```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$;
```

### Step 6 — Update RLS policies that reference `sub_leader`

The following policies across migrations reference `sub_leader` by name. They must be dropped and recreated.

#### 6a. Profiles read policy — leaders read other leaders (from 00010)

```sql
DROP POLICY IF EXISTS "Leaders can read other leader profiles" ON public.profiles;

CREATE POLICY "Leaders can read other leader profiles"
  ON public.profiles FOR SELECT
  USING (
    deleted_at IS NULL
    AND role IN ('all_depts_leader', 'dept_head', 'team_head', 'supporter')
    AND public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')
  );
```

#### 6b. Profiles read policy — leaders read in-scope volunteers (from 00010)

```sql
DROP POLICY IF EXISTS "Leaders can read in-scope volunteer profiles" ON public.profiles;

CREATE POLICY "Leaders can read in-scope volunteer profiles"
  ON public.profiles FOR SELECT
  USING (
    role = 'volunteer'
    AND deleted_at IS NULL
    AND public.get_my_role() IN ('dept_head', 'team_head')
    AND (
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        WHERE d.owner_id = auth.uid() AND d.deleted_at IS NULL
      )
      OR
      id IN (
        SELECT vi.volunteer_id
        FROM public.volunteer_interests vi
        JOIN public.departments d ON d.id = vi.department_id
        JOIN public.sub_teams st ON st.department_id = d.id
        WHERE st.owner_id = auth.uid() AND st.deleted_at IS NULL
      )
    )
  );
```

#### 6c. Full live-policy inventory

Every live policy referencing `sub_leader` must be dropped and recreated in migration 00019. The authoritative list is derived from grepping all migration files. Each entry below uses the exact policy name and table so the migration is reviewable:

| Policy name | Table | Change |
|---|---|---|
| `"Leaders can read other leader profiles"` | `profiles` | Already covered in 6a |
| `"Leaders can read in-scope volunteer profiles"` | `profiles` | Already covered in 6b |
| `"Leaders can read their department events"` | `events` | `sub_leader` → `team_head` in USING |
| `"sub_leader can read events for their sub-team's department"` | `events` | Rename policy; `sub_leader` → `team_head` |
| `"Leaders can read departments"` | `departments` | `sub_leader` → `team_head` |
| `"Leaders can read sub_teams"` | `sub_teams` | `sub_leader` → `team_head` |
| `"sub_leaders can read their own sub_teams"` | `sub_teams` | Rename policy; `sub_leader` → `team_head` |
| `"sub_leaders can update their own sub_teams"` | `sub_teams` | Rename policy; `sub_leader` → `team_head` |
| `"Leaders can read availability"` | `availability_blockouts` | `sub_leader` → `team_head` |
| `"Leaders can read in-scope assignments"` | `assignments` | `sub_leader` → `team_head` |
| `"sub_leaders can insert assignments"` | `assignments` | Rename policy; `sub_leader` → `team_head` |
| `"sub_leaders can update assignments"` | `assignments` | Rename policy; `sub_leader` → `team_head` |
| `"sub_leaders can soft-delete assignments"` | `assignments` | Rename policy; `sub_leader` → `team_head` |
| `"Leaders can read skill_requirements"` | `skill_requirements` | `sub_leader` → `team_head` |
| `"sub_leaders can manage skill_requirements for their sub-team"` | `skill_requirements` | Rename policy; `sub_leader` → `team_head` |

> **Implementation rule:** Do not rely on migration provenance. The migration 00019 must issue `DROP POLICY IF EXISTS` for each policy name above on the correct table, then recreate it with `team_head` substituted. Use `IF EXISTS` so the migration is safe if a policy was already dropped or renamed by a prior fix migration.

> **Confirmation step:** After `db reset`, run `SELECT policyname, tablename FROM pg_policies WHERE policyname ILIKE '%sub_leader%'` and confirm zero rows returned.

---

## 5. TypeScript Changes

### 5a. `apps/web/lib/auth/types.ts`

```typescript
export const APP_ROLES = [
  "super_admin",
  "all_depts_leader",
  "dept_head",
  "team_head",
  "supporter",
  "volunteer",
] as const;
export type AppRole = (typeof APP_ROLES)[number];

export type Profile = {
  id: string;
  role: AppRole;
  display_name: string;
  onboarding_complete: boolean;
  supporter_of: string | null;   // new: links supporter to assigned leader
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};
```

### 5b. `apps/web/lib/auth/roles.ts`

```typescript
export const ROLE_RANK: Record<AppRole, number> = {
  super_admin: 60,
  all_depts_leader: 50,
  dept_head: 40,
  team_head: 30,
  supporter: 20,
  volunteer: 10,
};

export function isLeaderRole(role: AppRole): boolean {
  return role !== "volunteer" && role !== "supporter";
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  all_depts_leader: "All Departments Leader",
  dept_head: "Department Head",
  team_head: "Team Head",
  supporter: "Supporter",
  volunteer: "Volunteer",
};

export const ROLE_HOME_PATH: Record<AppRole, string> = {
  super_admin: "/dashboard",
  all_depts_leader: "/dashboard",
  dept_head: "/dashboard",
  team_head: "/dashboard",
  supporter: "/dashboard",
  volunteer: "/dashboard",
};
```

> Note: `isLeaderRole` now excludes `supporter` because supporters mirror a leader's permissions but are not independently scoped leaders — their access is derived from `supporter_of`. A separate `isSupporterRole` helper should not be added unless a use case requires it.

### 5c. `apps/web/app/(app)/dashboard/page.tsx`

Add import and render branches for the three new roles. The two existing new-role dashboards (`AllDeptsLeaderDashboard`, `TeamHeadDashboard`, `SupporterDashboard`) will be scaffolded as stubs in this revision — they return a basic "coming soon" state. Full implementation is covered by RS-F010 revision.

```typescript
// Add imports
import { AllDeptsLeaderDashboard } from "./_components/all-depts-leader-dashboard";
import { TeamHeadDashboard } from "./_components/team-head-dashboard";
import { SupporterDashboard } from "./_components/supporter-dashboard";

// Replace sub_leader branch with team_head; add new branches
if (profile.role === "all_depts_leader") {
  return <AllDeptsLeaderDashboard displayName={displayName} />;
}

if (profile.role === "team_head") {
  const data = await getTeamHeadDashboardData(profile.id);
  return <TeamHeadDashboard data={data} displayName={displayName} />;
}

if (profile.role === "supporter") {
  return <SupporterDashboard profile={profile} displayName={displayName} />;
}
```

Stub component files to create:
- `apps/web/app/(app)/dashboard/_components/all-depts-leader-dashboard.tsx`
- `apps/web/app/(app)/dashboard/_components/team-head-dashboard.tsx`
- `apps/web/app/(app)/dashboard/_components/supporter-dashboard.tsx`

> The existing `SubLeaderDashboard` component file is renamed to `TeamHeadDashboard`. Its internals are not changed in this revision — the internal content revision is part of RS-F010.

### 5d. `isLeaderRole` and `hasMinimumRole` audit (required before string substitution)

These helpers gate page-level access in at least three files. A rank update or definition change can silently grant or deny access incorrectly for `supporter` and `all_depts_leader`. Each call site must be manually reviewed:

**`apps/web/app/(app)/events/page.tsx`**
- If it calls `isLeaderRole` to decide whether to show the event list, verify that `team_head` and `all_depts_leader` should both see events. They should — no behavior change needed, but confirm.
- `supporter` should see events if their assigned leader can. Because the supporter permission mirroring is deferred to RS-F018, for now `supporter` will not see events via this gate. This is acceptable for the structural foundation revision — document it as a known RS-F018 gap.

**`apps/web/app/(app)/events/new/page.tsx`**
- Event creation is gated on role. Currently only `dept_head` and above can create events. After this revision, `all_depts_leader` must also be allowed (they are a leader role). `team_head` is not allowed by default (event-creation grant is RS-F002). `supporter` is not allowed by default. Verify the gate logic is consistent with this.

**`apps/web/app/(app)/availability/page.tsx`**
- Uses `isLeaderRole` to switch between volunteer and leader availability views. After the revision: `team_head` should get the leader view. `all_depts_leader` should get the leader view. `supporter` should ideally mirror their leader's view but that is deferred — for now, `supporter` gets volunteer view as a safe default.

For each call site: read the current code, confirm the intended access, and update only if the current logic produces an incorrect outcome for one of the new roles.

### 5e. All other TypeScript files (string substitution)

For every file in the "string-substitution only" list in Section 3b: replace all occurrences of `"sub_leader"` with `"team_head"` and `SubLeader` (PascalCase component/type names) with `TeamHead`. No logic changes. Verify each file compiles after the change.

---

## 6. Stub Dashboard Components

**`all-depts-leader-dashboard.tsx`** — shows display name + "All Departments Leader dashboard coming soon" in the design-system card style. No data query in this revision.

**`team-head-dashboard.tsx`** — rename from `sub-leader-dashboard.tsx`; update all internal heading labels from "Sub-Leader" to "Team Head". The data query is renamed from `getSubLeaderDashboardData` → `getTeamHeadDashboardData` (rename only, no logic change).

**`supporter-dashboard.tsx`** — shows display name + "Your leader's dashboard will appear here once your supporter assignment is configured." in the design-system card style. No data query in this revision.

---

## 7. Validation Checks

After implementation, verify:

| # | Check | Method |
|---|---|---|
| 1 | `npm run typecheck` passes with zero errors | CLI |
| 2 | `npm run lint` passes with zero errors | CLI |
| 3 | `npm run build` completes successfully | CLI |
| 4 | `npx supabase db reset` applies all migrations without error | CLI |
| 5 | A user with role=team_head can log in and reach dashboard | Browser |
| 6 | A user with role=all_depts_leader can log in and reach dashboard | Browser |
| 7 | A user with role=supporter can log in and reach dashboard | Browser |
| 8 | `SELECT policyname FROM pg_policies WHERE policyname ILIKE '%sub_leader%'` returns zero rows | SQL |
| 9 | `get_my_role()` returns the correct role for each of the 6 roles (run as each test account) | SQL |
| 10 | No TypeScript file references `"sub_leader"` string after the change | Grep |
| 11 | `events/page.tsx`, `events/new/page.tsx`, `availability/page.tsx` behave correctly for `team_head` and `all_depts_leader` | Browser |

---

## 8. Carry-Over Notes

- The `supporter_of` column is added in this revision but the linking UI and permission-mirroring logic are not. Both are covered by RS-F018.
- `all_depts_leader` gains no special RLS read access beyond what existed for `dept_head` in this revision. Broader cross-department read policies are added in RS-F003.
- `event_creation_grant` (allowing Dept Head or Team Head to create events) is part of RS-F002, not this revision.
- The stub dashboard components created here will be fully implemented in the RS-F010 revision.

---

## 9. Migration Sequence After This Plan

After RS-F001 revision passes validation:

1. **RS-F003** — rename sub_teams to teams, add rotation labels, headcount requirements
2. **RS-F002** — event creation authority + grant mechanism
3. **RS-F006** — permanent membership
4. **RS-F007** — skill profile and approval (Team Head as approver)
5. **RS-F008** — request-to-serve flow
6. **RS-F009** — headcount gap detection
7. **RS-F004** — onboarding update
8. **RS-F010** — personalized weekly dashboard (all six roles)
