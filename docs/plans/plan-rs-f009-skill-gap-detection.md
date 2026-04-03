# Plan: RS-F009 — Skill-Gap Detection and Planning Signals

Status: Implemented
Feature: RS-F009
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

---

## Objective

Enable department heads to define required skills for their department and see at a glance whether current roster assignments cover those skills. Surface gap warnings before the event so leaders can act in time.

---

## Scope And Non-Goals

**In scope:**
- Adding an `is_required` flag to `department_skills` (the per-department, per-event skill catalog)
- A server action for dept heads to toggle skill requirements
- Server-side gap computation: required skills vs. approved skills of currently assigned volunteers
- Gap summary section on the roster page (dept head and sub-leader views)
- Skill match context in the volunteer selector (highlight matching skills)
- Gap count badge on the department detail card
- UPDATE RLS policy for `department_skills` (needed for the required toggle)

**Not in scope:**
- Per-event overrides of required skills (department_skills are already per-event because departments have event_id)
- Gap computation for sub-leader sub-team granularity in v1 (summary is at dept level; sub-leader sees the same dept-level summary scoped to their view)
- Automated notifications on gap state (that belongs in RS-F013)
- Gap history or trend tracking
- Required headcount (how many people with skill X), only skill presence/absence in v1
- Event-level gap rollup on the events list page (deferred — keep scope tight)

---

## Approach

### Schema

Add `is_required BOOLEAN NOT NULL DEFAULT false` to `department_skills`. Since departments already have an `event_id` FK, this flag is effectively per-event-department — no new table is required.

Add an UPDATE RLS policy so dept heads can set `is_required` on skills they own (dept where `owner_id = auth.uid()`).

### Gap Computation (server-side)

New query `getSkillGapsForDepartmentRoster(eventId, deptId)`:
1. Fetch required skills: `department_skills WHERE department_id = deptId AND is_required = true AND deleted_at IS NULL`
2. Fetch active assignments: `assignments WHERE event_id = eventId AND department_id = deptId AND deleted_at IS NULL`
3. For each assigned volunteer, fetch approved skills: `volunteer_skills WHERE volunteer_id IN [...] AND department_id = deptId AND status = 'approved' AND deleted_at IS NULL`
4. Union approved skill names across all assigned volunteers → covered set
5. Return `RosterGapSummary { required: string[], covered: string[], gaps: string[] }`

If no required skills are defined, return an empty/neutral state (no false alarms).

### UI Surfaces (leader-facing)

1. **Skills page** (`/skills`) — add a "Required" toggle to each skill in the dept head's catalog list. Only visible to dept_head role.
2. **Roster page** — add a `<GapSummary>` section in `dept-head-roster-view.tsx` and `sub-leader-roster-view.tsx` (read-only for sub-leader). Shows: required skills, which are covered, which are missing.
3. **Volunteer selector** — if required skills are defined, enhance the existing skill chips to visually distinguish skills that cover a requirement vs. other approved skills. Add a warning badge if the volunteer covers no required skills.
4. **Department detail card** — add a subtle gap badge (e.g., "2 skill gaps") when gaps exist. Links to the roster.

---

## Files To Create Or Modify

### New files
- `supabase/migrations/00012_skill_requirements.sql` — schema change + UPDATE RLS policy
- `apps/web/lib/skills/gap-types.ts` — `SkillGap`, `RosterGapSummary` types
- `apps/web/lib/skills/gap-queries.ts` — `getSkillGapsForDepartmentRoster()`
- `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/gap-summary.tsx` — gap summary UI component

### Modified files
- `apps/web/lib/skills/types.ts` — add `is_required: boolean` to `DepartmentSkill`
- `apps/web/lib/skills/actions.ts` — add `setSkillRequired(skillId, isRequired)` server action
- `apps/web/lib/skills/queries.ts` — include `is_required` in `getDepartmentSkillsForLeader()`
- `apps/web/app/(app)/skills/page.tsx` — render Required toggle per skill catalog item (dept head view)
- `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/page.tsx` — load gap data alongside assignments; pass to views
- `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/dept-head-roster-view.tsx` — add `<GapSummary>` below header
- `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/sub-leader-roster-view.tsx` — add `<GapSummary>` (read-only)
- `apps/web/app/(app)/events/[id]/departments/[deptId]/roster/_components/volunteer-selector.tsx` — skill match highlighting
- `apps/web/app/(app)/events/[id]/departments/[deptId]/_components/department-detail-card.tsx` — gap badge
- `apps/web/app/(app)/events/[id]/departments/[deptId]/page.tsx` — load gap data for dept detail badge
- `docs/tracking/progress.md` — update status
- `docs/tracking/claude-progress.txt` — update handoff
- `docs/features/feature-list.json` — set RS-F009 passes = true after validation

---

## Rollout / Migration / Access Impact

**Schema:** One `ALTER TABLE` adding a boolean column with a default (`false`). Safe to apply without data migration — all existing rows get `is_required = false`, which is the correct neutral starting state.

**RLS:** New UPDATE policy on `department_skills`. Must be added in the migration.
- Dept heads can UPDATE `is_required` on skills where they own the department (`department.owner_id = auth.uid()`).
- No RLS changes to `volunteer_skills` or `assignments`.

**No new auth rules, roles, or environment variables required.**

---

## Implementation Steps

1. **Write migration `00012_skill_requirements.sql`:**
   - `ALTER TABLE department_skills ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT false;`
   - Add UPDATE RLS policy: dept heads can update `department_skills` for departments they own

2. **Update TypeScript types:**
   - `lib/skills/types.ts`: add `is_required: boolean` to `DepartmentSkill`
   - `lib/skills/gap-types.ts` (new): define `RosterGapSummary { required: string[]; covered: string[]; gaps: string[] }` and `GapState = 'no_requirements' | 'fully_covered' | 'partial' | 'uncovered'`

3. **Update skills query:**
   - `lib/skills/queries.ts`: add `is_required` to the SELECT in `getDepartmentSkillsForLeader()`

4. **Add server action:**
   - `lib/skills/actions.ts`: add `setSkillRequired(skillId: string, isRequired: boolean)`
   - Authorization: caller must own the department the skill belongs to
   - Revalidate `/skills` path

5. **Add gap query:**
   - `lib/skills/gap-queries.ts` (new): implement `getSkillGapsForDepartmentRoster(eventId, deptId)`
   - Returns `RosterGapSummary`
   - Uses approved-skills-only filter (`status = 'approved'`)

6. **Skills page — Required toggle:**
   - In the dept head catalog section, add a toggle/checkbox per skill to set `is_required`
   - Only render for dept_head role; volunteer view unchanged

7. **Roster page — load gap data:**
   - `roster/page.tsx`: call `getSkillGapsForDepartmentRoster(eventId, deptId)` parallel with existing queries
   - Pass `gapSummary: RosterGapSummary` prop to `DeptHeadRosterView` and `SubLeaderRosterView`

8. **GapSummary component (new):**
   - Displays when `required.length > 0` only (no-op for departments with no required skills defined)
   - `fully_covered`: subtle success chip row
   - `partial` / `uncovered`: warning callout listing missing skill names
   - Uses `color.semantic.warning` (#C98900) for gap chips, `color.semantic.success` (#229A5A) for covered
   - Compact card with border (neutral-300), `color.surface.cool` background

9. **Volunteer selector — skill match context:**
   - Mark skill chips matching a required skill with a check indicator (success color)
   - Show "No required skills" warning note if volunteer has none of the required skills
   - No functional gating — all volunteers remain assignable

10. **Department detail card — gap badge:**
    - If `gaps.length > 0`: render amber badge "X skill gap(s)" next to roster link
    - No badge if fully covered or no requirements defined

11. **Run automated checks:** `npm run typecheck && npm run lint && npm run build`

---

## Acceptance Criteria Mapping

| Feature registry step | Covered by |
|---|---|
| Define required skill coverage rules for planning scopes | `is_required` on `department_skills` + Required toggle UI on skills page |
| Compare coverage against approved skills and current roster state | `getSkillGapsForDepartmentRoster()` query using approved-only skills |
| Surface actionable gap signals in leader planning views | `GapSummary` component on roster page + gap badge on dept detail |

| PRD validation item | Covered by |
|---|---|
| Required skill scenario with insufficient coverage → gap state | GapSummary shows missing skills when no assigned volunteer covers them |
| Add approved coverage → gap resolves | Reloading roster after assignment of a volunteer with the skill shows fully_covered |
| Unapproved skills do not resolve the gap | Query filters `status = 'approved'`; pending/rejected skills excluded |

---

## Style Guardrails For UI Work

Target users: dept_head (primary), sub_leader (read-only), super_admin (informational)
Surface: leader — calm, data-rich, structured

**GapSummary component:**
- `color.semantic.warning` (#C98900) for gap chips and warning heading
- `color.semantic.success` (#229A5A) for covered skill chips
- `color.surface.cool` (#F3F7FF) for section background
- DM Sans body font; JetBrains Mono for skill name chips
- Compact card with border (neutral-300), rounded corners
- Empty / no-requirements state: render nothing

**Volunteer selector skill chips:**
- Check indicator on chips matching a required skill (success color)
- "No required skills" amber note when volunteer covers none
- Do not gate or disable selection

**Gap badge on department detail:**
- Small pill, amber warning color, "X skill gap(s)"
- No badge = no requirements OR fully covered

**Required toggle on skills page:**
- Small labeled switch or checkbox, body-sm
- Only visible to dept_head

---

## Risks Or Blockers

1. UPDATE RLS on `department_skills` may not exist — migration must add it explicitly.
2. Skills page structure from RS-F007 must be read before adding the toggle.
3. Sub-leaders see dept-level gap summary (not sub-team level) — this is by design, not a bug.
4. No required skills defined = GapSummary renders nothing (avoid false noise).

---

## Validation Plan

1. Mark a skill as Required on skills page as dept head — persists on reload
2. View roster with no assignments — GapSummary shows skill as gap
3. Assign volunteer with approved version of that skill — GapSummary shows fully covered
4. Assign volunteer with only pending version of the skill — gap does not resolve
5. Assign volunteer with approved version of a different skill — original gap still shows
6. Mark two skills Required; assign volunteer covering only one — partial gap shown
7. In volunteer selector, verify skills matching required show check indicator
8. In volunteer selector, verify volunteer with no required skills shows "No required skills" note
9. Department detail card shows gap badge when gaps exist; no badge when covered
10. As sub-leader — gap summary visible, Required toggle not shown
11. As volunteer — no gap UI visible anywhere
12. No required skills defined — GapSummary renders nothing on roster page
13. `npm run typecheck`, `npm run lint`, `npm run build` — all pass

---

## Documentation Updates

On landing:
- `docs/features/feature-list.json`: set RS-F009 `passes = true`
- `docs/tracking/progress.md`: set RS-F009 status to `passed`
- `docs/tracking/claude-progress.txt`: replace with RS-F009 handoff state
- `docs/plans/plan-rs-f009-skill-gap-detection.md`: set status to `Implemented and Validated`
