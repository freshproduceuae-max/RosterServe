# Plan: RS-F007 - Skill Profile and Approval

Status: In Review
Feature: RS-F007
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

---

## Context

RS-F007 formalizes volunteer skill tracking. RS-F004 already created the `volunteer_skills` table and captured free-text skill names during onboarding, but those rows are unscoped (no department link) and approval logic was intentionally deferred. RS-F007 adds the department-skills catalog, links volunteer claims to it, adds leader approval/rejection, and ensures only approved skills feed RS-F008 assignment planning and RS-F009 gap detection.

---

## Objective

Allow leaders to define a skill catalog per department, allow volunteers to claim skills from that catalog, and give department heads the ability to approve or reject those claims — so only verified, department-scoped skills feed downstream planning logic.

---

## Scope And Non-Goals

### In Scope

- New `department_skills` table: skill catalog entries per department, created by dept_head
- ALTER `volunteer_skills`: add `department_id`, `skill_id` (FK to catalog), `reviewed_by`, `reviewed_at`
- New RLS policies: dept_head CRUD on `department_skills`; dept_head read/approve/reject on `volunteer_skills`; volunteer read on `department_skills` for their approved-interest departments
- New server actions: `createDepartmentSkill`, `deleteDepartmentSkill`, `claimSkill`, `withdrawSkillClaim`, `approveSkillClaim`, `rejectSkillClaim`
- Volunteer UI at `/skills`: view own skill claims with status, claim skills from department catalog, withdraw pending claims
- Dept_head UI at `/skills`: manage skill catalog (add/remove skills per department), review and approve/reject pending volunteer skill claims
- Super_admin UI at `/skills`: read-only oversight of all skill claims across all departments
- Sub_leader: redirected to `/dashboard`
- Navigation link "Skills" added for all roles except sub_leader (same pattern as Interests)
- Seed examples for RS-F007

### Legacy Onboarding Skills

RS-F004 created `volunteer_skills` rows during onboarding with free-text names and no department context. Those rows will remain in the table as-is (NULL `department_id`, NULL `skill_id`). They are visible to the volunteer in their skills view with a "legacy — no department" indicator but do not appear in any leader view and do not count toward planning coverage. Volunteers can withdraw them and re-claim formally.

### Explicit Scope Boundaries

- Sub-leader skill review — deferred (no sub-team catalog scope in v1)
- Bulk approve/reject — deferred
- Skill-gap detection UI signals — deferred to RS-F009
- Skill notifications — deferred to RS-F013

### Non-Goals

- Modifying event, department, or assignment data
- Editing volunteer profile data outside skill context

---

## Approach

### Data Model (Migration 00009)

**New table: `department_skills`**

```sql
CREATE TABLE public.department_skills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
-- Partial unique index: prevents duplicate skill names within a department (case-insensitive)
CREATE UNIQUE INDEX idx_department_skills_dept_name
  ON public.department_skills(department_id, lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX idx_department_skills_dept_id
  ON public.department_skills(department_id) WHERE deleted_at IS NULL;
ALTER TABLE public.department_skills ENABLE ROW LEVEL SECURITY;
```

**Alter `volunteer_skills`:**

| Column | Change | Notes |
|---|---|---|
| `department_id` | ADD | `uuid REFERENCES departments(id) ON DELETE SET NULL` — nullable; NULL for legacy onboarding rows |
| `skill_id` | ADD | `uuid REFERENCES department_skills(id) ON DELETE SET NULL` — nullable; NULL for legacy rows |
| `reviewed_by` | ADD | `uuid REFERENCES profiles(id) ON DELETE SET NULL` — nullable |
| `reviewed_at` | ADD | `timestamptz` — nullable |

Add indexes:

```sql
CREATE INDEX idx_volunteer_skills_dept_id
  ON public.volunteer_skills(department_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_volunteer_skills_skill_id
  ON public.volunteer_skills(skill_id) WHERE deleted_at IS NULL;
```

Add partial unique index to prevent duplicate claims:

```sql
CREATE UNIQUE INDEX idx_volunteer_skills_volunteer_skill
  ON public.volunteer_skills(volunteer_id, skill_id)
  WHERE deleted_at IS NULL AND skill_id IS NOT NULL;
```

**New RLS policies on `department_skills`:**

1. `dept_head` reads own dept catalog: `SELECT` WHERE `department_id IN (SELECT id FROM departments WHERE owner_id = auth.uid() AND deleted_at IS NULL)` AND caller has role `dept_head`
2. `dept_head` creates catalog entries: `INSERT` WITH CHECK — same scope
3. `dept_head` soft-deletes catalog entries: `UPDATE` USING — same scope
4. Volunteer reads catalog for departments where they have an active approved interest: `SELECT` WHERE `department_id IN (SELECT department_id FROM volunteer_interests WHERE volunteer_id = auth.uid() AND status = 'approved' AND deleted_at IS NULL)`
5. `super_admin` reads all: `SELECT` with role subquery

**Replacement INSERT policy on `volunteer_skills` (in migration 00009):**

Migration 00009 must drop the existing broad INSERT policy from 00005 and replace it with a dual-branch policy that enforces the approved-interest gate at the DB layer for catalog claims:

```sql
DROP POLICY IF EXISTS "Volunteers can insert own pending skills" ON public.volunteer_skills;

CREATE POLICY "Volunteers can insert own skills"
  ON public.volunteer_skills FOR INSERT
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND (
      -- Legacy onboarding path: free-text name only, no catalog link
      (skill_id IS NULL AND department_id IS NULL)
      OR
      -- Catalog claim path: approved interest + skill must belong to the same department and be active
      (
        skill_id IS NOT NULL
        AND department_id IS NOT NULL
        AND department_id IN (
          SELECT vi.department_id FROM public.volunteer_interests vi
          WHERE vi.volunteer_id = auth.uid()
            AND vi.status = 'approved'
            AND vi.deleted_at IS NULL
        )
        AND EXISTS (
          SELECT 1 FROM public.department_skills ds
          WHERE ds.id = skill_id
            AND ds.department_id = department_id
            AND ds.deleted_at IS NULL
        )
      )
    )
  );
```

This ensures a direct client write cannot create department-linked claims without an approved interest AND cannot pair an approved-interest department with a skill from a different department or a soft-deleted catalog entry. The legacy onboarding path (`persistSkills` in `onboarding/actions.ts`) continues to work because it inserts with NULL `skill_id` and NULL `department_id`, which the first branch admits.

**New RLS policies on `volunteer_skills`:**

6. `dept_head` reads skill claims in owned departments: `SELECT` WHERE `department_id IN (SELECT id FROM departments WHERE owner_id = auth.uid() AND deleted_at IS NULL)` AND caller has role `dept_head`

7. `dept_head` approves/rejects claims — explicit `USING` + `WITH CHECK` (RS-F006 pattern):
```sql
CREATE POLICY "Dept heads can review in-scope skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'dept_head'
    )
    AND EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.departments d
      WHERE d.id = department_id
        AND d.owner_id = auth.uid()
        AND d.deleted_at IS NULL
    )
    AND status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
  );
```

8. Volunteer soft-deletes own pending claims — explicit `USING` + `WITH CHECK` (RS-F006 pattern):
```sql
CREATE POLICY "Volunteers can withdraw own pending skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() = volunteer_id
    AND status = 'pending'
    AND deleted_at BETWEEN (now() - interval '30 seconds') AND (now() + interval '30 seconds')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );
```

### Lib Layer (`apps/web/lib/skills/`)

**types.ts**
- `DepartmentSkill` — maps `department_skills` row (id, department_id, name, created_by, created_at, deleted_at)
- `VolunteerSkillClaim` — maps full `volunteer_skills` row (all columns including new ones)
- `SkillClaimWithDepartment` — for volunteer view: claim + `department_name`, `skill_name` (or raw name for legacy)
- `SkillClaimWithVolunteer` — for leader view: claim + `volunteer_display_name`, `skill_name`

**queries.ts**
- `getDepartmentSkillsForLeader()` — dept_head: all active catalog entries for owned departments; RLS scopes automatically; ordered by department name, then skill name
- `getDepartmentSkillsForVolunteer(userId)` — volunteer: active catalog skills for departments where volunteer has an approved interest; used to populate claim form
- `getMySkillClaims(userId)` — volunteer's own claims (deleted_at IS NULL); includes legacy (NULL dept) rows; LEFT JOIN `department_skills` for skill name where skill_id is set; ordered by created_at DESC
- `getPendingSkillClaimsForScope()` — dept_head: all claims (deleted_at IS NULL, department_id IS NOT NULL) in owned departments; JOIN profiles (display_name), department_skills (name), departments (name); RLS scopes automatically; ordered by status ASC (pending first), created_at ASC
- `getAllSkillClaims()` — super_admin: all claims (deleted_at IS NULL, department_id IS NOT NULL); JOIN profiles, departments; RLS restricts to super_admin; ordered by departments.name, profiles.display_name

**actions.ts** — all follow the same pattern as `lib/interests/actions.ts`

- `createDepartmentSkill(departmentId, name)` — verify caller is `dept_head` and owns the department; INSERT into `department_skills`; on unique violation (23505) return `"A skill with this name already exists in this department"`; return `{ success: true }` or `{ error: string }`; revalidatePath("/skills")
- `deleteDepartmentSkill(skillId)` — verify caller is `dept_head`; fetch skill's department_id and verify ownership; UPDATE `deleted_at = now()`; return `{ success: true }` or `{ error: string }`; revalidatePath("/skills")
- `claimSkill(skillId)` — verify caller is `volunteer`; fetch skill (must exist and not be deleted); verify volunteer has approved interest in the skill's department; INSERT into `volunteer_skills` with `volunteer_id`, `skill_id`, `department_id` (from catalog row), `name` (from catalog row); on unique violation return `"You have already claimed this skill"`; return `{ success: true }` or `{ error: string }`; revalidatePath("/skills")
- `withdrawSkillClaim(claimId)` — fetch claim row; verify `volunteer_id = auth.uid()` and `status = 'pending'` and `deleted_at IS NULL`; UPDATE `deleted_at = now()`; return `{ success: true }` or `{ error: string }`; revalidatePath("/skills")
- `approveSkillClaim(claimId)` — verify caller is `dept_head`; fetch claim; verify claim is in a department owned by caller; verify `deleted_at IS NULL` and `status = 'pending'`; UPDATE `status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()`; return `{ success: true }` or `{ error: string }`; revalidatePath("/skills")
- `rejectSkillClaim(claimId)` — same ownership and status checks as approve; UPDATE `status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()`; return `{ success: true }` or `{ error: string }`; revalidatePath("/skills")

### Route Structure

Single shared route `(app)/skills/` — same pattern as `(app)/interests/`:

```
(app)/skills/
  page.tsx
  _components/
    volunteer-skills-view.tsx
    skill-claim-list.tsx
    claim-skill-form.tsx
    leader-skills-view.tsx
    department-skill-catalog.tsx
    skill-claim-card.tsx
    super-admin-skills-view.tsx
```

**`page.tsx` role dispatch (explicit string comparison — `isLeaderRole()` is not used):**

```typescript
if (role === 'volunteer')    → Promise.all([getMySkillClaims, getDepartmentSkillsForVolunteer]) → <VolunteerSkillsView>
if (role === 'dept_head')    → Promise.all([getDepartmentSkillsForLeader, getPendingSkillClaimsForScope]) → <LeaderSkillsView>
if (role === 'super_admin')  → getAllSkillClaims() → <SuperAdminSkillsView>
else                         → redirect('/dashboard')
```

### Navigation

Update `app-nav.tsx` to add `{ label: "Skills", href: "/skills", show: role !== "sub_leader" }` to the `navItems` array after the Interests entry.

---

## Files To Create Or Modify

| File | Action | Reason |
|---|---|---|
| `supabase/migrations/00009_skills.sql` | Create | New `department_skills` table, ALTER `volunteer_skills`, new RLS policies |
| `apps/web/lib/skills/types.ts` | Create | TypeScript types for skill entities |
| `apps/web/lib/skills/queries.ts` | Create | getDepartmentSkillsForLeader, getDepartmentSkillsForVolunteer, getMySkillClaims, getPendingSkillClaimsForScope, getAllSkillClaims |
| `apps/web/lib/skills/actions.ts` | Create | createDepartmentSkill, deleteDepartmentSkill, claimSkill, withdrawSkillClaim, approveSkillClaim, rejectSkillClaim |
| `apps/web/app/(app)/skills/page.tsx` | Create | Server component with role dispatch |
| `apps/web/app/(app)/skills/_components/volunteer-skills-view.tsx` | Create | Volunteer view: claim list + claim form |
| `apps/web/app/(app)/skills/_components/skill-claim-list.tsx` | Create | Per-claim rows with status badge and withdraw control |
| `apps/web/app/(app)/skills/_components/claim-skill-form.tsx` | Create | Dept selector → skill selector → submit |
| `apps/web/app/(app)/skills/_components/leader-skills-view.tsx` | Create | Dept_head view: catalog management + claim review |
| `apps/web/app/(app)/skills/_components/department-skill-catalog.tsx` | Create | Add/remove catalog entries per department |
| `apps/web/app/(app)/skills/_components/skill-claim-card.tsx` | Create | Per-claim row with approve/reject actions |
| `apps/web/app/(app)/skills/_components/super-admin-skills-view.tsx` | Create | Read-only oversight grouped by department |
| `apps/web/app/(app)/app-nav.tsx` | Modify | Add Skills link (role !== 'sub_leader') |
| `supabase/seed.sql` | Modify | RS-F007 seed examples |
| `docs/tracking/progress.md` | Modify | Mark RS-F007 passed on completion |
| `docs/tracking/claude-progress.txt` | Modify | Session handoff update |
| `docs/features/feature-list.json` | Modify | RS-F007 passes: true on completion |

---

## Rollout / Migration / Access Impact

**Schema:** Purely additive — new table `department_skills`, new nullable columns on `volunteer_skills`, new indexes. No existing data is altered. Existing `volunteer_skills` rows (legacy onboarding) gain NULL columns, which is backward compatible.

**RLS:** Eight new policies added plus one replaced — this is an access-control change. Migration 00009 drops the broad INSERT policy from 00005 (`volunteer_id = auth.uid() AND status = 'pending'`) and replaces it with a dual-branch policy: the legacy onboarding path (NULL `skill_id` and NULL `department_id`) is still admitted; catalog claims (non-NULL `skill_id` and `department_id`) are admitted only when the volunteer has an approved interest in the target department via subquery. This enforces the approved-interest gate at the DB layer, not only in `claimSkill`. The new `dept_head` UPDATE policy guards on `status = 'pending'` in the USING clause so already-reviewed rows cannot be re-reviewed at the DB layer.

**Downstream contracts:** RS-F008 and RS-F009 will query `volunteer_skills WHERE status = 'approved' AND department_id IS NOT NULL` for planning-eligible skills. The `department_id` and `skill_id` columns added here provide that filter path without further migration.

**No auth changes. No new roles. Access control changes: eight new RLS policies plus one replaced.**

---

## Implementation Steps

1. Create `supabase/migrations/00009_skills.sql`:
   - CREATE TABLE `department_skills` with indexes and RLS enabled
   - ALTER TABLE `volunteer_skills` ADD COLUMNS: `department_id`, `skill_id`, `reviewed_by`, `reviewed_at`
   - ADD indexes on `volunteer_skills.department_id`, `volunteer_skills.skill_id`
   - ADD partial unique index on `(volunteer_id, skill_id) WHERE deleted_at IS NULL AND skill_id IS NOT NULL`
   - DROP POLICY "Volunteers can insert own pending skills" from `volunteer_skills` (defined in 00005)
   - CREATE replacement INSERT policy with dual-branch WITH CHECK (legacy path + approved-interest-gated catalog path) as described in Approach
   - CREATE remaining RLS policies (5 on `department_skills`, 3 new on `volunteer_skills`) as described in Approach

2. Create `apps/web/lib/skills/types.ts`:
   - `DepartmentSkill`, `VolunteerSkillClaim`, `SkillClaimWithDepartment`, `SkillClaimWithVolunteer`

3. Create `apps/web/lib/skills/queries.ts`:
   - `getDepartmentSkillsForLeader()` — SELECT from `department_skills` WHERE deleted_at IS NULL; RLS scopes to owned depts automatically
   - `getDepartmentSkillsForVolunteer(userId)` — SELECT from `department_skills` WHERE deleted_at IS NULL AND `department_id IN (SELECT department_id FROM volunteer_interests WHERE volunteer_id = userId AND status = 'approved' AND deleted_at IS NULL)`
   - `getMySkillClaims(userId)` — SELECT from `volunteer_skills` WHERE volunteer_id = userId AND deleted_at IS NULL; LEFT JOIN `department_skills` for skill_name; ordered by created_at DESC
   - `getPendingSkillClaimsForScope()` — SELECT from `volunteer_skills` WHERE deleted_at IS NULL AND department_id IS NOT NULL; JOIN profiles (display_name), department_skills (name), departments (name); RLS scopes automatically; ordered by status ASC, created_at ASC
   - `getAllSkillClaims()` — SELECT from `volunteer_skills` WHERE deleted_at IS NULL AND department_id IS NOT NULL; JOIN profiles, departments; ordered by departments.name, profiles.display_name

4. Create `apps/web/lib/skills/actions.ts`:
   - `createDepartmentSkill(departmentId, name)` — role + ownership check → INSERT; handle 23505
   - `deleteDepartmentSkill(skillId)` — role + ownership check → UPDATE deleted_at
   - `claimSkill(skillId)` — role check (`volunteer`) → fetch skill → verify approved interest in dept → INSERT; handle 23505
   - `withdrawSkillClaim(claimId)` — ownership + pending + not-deleted checks → UPDATE deleted_at
   - `approveSkillClaim(claimId)` — role + ownership + pending checks → UPDATE approved
   - `rejectSkillClaim(claimId)` — role + ownership + pending checks → UPDATE rejected

5. Create `apps/web/app/(app)/skills/_components/claim-skill-form.tsx`:
   - Client component; receives `DepartmentSkill[]` grouped by department as props
   - Two-step: (1) select department → (2) select skill from that department's catalog
   - Submit button with loading/disabled state
   - Inline success: "Skill claimed — pending review."
   - Inline error on duplicate or access failure
   - Empty state: "No skills are available to claim yet."

6. Create `apps/web/app/(app)/skills/_components/skill-claim-list.tsx`:
   - Client component; receives `SkillClaimWithDepartment[]` and `onWithdraw` server action
   - Per-claim row: skill name, department name, status badge, optional withdraw control
   - Status badges: pending (warning/yellow), approved (success/green), rejected (error/red) — label + color
   - Legacy rows (NULL department_id): show with muted "Legacy — no department link" label; withdraw control IS shown (legacy rows have `status = 'pending'` from onboarding and are withdrawable per scope — "Volunteers can withdraw them and re-claim formally"); same two-step inline confirmation as catalog claims
   - Withdraw: two-step inline confirmation (same RS-F006 pattern)
   - Empty state: "You haven't claimed any skills yet."

7. Create `apps/web/app/(app)/skills/_components/volunteer-skills-view.tsx`:
   - Composes `<SkillClaimList>` + `<ClaimSkillForm>`
   - Page heading: "Your skills"
   - Section labels: "Claimed skills" / "Claim a new skill"

8. Create `apps/web/app/(app)/skills/_components/department-skill-catalog.tsx`:
   - Client component; receives `DepartmentSkill[]` for one department, `onAdd` and `onDelete` server actions
   - Inline add form: text input + "Add skill" button; loading state; inline duplicate error
   - Each skill: name + ghost "Remove" button with two-step inline confirmation (soft-delete only)
   - Empty state: "No skills defined for this department yet."

9. Create `apps/web/app/(app)/skills/_components/skill-claim-card.tsx`:
   - Client component; receives one `SkillClaimWithVolunteer`, `onApprove` and `onReject` actions
   - Pending row: volunteer name, skill name, dept name, date + "Approve" (primary) + "Reject" (ghost, inline confirm before action)
   - Reviewed row: status badge + reviewer name and date; no action buttons
   - Per-button loading states

10. Create `apps/web/app/(app)/skills/_components/leader-skills-view.tsx`:
    - Receives `DepartmentSkill[]` (grouped by dept) and `SkillClaimWithVolunteer[]` as props
    - Per-department: "Skill catalog" section (`<DepartmentSkillCatalog>`) + "Pending claims" section (`<SkillClaimCard>` per claim)
    - Department header: dept name in text-body-strong with pending count sub-label
    - Empty claims section: "No pending skill claims for this department."

11. Create `apps/web/app/(app)/skills/_components/super-admin-skills-view.tsx`:
    - Read-only; groups claims by department; status badge per row; no action buttons
    - Empty state: "No skill claims found."

12. Create `apps/web/app/(app)/skills/page.tsx`:
    - Server component; `getSessionWithProfile()` → redirect if no session
    - Explicit role dispatch as described in Approach section

13. Modify `apps/web/app/(app)/app-nav.tsx`:
    - Add `{ label: "Skills", href: "/skills", show: role !== "sub_leader" }` after the Interests entry

14. Add RS-F007 seed examples to `supabase/seed.sql`:
    - Commented examples: one `department_skills` row, one pending volunteer skill claim, one approved volunteer skill claim
    - Note: requires RS-F003 department data, RS-F004 volunteer profiles, and RS-F006 approved interests

15. Run `npm run typecheck && npm run lint && npm run build` — all must pass

16. Update `docs/tracking/progress.md`, `docs/features/feature-list.json`, and `docs/tracking/claude-progress.txt`

---

## Acceptance Criteria Mapping

**Feature registry steps (from feature-list.json):**

| Registry Step | How It Is Met |
|---|---|
| Define department-linked skills and the volunteer skill submission flow | `department_skills` catalog per department; volunteer claims via `claimSkill` with `department_id` + `skill_id` link |
| Add leader approval and rejection handling for submitted skills | `approveSkillClaim` / `rejectSkillClaim` actions; dept_head claim review UI at `/skills` |
| Ensure only approved skills feed planning logic | Downstream RS-F008/RS-F009 will filter `volunteer_skills WHERE status = 'approved' AND department_id IS NOT NULL`; no further migration required |

**PRD validation items (RS-F007):**

| PRD Item | Verification |
|---|---|
| Create a department skill and add it to a volunteer profile | Manual: dept_head adds skill to catalog; volunteer claims it; verify pending DB row |
| Confirm the new skill remains pending until reviewed | Manual: DB row has `status = 'pending'` before any approval |
| Approve the skill and confirm it becomes visible as approved in planning | Manual: dept_head approves; volunteer sees approved badge; DB row has `status = 'approved'` |
| Reject/leave pending and confirm it does not count toward gap coverage | Manual: filtered-out by `status = 'approved'` query; RS-F009 gate confirmed conceptually |

**Additional validation checks:**
- Super_admin sees all active claims; no approve/reject controls
- Sub_leader redirected to `/dashboard`; no Skills nav link visible
- Volunteer cannot withdraw an approved or rejected claim
- Volunteer cannot claim a skill for a department where they have no approved interest
- Duplicate claim (same skill_id, same volunteer) returns inline error
- Legacy onboarding skills (NULL department_id) visible to volunteer but absent from all leader views
- Soft-deleted catalog skill: existing claims retain their `skill_id` FK (soft-delete does not cascade); claim remains visible in volunteer view using the `name` stored on the `volunteer_skills` row; soft-deleted skill no longer appears in the claim form drop-down
- Dept_head cannot approve/reject claims outside owned departments

---

## Style Guardrails For UI Work

**Target surfaces:** Volunteer (warm) and leader/admin (cool) — same split as RS-F005 and RS-F006.

**Volunteer view — warm, personal:**
- Page background: `bg-surface-warm` (`#FFF8E8`)
- Heading: `text-h2` DM Sans — "Your skills"
- Status badges: pill with semantic tokens — `semantic.warning` (pending), `semantic.success` (approved), `semantic.error` (rejected); label + color (no color-only — accessibility rule)
- Withdraw control: two-step inline confirmation, same RS-F006 pattern
- Claim form: two-step (dept → skill); clean single-column; consistent with RS-F004/RS-F006 form style
- Legacy row: muted appearance (`text-neutral-500`); withdraw control shown (same two-step inline confirmation); no claim/re-claim affordance from this row
- Empty state: warm, first-person copy

**Leader view — calm, operational:**
- Page background: `bg-surface-cool` (`#F3F7FF`)
- Heading: `text-h2` DM Sans — "Department skills"
- Per-department two-section layout: catalog management above, pending claims below
- Catalog add form: compact inline text input + "Add skill" button
- Claim cards: same approve/reject button style as RS-F006 `interest-request-card`
- Reject: two-step inline confirmation (same pattern); `semantic.error` for confirm step only
- Active/hover states must include non-color indicator (underline, border) per accessibility rule

**Super_admin view — calm, oversight:**
- Page background: `bg-surface-cool`
- Heading: `text-h2` DM Sans — "All skill claims"
- Grouped by department; status badge per row; read-only label in header

**Layout:**
- Max content width consistent with other `(app)` pages
- Mobile-first single column; leader grouped layout expands from 1024px
- DM Sans throughout — no Space Grotesk on management pages

**States requiring fidelity:**
- Claim form: step-1 (dept select), step-2 (skill select populated), submit loading, success, error
- Withdraw: per-row inline confirm + loading
- Catalog add: loading + success (skill appears) + duplicate error
- Catalog remove: inline confirm + loading
- Leader approve/reject: per-button loading
- Leader reject: inline confirm state

---

## Risks Or Blockers

1. **`claimSkill` access gate:** Volunteer must have an approved interest in the skill's department before claiming. This is enforced server-side (not RLS alone) in `claimSkill`. Existing approved skill claims remain valid if the volunteer's interest is later rejected — approved skills are permanent profile data.

2. **Soft-deleted catalog skills:** The `department_skills` table uses soft-delete (`deleted_at`). Setting `deleted_at` does NOT trigger the `ON DELETE SET NULL` FK cascade — only a hard DELETE would. So soft-deleting a catalog skill leaves `volunteer_skills.skill_id` intact and pointing to the same (now-hidden) row. Pending claims for a soft-deleted skill are not automatically withdrawn; they remain visible to both volunteer and leader. Because `claimSkill` copies the skill `name` into the `volunteer_skills` row at INSERT time, display always falls back to that stored `name` value regardless of catalog state. The `ON DELETE SET NULL` FK remains in the schema as a safety net against any future hard-delete, but is not exercised by the normal soft-delete workflow.

3. **Legacy onboarding skills UI:** Claims with NULL `department_id` need a clear muted "Legacy" treatment — visible to volunteer, absent from leader views. Ensure `getMySkillClaims` includes these rows; `getPendingSkillClaimsForScope` and `getAllSkillClaims` must filter `department_id IS NOT NULL`.

4. **Duplicate catalog skill names:** Partial unique index on `lower(name)` catches case-insensitive duplicates. Unique violation (23505) must surface a clear inline error on the catalog add form.

5. **getDepartmentSkillsForVolunteer scope:** Volunteer sees only catalog skills for departments where they have an `approved` interest. A volunteer with only pending interests sees no skills to claim. The empty state copy must explain this clearly.

---

## Validation Plan

### Automated checks
- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm run build` — passes
- `npx supabase db reset` — migration 00009 applies cleanly on top of 00008

### Manual checks (18 items)

1. Sign in as dept_head → navigate to `/skills` → leader view (cool background, catalog + claims sections per department)
2. Add a skill to the catalog ("Guitar") → skill appears in catalog list; DB row in `department_skills`
3. Add the same skill again → inline error "A skill with this name already exists in this department"
4. Sign in as volunteer with an approved interest in that department → navigate to `/skills`
5. Volunteer claims "Guitar" → claim appears with pending badge; DB row has `status = 'pending'`, `department_id` and `skill_id` set
6. Volunteer tries to claim "Guitar" again → inline error "You have already claimed this skill"
7. Volunteer with no approved interests in a department → no skills visible in claim form; appropriate empty state shown
8. Sign in as dept_head → pending claim for "Guitar" visible → approve → status updates to approved; DB row confirms
9. Sign in as volunteer → skill shows approved badge
10. Sign in as a different dept_head (does not own the department) → claim not visible
11. Sign in as dept_head → reject a different pending claim → inline confirmation → rejected badge; volunteer sees rejected badge
12. Sign in as volunteer → no withdraw control on approved claim
13. Volunteer withdraws a pending claim → inline confirm → claim disappears; can re-claim the same skill
14. Sign in as super_admin → `/skills` shows oversight view (cool background); all claims across departments; no approve/reject buttons
15. Sign in as sub_leader → redirected to `/dashboard`; no Skills nav link visible
16. Legacy onboarding skill rows appear in volunteer view with muted "Legacy" indicator and withdraw control; withdrawing a legacy row via inline confirm removes it; row not visible in dept_head or super_admin views
17. Dept_head with no skills yet defined in their department → catalog section shows empty state "No skills defined for this department yet." (empty-catalog state)
18. `/skills` page renders correctly on a mobile viewport (320–375 px width): single-column layout, no horizontal overflow, all action controls reachable

---

## Documentation Updates

On completion:
- `docs/tracking/progress.md` — RS-F007 status: `passed`
- `docs/features/feature-list.json` — RS-F007 `passes: true`
- `docs/tracking/claude-progress.txt` — full handoff update for next session
- This plan file — status updated to `Implemented and Validated`
