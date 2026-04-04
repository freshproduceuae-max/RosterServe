# Plan: RS-F010 — Personalized Weekly Dashboard

Status: Draft
Feature: RS-F010
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

---

## Objective

Replace the current placeholder dashboard with a role-specific operational view that surfaces the information each user needs for weekly service coordination: upcoming assignments and team context for volunteers; roster health, open gaps, and approval queues for leaders; and an event overview for super admins. The dashboard must not expose data outside each role's allowed visibility.

---

## Scope And Non-Goals

**In scope:**
- Volunteer view: upcoming invited/accepted assignments (14-day lookahead) with full team context (event title, date, department name, sub-team name, serving role); count of pending skill claims and pending interest requests as action items
- Dept-head view: upcoming events with owned-department roster counts (invited/accepted/declined) and skill-gap count per department, plus pending interest and skill approval counts
- Sub-leader view: upcoming assignments across their sub-teams with per-sub-team roster counts and gap count
- Super-admin view: upcoming events with department count and total assigned volunteer count
- A new `apps/web/lib/dashboard/queries.ts` module with one query function per role, using `createSupabaseServerClient()` (RLS enforces scoping automatically)
- A new `apps/web/lib/dashboard/types.ts` for data shapes
- Empty states, loading-safe server-component patterns (no skeleton loaders required for v1), and correct design-system styling per role

**Not in scope — and why:**
- **Instructions and programme details**: RS-F011 is the feature that lets leaders *create* instructions (tied to events, departments, or sub-teams). No instruction schema exists at RS-F010 time, so the volunteer dashboard cannot display them yet. The volunteer view will have an instructions slot wired in during RS-F011. The PRD requirement for volunteer instructions is satisfied across RS-F010 + RS-F011 together; RS-F010 delivers assignments and team context, RS-F011 adds the instruction surface.
- Push notifications or real-time subscriptions (RS-F013)
- Assignment accept/decline actions from the dashboard (RS-F012)
- Drill-down pages or pagination within the dashboard
- A custom date-range picker; the 14-day lookahead window is fixed for v1
- Any schema change — no new migration required

---

## Approach

### Data

All needed data lives in existing tables (assignments, events, departments, sub_teams, volunteer_interests, volunteer_skills). RLS policies already enforce role-scoped visibility on every table. The dashboard queries run as the authenticated user with no additional RLS work.

One new query file (`lib/dashboard/queries.ts`) holds four role-specific async functions. Each calls `createSupabaseServerClient()` (server-only, matching the pattern used throughout the app) and issues the minimum joins needed to populate its type. The 14-day lookahead is applied inside each query with `gte('event_date', today)` + `lte('event_date', todayPlus14)` filters on the events table.

### Page structure

`app/(app)/dashboard/page.tsx` currently fetches only `getSessionWithProfile()` and renders a static placeholder. It becomes a server component that:
1. calls `getSessionWithProfile()` — already done
2. calls `unstable_noStore()` at the top to opt out of the full-route cache (ensures live data on every navigation/reload)
3. branches on `profile.role` (existing pattern)
4. calls the appropriate role query
5. passes typed props to a role-specific presentational component

Freshness target: fresh on every navigation/reload. Same-tab immediacy after an in-page action is not required; the user navigates to the roster page to act, then returns to the dashboard which re-fetches on load.

No client components are required for the initial render; role components are server components. If future interactivity is needed, those sub-components can be extracted to `"use client"` independently.

### Components

Four role views, each a dedicated server component under `app/(app)/dashboard/_components/`:
- `VolunteerDashboard` — assignment cards (upcoming), pending items list
- `DeptHeadDashboard` — event health cards (one per upcoming event + owned dept)
- `SubLeaderDashboard` — sub-team roster cards
- `SuperAdminDashboard` — upcoming events summary list

Two shared display components:
- `AssignmentCard` — renders a single assignment with event name, date, department, sub-team, and status chip
- `RosterHealthBar` — renders invited/accepted/declined counts as compact chips + a skill-gap badge (reuses existing chip and gap-badge patterns from `department-detail-card.tsx`)

---

## Files To Create Or Modify

| File | Action | Reason |
|------|--------|--------|
| `apps/web/lib/dashboard/types.ts` | Create | Typed data shapes for each role view |
| `apps/web/lib/dashboard/queries.ts` | Create | Four role-specific query functions |
| `apps/web/app/(app)/dashboard/page.tsx` | Modify | Replace placeholder; add noStore; fetch + route to role view |
| `apps/web/app/(app)/dashboard/_components/volunteer-dashboard.tsx` | Create | Volunteer view |
| `apps/web/app/(app)/dashboard/_components/dept-head-dashboard.tsx` | Create | Dept-head view |
| `apps/web/app/(app)/dashboard/_components/sub-leader-dashboard.tsx` | Create | Sub-leader view |
| `apps/web/app/(app)/dashboard/_components/super-admin-dashboard.tsx` | Create | Super-admin view |
| `apps/web/app/(app)/dashboard/_components/assignment-card.tsx` | Create | Shared assignment display |
| `apps/web/app/(app)/dashboard/_components/roster-health-bar.tsx` | Create | Shared roster counts + gap badge |

---

## Rollout / Migration / Access Impact

**Schema:** None — no new tables, columns, or indexes.

**Auth / RLS:** None — existing policies already scope every query correctly. No new grants or policies.

**Environment variables:** None.

**Infrastructure:** None.

---

## Implementation Steps

1. **Create `lib/dashboard/types.ts`**
   Define four typed data shapes:
   - `VolunteerDashboardData` — `upcomingAssignments: AssignmentWithEventContext[]`, `pendingSkillClaims: number`, `pendingInterests: number`
   - `DeptHeadDashboardData` — `eventSummaries: EventWithDeptHealth[]`, `pendingInterests: number`, `pendingSkillApprovals: number`
   - `SubLeaderDashboardData` — `subTeamSummaries: SubTeamRosterSummary[]`
   - `SuperAdminDashboardData` — `upcomingEvents: EventOverview[]`
   Define supporting types: `AssignmentWithEventContext` (includes event title/date/type, department name, sub-team name or null, assignment status/role), `EventWithDeptHealth`, `DeptRosterHealth`, `SubTeamRosterSummary`, `EventOverview`.

2. **Create `lib/dashboard/queries.ts`**
   Implement four async functions, each using `createSupabaseServerClient()` (server-only):

   - `getVolunteerDashboardData(userId: string)`: SELECT assignments WHERE `volunteer_id = userId AND status IN ('invited','accepted') AND deleted_at IS NULL`, join events (event_date BETWEEN today AND today+14, deleted_at IS NULL), join departments and sub_teams. Also fetch count of pending skill claims (`status='pending', volunteer_id=userId, deleted_at IS NULL`) and pending interests (`status='pending', volunteer_id=userId, deleted_at IS NULL`). Return `VolunteerDashboardData`.

   - `getDeptHeadDashboardData(userId: string)`: SELECT departments WHERE `owner_id = userId AND deleted_at IS NULL`, join events (event_date BETWEEN today AND today+14, deleted_at IS NULL). For each event+dept pair: count assignments by status using group-by or three filtered counts (invited, accepted, declined — exclude deleted). Fetch gap count with a bulk join: department_skills WHERE `is_required=true AND deleted_at IS NULL`, cross-referenced against assignments + volunteer_skills WHERE `status='approved'` — do not call `getSkillGapsForDepartmentRoster` in a loop (N+1). Fetch total pending volunteer_interests and volunteer_skills WHERE department in owned set. Return `DeptHeadDashboardData`.

   - `getSubLeaderDashboardData(userId: string)`: SELECT sub_teams WHERE `owner_id = userId AND deleted_at IS NULL`, join departments (for gap calc) and events (event_date BETWEEN today AND today+14). For each sub_team: SELECT assignments WHERE `sub_team_id = st.id AND deleted_at IS NULL`, count by status. Fetch gap count inline (same bulk approach as dept_head — do not loop the per-roster helper). Return `SubLeaderDashboardData`.

   - `getSuperAdminDashboardData()`: SELECT events WHERE `event_date BETWEEN today AND today+14 AND deleted_at IS NULL`, ordered by event_date ASC. For each event: count departments (deleted_at IS NULL) and count distinct assigned volunteers (assignments, deleted_at IS NULL, status != 'declined'). Return `SuperAdminDashboardData`.

3. **Create `_components/assignment-card.tsx`**
   Renders one `AssignmentWithEventContext`. Shows: event title, event date (formatted with date-fns, e.g. "Sun 6 Apr 2026"), department name, sub-team name or "—", assignment role ("Volunteer" / "Sub-leader"), status chip (`invited` → neutral `border-neutral-300 text-neutral-600`, `accepted` → `border-semantic-success bg-semantic-success/10 text-semantic-success`). Uses `bg-neutral-0 border border-neutral-300 rounded-200 p-300`.

4. **Create `_components/roster-health-bar.tsx`**
   Accepts `{ invited: number; accepted: number; declined: number; gapCount: number }`. Renders compact chips for each non-zero count using the existing chip pattern (`rounded-full border px-200 py-50 text-body-sm font-medium`): accepted → semantic-success tint, declined → semantic-error tint, invited → neutral tint. If `gapCount > 0`, render the amber gap badge using exactly the same classes as `department-detail-card.tsx` line 53: `rounded-full border border-semantic-warning bg-semantic-warning/10 px-200 py-50 text-body-sm font-medium text-semantic-warning`.

5. **Create `_components/volunteer-dashboard.tsx`**
   Server component accepting `VolunteerDashboardData` and `displayName: string`. Layout:
   - Greeting heading: "Hi, {firstName}" — derive firstName as the first word of `displayName` (`text-h1 font-display text-neutral-950`)
   - If `upcomingAssignments.length === 0`: calm empty state: "Nothing coming up in the next two weeks. Check back after the next roster is published." (`text-body text-neutral-600`)
   - Otherwise: section heading "Coming up" (`text-h2`) + list of `<AssignmentCard>` sorted by event_date ascending
   - If `pendingSkillClaims > 0` or `pendingInterests > 0`: section "Awaiting review" (`text-h2`) with bullet links: "N skill claim(s) pending review" → `/skills`; "N interest request(s) pending" → `/interests`
   - Surface: `bg-surface-warm` band behind greeting (`py-400 px-400`); `bg-neutral-100` for the body

6. **Create `_components/dept-head-dashboard.tsx`**
   Server component accepting `DeptHeadDashboardData` and `displayName: string`. Layout:
   - Heading: "Your departments" (`text-h2 font-display`)
   - If no upcoming events: empty state: "No upcoming events in your departments."
   - Otherwise: one card per `EventWithDeptHealth` (`bg-neutral-0 border border-neutral-300 rounded-200 p-300`). Card header: event title (`text-h3`) + formatted date (`text-body-sm text-neutral-600`). Card body: per-dept row with department name + `<RosterHealthBar>` + "View Roster" link to `/events/{eventId}/departments/{deptId}/roster`
   - Below cards: if `pendingInterests > 0` → inline link "N interest requests pending" → `/interests`; if `pendingSkillApprovals > 0` → inline link "N skill approvals pending" → `/skills`
   - Surface: `bg-surface-cool` for card band; `bg-neutral-100` canvas

7. **Create `_components/sub-leader-dashboard.tsx`**
   Server component accepting `SubLeaderDashboardData` and `displayName: string`. Layout:
   - Heading: "Your sub-teams" (`text-h2 font-display`)
   - If no upcoming activity: empty state: "No upcoming assignments in your sub-teams."
   - Otherwise: one card per `SubTeamRosterSummary` (`bg-neutral-0 border border-neutral-300 rounded-200 p-300`): sub-team name (`text-h3`) + event title + date + `<RosterHealthBar>` + "View Roster" link to `/events/{eventId}/departments/{deptId}/roster` (the existing dept roster route, which already handles sub-leader scoping internally — no sub-team-specific route exists or is needed)
   - Surface: `bg-surface-cool`

8. **Create `_components/super-admin-dashboard.tsx`**
   Server component accepting `SuperAdminDashboardData`. Layout:
   - Heading: "Upcoming events" (`text-h2 font-display`)
   - On mobile: card list; on `md:` and up: table with columns: Event, Date, Status, Departments, Assigned. Each row has a "View" link → `/events/{eventId}`
   - If empty: "No events in the next two weeks."
   - Surface: `bg-neutral-0` table/cards on `bg-neutral-100`

9. **Update `app/(app)/dashboard/page.tsx`**
   - Add `import { unstable_noStore as noStore } from 'next/cache'` and call `noStore()` as the first line of the component body (before any data fetch)
   - Branch on `profile.role`, call the appropriate query function, pass typed props to the role component
   - Keep existing `isLeaderRole` import and session logic intact; only the render section changes
   - Add a comment noting that `unstable_noStore` is stable in Next.js 14.1; use `noStore` (no `unstable_` prefix) if upgrading to Next.js 15+

---

## Acceptance Criteria Mapping

**Feature registry steps:**

| Registry step | How it is satisfied |
|---|---|
| "Build role-specific weekly dashboard states" | Four distinct role components with role-appropriate data and empty states |
| "Populate dashboards with scoped assignments, planning health, and relevant context" | Volunteers see assignments + team context; leaders see roster health + gaps + pending queues; super admin sees event overview |
| "Reflect assignment and planning state changes quickly enough for weekly coordination" | `noStore()` ensures fresh data on every page navigation/reload |

**PRD validation items:**

| PRD item | Verification |
|---|---|
| Volunteers see upcoming assignments, team context | Assignment cards show event, dept, sub-team, role, date |
| Instructions deferred to RS-F011 | Explicitly noted in Non-Goals; RS-F011 wires the instruction surface |
| Leaders see planning status, roster health, declines, open issues | DeptHead and SubLeader views confirmed |
| Senior leaders/admins see broader oversight | SuperAdmin view confirmed |
| Dashboard content is role-specific | Four distinct views verified per role |
| No data exposed outside allowed visibility | RLS + explicit zero-rows-outside-scope validation check |
| Updates reflected quickly enough | `noStore()` — fresh on every page load |

---

## Style Guardrails For UI Work

**Surfaces and users:** All four roles. Volunteer surfaces use `bg-surface-warm` accents; leader/admin surfaces use `bg-surface-cool`. General canvas remains `bg-neutral-100`.

**Component patterns:**
- Assignment cards: `bg-neutral-0 border border-neutral-300 rounded-200 p-300` — matches existing card language (roster table, department detail)
- Status chips: existing chip pattern (`rounded-full border px-200 py-50 text-body-sm font-medium`) — identical classes to GapSummary and department-detail-card chips
- Gap badge: exact class match from `department-detail-card.tsx` line 53 — do not create a new style variant
- Section headings: `text-h2 font-display text-neutral-950`
- Card sub-headings: `text-h3 font-display text-neutral-950`
- Metadata (event date, counts): `text-body-sm text-neutral-600`

**Empty states:** Calm, single sentence, no illustration. Neutral copy — no exclamation marks or emoji.

**Spacing:** Cards use `p-300` internally, `gap-300` between cards. Page sections use `gap-400`. Greeting band uses `py-400 px-400`.

**Mobile-first:** Single-column card stack on mobile. Leader desktop may expand to two columns from `1024px` but single-column is the required baseline.

**Links:** Use `text-brand-calm-600 underline-offset-2` for inline action links, matching the existing `/events` page convention.

**Design-fidelity review:** Before marking this feature complete, verify rendered output against the design-system token reference for: surface tints per role, chip color tokens, gap badge amber treatment, spacing between cards, and heading hierarchy. This review is required because `ui: true`.

---

## Risks Or Blockers

1. **Dept-head gap count performance**: Calling `getSkillGapsForDepartmentRoster` in a loop is N+1 DB round-trips. Mitigation documented in step 2: compute gaps with a single bulk join across all owned departments' required skills and covered volunteer skills. Do not reuse the per-roster helper for this query.

2. **Sub-leader has no Events nav link**: Sub-leaders cannot navigate to events from the nav bar. The dashboard links directly to `/events/{eventId}/departments/{deptId}/roster` which is accessible via URL without the nav. No nav change needed for v1.

3. **14-day window may be empty near end of event cycle**: Handled by calm empty states per role. No "no events" confusion because the copy explicitly says "in the next two weeks."

4. **`unstable_noStore` API naming**: Stable in Next.js 14.1. Will need rename to `noStore` on upgrade to Next.js 15+. Document in code comment.

5. **RLS regression history**: This project has had RLS regressions around events and assignments (PRs #13, #14). The zero-rows-outside-scope validation check in the validation plan is mandatory — do not skip it.

---

## Validation Plan

**Manual checks (run after implementation):**

1. Sign in as **volunteer** → dashboard shows their upcoming invited/accepted assignments for the next 14 days with correct event/dept/sub-team/date context; pending skill/interest counts appear and link correctly; empty state renders when nothing is scheduled
2. Sign in as **dept_head** → upcoming events show with correct invited/accepted/declined counts per owned department; gap badge count matches what appears on the department detail page; pending interest and skill approval counts link to correct pages
3. Sign in as **sub_leader** → upcoming sub-team roster cards show with correct counts; gap badge appears when required skills are uncovered; "View Roster" link navigates to the dept roster page which correctly scopes to their sub-team
4. Sign in as **super_admin** → upcoming events table shows correct department and assigned volunteer counts; "View" links navigate to event detail
5. **Zero-rows-outside-scope check**: volunteer A cannot see volunteer B's assignments on their dashboard; dept_head cannot see departments they do not own; sub_leader cannot see sub-teams they do not own. Verify by signing in with a second account and confirming no cross-scope data appears.
6. **State change check**: change a volunteer's assignment from `invited` to `accepted` via the roster page; navigate to the dashboard as that volunteer; confirm the status chip now shows `accepted` (fresh fetch on navigation)
7. **Empty state**: ensure each role's empty state message renders correctly when no upcoming data exists (not a blank page or error)
8. **Design-fidelity review**: compare rendered dashboard against design-system surface tints (warm/cool per role), chip color tokens, gap badge amber treatment, card spacing, and heading hierarchy — confirm no ad hoc colors or spacing are introduced
9. **Automated**: `npm run typecheck`, `npm run lint`, `npm run build` — all must pass

---

## Documentation Updates

When this feature lands:
- `docs/features/feature-list.json` → set `RS-F010.passes = true`
- `docs/tracking/progress.md` → set RS-F010 row to `passed`, add milestone entry
- `docs/plans/plan-rs-f010-weekly-dashboard.md` → set status to `Implemented and Validated`
- `docs/tracking/claude-progress.txt` → update handoff
