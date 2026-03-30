# Plan: RS-F006 - Interest Request Management

Status: Draft
Feature: RS-F006
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

## Objective

Allow volunteers to submit department interest requests after onboarding, track the reviewable status of those requests, and give department heads the ability to approve or reject them — closing the loop between volunteer intent and leader confirmation.

## Scope And Non-Goals

### In Scope

- Add `status`, `reviewed_by`, `reviewed_at`, and `deleted_at` columns to `volunteer_interests`
- Replace the existing hard `UNIQUE (volunteer_id, department_id)` constraint with a partial unique index `WHERE deleted_at IS NULL`
- Update `replace_volunteer_interests()` RPC to soft-delete instead of hard-delete
- Auto-approve all existing rows in the migration (pre-RS-F006 onboarding interests treated as implicitly accepted)
- New server actions: `submitInterest`, `withdrawInterest`, `approveInterest`, `rejectInterest`
- Volunteer UI at `/interests`: view own interest statuses, submit new interests, withdraw pending interests
- Dept_head UI at `/interests`: view pending and reviewed requests scoped to owned departments, approve or reject
- Super_admin UI at `/interests`: read-only oversight view of all active interests across all departments
- Sub_leader: redirected to `/dashboard` — sub-team interest routing deferred to a later pass
- Navigation link to `/interests` added for volunteer, dept_head, and super_admin roles
- Update RS-F005 scope queries to filter `status IN ('pending','approved') AND deleted_at IS NULL`
- Seed examples for RS-F006

### v1 Scope Interpretation

RS-F006 is **department-level only** in v1. The PRD mentions "departments or sub-teams" but the existing `volunteer_interests` table carries only `department_id`. Sub-team-level interest routing (and sub-leader review) is a deliberate v1 deferral pending schema extension, not an omission.

Interest requests submitted post-RS-F006 start as `pending`. Existing pre-migration rows are auto-approved. New requests must be reviewed by the appropriate dept_head before moving to `approved` or `rejected`.

### Role Behavior Summary

| Role | Route result | Can approve/reject |
|---|---|---|
| `volunteer` | VolunteerInterestsView | No |
| `dept_head` | LeaderInterestsView | Yes |
| `super_admin` | SuperAdminInterestsView (read-only) | No |
| `sub_leader` | `redirect('/dashboard')` | No — deferred |

`isLeaderRole()` is **not used** to gate this route. Role is checked by explicit string comparison.

### Explicit Scope Boundaries

- **Sub-team interest routing** — not in v1; the existing schema has no `sub_team_id` column on `volunteer_interests`
- **Sub-leader review UI** — deferred; sub_leaders see no interests view in v1
- **Interest notifications** — deferred to RS-F013
- **Interest-driven assignment** — deferred to RS-F008

### Non-Goals

- Modifying event, department, or assignment data
- Any write access by leaders to volunteer profiles
- Bulk approve/reject

## Approach

### Data Model (Migration 00008)

**Alter `volunteer_interests`:**

| Column | Change | Notes |
|---|---|---|
| `status` | ADD | `text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))` |
| `reviewed_by` | ADD | `uuid REFERENCES profiles(id) ON DELETE SET NULL` — nullable |
| `reviewed_at` | ADD | `timestamptz` — nullable |
| `deleted_at` | ADD | `timestamptz` — nullable, soft-delete timestamp |

**Constraint change:**
- DROP existing `UNIQUE (volunteer_id, department_id)` constraint
- ADD partial unique index: `(volunteer_id, department_id) WHERE deleted_at IS NULL`

This matches the RS-F005 partial-index pattern and allows a volunteer to re-submit an interest after withdrawing a previous one.

**Auto-approve existing rows:**
```sql
UPDATE public.volunteer_interests
  SET status = 'approved'
  WHERE deleted_at IS NULL;
```
Pre-migration rows were created during onboarding with no review step; they are treated as implicitly accepted.

**Updated `replace_volunteer_interests()` RPC (replaces 00006 version):**
- Change the `DELETE FROM volunteer_interests WHERE volunteer_id = p_volunteer_id` to `UPDATE ... SET deleted_at = now() WHERE volunteer_id = p_volunteer_id AND deleted_at IS NULL`
- New inserts land as `status = 'pending'` via the column default
- SECURITY DEFINER — bypasses RLS, so the soft-delete inside the function is safe regardless of row-level policies

**Updated volunteer SELECT policy:**
- The existing "Volunteers can read own interests" policy (`USING auth.uid() = volunteer_id`) does not filter `deleted_at IS NULL`. Replace it to add that filter.

**DROP the existing "Volunteers can delete own interests" DELETE policy** — replaced by the UPDATE-for-soft-delete policy below.

**New RLS policies added in migration 00008:**

1. **Updated volunteer read** (replaces existing): `SELECT` WHERE `volunteer_id = auth.uid() AND deleted_at IS NULL`
2. **Volunteer soft-delete own pending**: `UPDATE` WHERE `auth.uid() = volunteer_id AND status = 'pending' AND deleted_at IS NULL`
3. **Dept_head reads in-scope interests**: `SELECT` WHERE `deleted_at IS NULL AND EXISTS (SELECT 1 FROM departments d WHERE d.id = department_id AND d.owner_id = auth.uid() AND d.deleted_at IS NULL)` AND caller has role `dept_head` (via profiles subquery)
4. **Dept_head reviews in-scope interests**: `UPDATE` WHERE same scope check as above — allows setting `status`, `reviewed_by`, `reviewed_at`
5. **Super_admin reads all**: `SELECT` WHERE caller has role `super_admin` (via profiles subquery); includes soft-deleted rows for oversight

The existing INSERT policy from 00006 ("Volunteers can insert own interests for active departments") **remains unchanged** and covers post-onboarding interest submissions.

The existing super_admin SELECT from 00005 must be reviewed — if it conflicts with the new one, drop the 00005 version and rely on the new policy.

### RS-F005 Scope Query Update

In `apps/web/lib/availability/queries.ts`, the `getBlockoutsForScope()` and `getVolunteersInScope()` functions join through `volunteer_interests`. Update those joins to add:

```sql
AND vi.deleted_at IS NULL
AND vi.status IN ('pending', 'approved')
```

This excludes rejected and withdrawn interests from the leader's planning scope. Pending interests remain in scope — leaders should see availability for volunteers who are under review.

### Lib Layer (`apps/web/lib/interests/`)

**types.ts**
- `InterestRequest` — maps the full DB row (all columns including status, reviewed_by, reviewed_at, deleted_at)
- `InterestWithDepartment` — for volunteer view: interest row + `department_name: string`, `event_title: string`
- `InterestWithVolunteer` — for leader/admin view: interest row + `display_name: string`, `department_name: string`
- `DepartmentForInterestSubmit` — `{ id, name, event_title }` — available to join

**queries.ts**
- `getMyInterests(userId)` — volunteer's own active interests (`deleted_at IS NULL`), joined with departments and events for display. Ordered by `created_at DESC`.
- `getPendingInterestsForScope()` — dept_head: all interests (`deleted_at IS NULL`) in their owned departments, joined with profiles for `display_name`. RLS scopes automatically. Ordered by `status ASC` (pending first), then `created_at ASC`.
- `getAllInterests()` — super_admin: all interests (`deleted_at IS NULL`), joined with profiles and departments. Ordered by department name, then volunteer name.
- `getDepartmentsAvailableToJoin(userId)` — active departments from published events that the volunteer has no current active interest in. Reuses the same department-active check as `getActiveDepartmentsForInterests()` in `lib/onboarding/queries.ts`, filtered with `NOT EXISTS (SELECT 1 FROM volunteer_interests vi WHERE vi.volunteer_id = userId AND vi.department_id = d.id AND vi.deleted_at IS NULL)`.

**actions.ts**
- `submitInterest(departmentId)` — verify caller is `volunteer`; INSERT into `volunteer_interests` (status defaults to `pending`); on unique violation return `"You already have an active interest for this department"`; return `{ success: true }` or `{ error: string }`
- `withdrawInterest(interestId)` — verify caller owns the row and `status = 'pending'` and `deleted_at IS NULL`; UPDATE `deleted_at = now()`; return `{ success: true }` or `{ error: string }`
- `approveInterest(interestId)` — verify caller is `dept_head`; verify interest is in a department owned by caller; verify `deleted_at IS NULL`; UPDATE `status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()`; return `{ success: true }` or `{ error: string }`
- `rejectInterest(interestId)` — same ownership checks as approve; UPDATE `status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()`; return `{ success: true }` or `{ error: string }`

### Route Structure

**Single shared route: `(app)/interests/`** — same pattern as `(app)/availability/`

```
(app)/interests/
  page.tsx                               — server component: role dispatch, fetches data, renders view
  _components/
    volunteer-interests-view.tsx         — own interests list + submit new interest form
    interest-status-list.tsx             — per-interest row: dept name, status badge, withdraw control
    submit-interest-form.tsx             — department selector + submit; only shows available departments
    leader-interests-view.tsx            — pending + reviewed requests grouped by department
    interest-request-card.tsx            — per-request row: volunteer name, date, approve/reject actions
    super-admin-interests-view.tsx       — read-only grouped overview of all interests
```

**`page.tsx` logic (explicit role dispatch — `isLeaderRole()` is not used):**
```typescript
if (role === 'volunteer')    → getMyInterests + getDepartmentsAvailableToJoin → <VolunteerInterestsView>
if (role === 'dept_head')    → getPendingInterestsForScope → <LeaderInterestsView>
if (role === 'super_admin')  → getAllInterests → <SuperAdminInterestsView>
else                         → redirect('/dashboard')   // catches sub_leader and any future roles
```

### Navigation

Update `app-nav.tsx` to render "Interests" link (`/interests`) for `volunteer`, `dept_head`, and `super_admin` roles. Sub_leader does not receive the link in v1.

## Files To Create Or Modify

| File | Action | Reason |
|---|---|---|
| `supabase/migrations/00008_interest_requests.sql` | Create | Schema additions, constraint change, RPC update, new RLS policies |
| `apps/web/lib/interests/types.ts` | Create | TypeScript types for interest entities |
| `apps/web/lib/interests/queries.ts` | Create | getMyInterests, getPendingInterestsForScope, getAllInterests, getDepartmentsAvailableToJoin |
| `apps/web/lib/interests/actions.ts` | Create | submitInterest, withdrawInterest, approveInterest, rejectInterest |
| `apps/web/app/(app)/interests/page.tsx` | Create | Shared route server component with role dispatch |
| `apps/web/app/(app)/interests/_components/volunteer-interests-view.tsx` | Create | Volunteer interest status list + submit form |
| `apps/web/app/(app)/interests/_components/interest-status-list.tsx` | Create | Per-interest row with status badge and withdraw control |
| `apps/web/app/(app)/interests/_components/submit-interest-form.tsx` | Create | Department picker + submit action |
| `apps/web/app/(app)/interests/_components/leader-interests-view.tsx` | Create | Dept_head review UI grouped by department |
| `apps/web/app/(app)/interests/_components/interest-request-card.tsx` | Create | Per-request row with approve/reject actions |
| `apps/web/app/(app)/interests/_components/super-admin-interests-view.tsx` | Create | Read-only oversight view for super_admin |
| `apps/web/app/(app)/app-nav.tsx` | Modify | Add Interests link for volunteer, dept_head, super_admin |
| `apps/web/lib/availability/queries.ts` | Modify | Add status/deleted_at filters to scope subqueries |
| `supabase/seed.sql` | Modify | RS-F006 interest request seed examples |
| `docs/tracking/progress.md` | Modify | Mark RS-F006 passed on completion |
| `docs/tracking/claude-progress.txt` | Modify | Session handoff update |
| `docs/features/feature-list.json` | Modify | RS-F006 passes: true on completion |

## Rollout / Migration / Access Impact

**Schema:** `volunteer_interests` is an existing table — this migration adds columns and changes the unique constraint. It is **not purely additive**:
- The hard `UNIQUE (volunteer_id, department_id)` constraint is dropped and replaced with a partial unique index. This is a DDL change and requires the table to be briefly locked during migration on production.
- The `replace_volunteer_interests()` RPC function is replaced in-place. Any onboarding session in flight during the migration cutover could encounter the new behavior (soft-delete instead of hard-delete). Risk is low given onboarding is a one-time user flow, but the migration should be applied in a low-traffic window.

**Existing data:** All pre-migration rows are auto-approved in the `UPDATE` step. No data is deleted. Volunteer and leader behavior before and after the migration is unchanged for existing approved interests.

**Auth / access:**
- One existing RLS policy updated (volunteer SELECT — adds `deleted_at IS NULL` filter)
- One existing RLS policy dropped (volunteer DELETE — replaced by UPDATE-for-soft-delete)
- Five new RLS policies added
- No new roles

**RS-F005 scope impact:** The `lib/availability/queries.ts` update adds `vi.status IN ('pending','approved') AND vi.deleted_at IS NULL` to the existing scope subqueries. This changes which volunteers appear in a leader's blockout view: volunteers with `rejected` or withdrawn interests are removed. Volunteers with `pending` interests remain visible. This is the correct intended behavior; any leader who had a rejected volunteer visible in RS-F005 will see them removed after this change.

**Downstream contracts:**
- RS-F008 (roster planning) will use `volunteer_interests WHERE status = 'approved'` as the confirmed membership signal for assignment eligibility. The new `status` column provides this filter without a schema change.

## Implementation Steps

1. Create `supabase/migrations/00008_interest_requests.sql`:
   - ADD columns `status`, `reviewed_by`, `reviewed_at`, `deleted_at` to `volunteer_interests`
   - Auto-approve existing rows: `UPDATE volunteer_interests SET status = 'approved' WHERE deleted_at IS NULL`
   - DROP the existing `UNIQUE (volunteer_id, department_id)` constraint
   - CREATE partial unique index `(volunteer_id, department_id) WHERE deleted_at IS NULL`
   - DROP the existing "Volunteers can delete own interests" DELETE policy
   - UPDATE the existing "Volunteers can read own interests" SELECT policy to add `AND deleted_at IS NULL`
   - Check if the existing "Super admins can read all interests" policy from 00005 conflicts; if so, DROP it and create a unified super_admin SELECT policy
   - CREATE OR REPLACE the `replace_volunteer_interests()` function to soft-delete (`UPDATE ... SET deleted_at = now()`) instead of hard-delete; preserve all other logic
   - CREATE five new RLS policies as described in the Approach section

2. Create `apps/web/lib/interests/types.ts`:
   - `InterestRequest` type (maps full DB row)
   - `InterestWithDepartment` type (for volunteer view: adds `department_name`, `event_title`)
   - `InterestWithVolunteer` type (for leader/admin view: adds `display_name`, `department_name`)
   - `DepartmentForInterestSubmit` type (`{ id, name, event_title }`)

3. Create `apps/web/lib/interests/queries.ts`:
   - `getMyInterests(userId)`: SELECT from `volunteer_interests` JOIN `departments` JOIN `events` WHERE `volunteer_id = userId AND deleted_at IS NULL`, ordered by `created_at DESC`
   - `getPendingInterestsForScope()`: SELECT from `volunteer_interests` JOIN `profiles` (display_name) JOIN `departments` WHERE `deleted_at IS NULL`; RLS restricts to dept_head scope automatically; ordered by `status ASC`, `created_at ASC`
   - `getAllInterests()`: SELECT from `volunteer_interests` JOIN `profiles` JOIN `departments` WHERE `deleted_at IS NULL`; RLS restricts to super_admin automatically; ordered by `departments.name ASC`, `profiles.display_name ASC`
   - `getDepartmentsAvailableToJoin(userId)`: SELECT `id, name, event_title` from active departments on published events WHERE no active interest exists for this user; uses `NOT IN (SELECT department_id FROM volunteer_interests WHERE volunteer_id = userId AND deleted_at IS NULL)`

4. Create `apps/web/lib/interests/actions.ts`:
   - `submitInterest(departmentId)`: verify caller role is `volunteer`; INSERT; on unique violation return `{ error: "You already have an active interest for this department" }`; return `{ success: true }` or `{ error: string }`
   - `withdrawInterest(interestId)`: fetch row; verify `volunteer_id = auth.uid()` and `status = 'pending'` and `deleted_at IS NULL`; UPDATE `deleted_at = now()`; return `{ success: true }` or `{ error: string }`
   - `approveInterest(interestId)`: fetch row; verify caller role is `dept_head`; verify interest is in a dept owned by caller; verify `deleted_at IS NULL`; UPDATE `status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()`; return `{ success: true }` or `{ error: string }`
   - `rejectInterest(interestId)`: same checks as approve; UPDATE `status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()`; return `{ success: true }` or `{ error: string }`

5. Create `apps/web/app/(app)/interests/_components/submit-interest-form.tsx`:
   - Client component; receives `DepartmentForInterestSubmit[]` as props
   - `<select>` (or radio list if ≤5 options) of available departments; displays department name and event title
   - `useActionState` with `submitInterest`
   - Submit button "Submit interest" with loading state ("Submitting…" / disabled)
   - Inline success message on success: "Your interest has been submitted."
   - Inline error on failure (e.g., duplicate interest)
   - If no departments available: show helper copy "You've already submitted interest in all available departments."

6. Create `apps/web/app/(app)/interests/_components/interest-status-list.tsx`:
   - Client component; receives `InterestWithDepartment[]` and `onWithdraw` callback (server action) as props
   - Renders each interest as a row: department name, event context, status badge, optional withdraw control
   - Status badge: pill with color and label — `pending` (warning/yellow), `approved` (success/green), `rejected` (error/red)
   - Withdraw control: only shown for `pending` rows; two-step inline confirmation — initial ghost "Withdraw" link → inline "Withdraw this request? Confirm / Cancel" state; on confirm calls `withdrawInterest`; loading state during action
   - Empty state: "You haven't submitted any interest requests yet."

7. Create `apps/web/app/(app)/interests/_components/volunteer-interests-view.tsx`:
   - Client component; receives `interests: InterestWithDepartment[]` and `availableDepartments: DepartmentForInterestSubmit[]` as props
   - Composes `<InterestStatusList>` (existing interests) and `<SubmitInterestForm>` (add new interest)
   - Page heading: "Your department interests"
   - Section label above list: "Current requests"
   - Section label above form: "Join a new department"

8. Create `apps/web/app/(app)/interests/_components/interest-request-card.tsx`:
   - Client component; receives one `InterestWithVolunteer` and `onApprove`/`onReject` server action callbacks
   - Renders: volunteer display name, department name (header), request date
   - Status badge (same styling as interest-status-list)
   - For `pending` rows: "Approve" primary button + "Reject" ghost button; reject requires inline confirmation ("Reject this request? Confirm / Cancel") before calling `rejectInterest`; approve has no pre-confirmation (low-risk action); both show per-button loading states
   - For `approved` / `rejected` rows: status badge only, no action buttons; show reviewer name and date if available

9. Create `apps/web/app/(app)/interests/_components/leader-interests-view.tsx`:
   - Server or client component; receives `InterestWithVolunteer[]` as props
   - Groups interests by department name
   - Renders each department as a section with its pending count as a sub-label: "Worship Team — 3 pending"
   - Each interest rendered as `<InterestRequestCard>`
   - Empty state if no interests in scope: "No volunteers have submitted interest requests for your departments yet."
   - Empty pending section: if all interests in a dept are reviewed, show "All requests reviewed" with a muted label

10. Create `apps/web/app/(app)/interests/_components/super-admin-interests-view.tsx`:
    - Server or client component; receives `InterestWithVolunteer[]` as props
    - Same grouped-by-department layout as leader view
    - Read-only: no approve/reject affordances
    - Status badge on each row
    - Empty state: "No interest requests found."

11. Create `apps/web/app/(app)/interests/page.tsx`:
    - Server component
    - `getSessionWithProfile()` → redirect `/sign-in` if no session
    - If `role === 'volunteer'`: call `getMyInterests(userId)` + `getDepartmentsAvailableToJoin(userId)`; render `<VolunteerInterestsView>`
    - If `role === 'dept_head'`: call `getPendingInterestsForScope()`; render `<LeaderInterestsView>`
    - If `role === 'super_admin'`: call `getAllInterests()`; render `<SuperAdminInterestsView>`
    - Else (sub_leader, unknown): `redirect('/dashboard')`

12. Modify `apps/web/app/(app)/app-nav.tsx`:
    - Add "Interests" link (`/interests`) rendered for `volunteer`, `dept_head`, and `super_admin` roles
    - Sub_leader does not receive the link in v1
    - Use same conditional render pattern as existing Events / Availability links

13. Modify `apps/web/lib/availability/queries.ts`:
    - In `getBlockoutsForScope()` and `getVolunteersInScope()`: add `AND vi.deleted_at IS NULL AND vi.status IN ('pending', 'approved')` to every subquery that joins through `volunteer_interests`
    - Verify the updated queries still compile and return the expected shape

14. Add RS-F006 seed examples to `supabase/seed.sql`:
    - Commented SQL showing: one pending interest, one approved interest, one rejected interest
    - Note for developers: "RS-F006 seed examples require RS-F003 department data and RS-F004 volunteer profiles to already exist in the local DB"

15. Run `npm run typecheck && npm run lint && npm run build` — all must pass

16. Update `docs/tracking/progress.md`, `docs/features/feature-list.json`, and `docs/tracking/claude-progress.txt`

## Acceptance Criteria Mapping

**Feature registry steps (from feature-list.json):**

| Registry Step | How It Is Met |
|---|---|
| Let volunteers submit interest requests for departments or sub-teams | Volunteers can submit new department interests post-onboarding from `/interests`; sub-team interest routing deferred to v1+ (documented as deliberate deferral) |
| Route each request to the appropriate reviewing leader | Each interest is associated with a `department_id`; the dept_head who owns that department sees the request in their `/interests` leader view via RLS scope |
| Reflect request outcomes back to the volunteer and relevant planning views | Volunteer sees live status badge (pending/approved/rejected) on their `/interests` page; rejected interests are excluded from leader availability scope in RS-F005 |

**PRD validation items (RS-F006):**

| PRD Item | Verification |
|---|---|
| Submit an interest request as a volunteer and confirm it is recorded with a pending status | Manual: submit new interest as volunteer; confirm row in DB has `status = 'pending'` |
| Review the request as the appropriate leader and change the status | Manual: sign in as dept_head who owns the department; see pending request; approve or reject; confirm DB row updated |
| Confirm the volunteer sees the updated outcome | Manual: volunteer refreshes `/interests`; status badge reflects approved or rejected |
| Unrelated leaders do not see the request | Manual: sign in as dept_head who does NOT own the department; request not visible |

**Additional validation checks:**
- Super_admin sees all active interests across all departments
- Sub_leader is redirected to `/dashboard` with no interests UI
- Volunteer cannot withdraw an approved or rejected interest (only pending)
- Volunteer can re-submit an interest after withdrawing it (partial unique index allows re-insert)
- Existing onboarding interests appear as `approved` after migration (auto-approve step)
- Volunteer with no submitted interests sees empty state
- Dept_head with no pending requests sees "All requests reviewed" state if department has reviewed-only interests
- RS-F005 availability scope: volunteer with rejected interest no longer appears in dept_head's blockout view; volunteer with pending interest still appears

## Style Guardrails For UI Work

**Surface:** Both volunteer and leader — one route, three distinct visual expressions (volunteer, leader, super_admin).

**Volunteer view — warm, personal:**
- Page background: `bg-surface-warm` (`#FFF8E8`) — consistent with onboarding and RS-F005 volunteer view
- Heading: `text-h2` DM Sans ("Your department interests") — management page, not a welcoming moment; no Space Grotesk
- Status badges: pill shape using semantic tokens — `semantic.warning` (pending), `semantic.success` (approved), `semantic.error` (rejected); include text label alongside color (not color-only, per accessibility rule)
- Withdraw control: two-step inline confirmation matching the RS-F005 remove blockout pattern — initial ghost "Withdraw" link; on click transitions inline to "Withdraw this request? Confirm / Cancel"; error/confirm button uses `semantic.error` only for confirm state
- Submit form: clean single-column, consistent with RS-F004/RS-F005 form style; `<select>` or radio list for department choice
- Empty state: warm copy ("You haven't submitted any interest requests yet — use the form below to join a department.")

**Leader view — calm, operational:**
- Page background: `bg-surface-cool` (`#F3F7FF`) — consistent with leader surfaces and RS-F005 leader view
- Heading: `text-h2` DM Sans, operational tone ("Department interest requests")
- Group headers: department name in `text-body-strong` with pending count sub-label in `text-body-sm color.neutral.600`
- Action buttons: "Approve" uses primary/filled style; "Reject" uses ghost style initially — reject confirmation uses `semantic.error` for the confirm step only
- Read-only reviewed rows: muted; no action affordances
- Reject confirmation: inline two-step same as volunteer withdraw pattern — no full modal needed

**Super_admin view — calm, oversight:**
- Page background: `bg-surface-cool` (`#F3F7FF`)
- Heading: `text-h2` DM Sans ("All department interests")
- Same grouped layout as leader view but no action buttons; status badge on every row
- Small muted label "Read-only" in page header to distinguish from leader view

**Shared layout:**
- Max content width consistent with other `(app)` pages
- Mobile-first single column; leader/admin grouped table expands from `1024px`
- Active/hover states must include non-color indicator (underline, border change) per accessibility rule

**States requiring fidelity:**
- Volunteer: submit form loading state (button disabled + "Submitting…")
- Volunteer: submit success (inline success message; form resets)
- Volunteer: duplicate-interest error (inline below form)
- Volunteer: withdraw loading state (per-row, inline)
- Leader: approve/reject per-button loading state
- Leader: reject inline confirmation state
- Leader: empty scope state (no volunteers have submitted for this dept)
- Leader: all-reviewed state within a department section

**Tone:**
- Volunteer copy: first-person, supportive ("You're all set in Worship Team", "Your request is pending review")
- Leader copy: operational, action-oriented ("3 pending requests", "Approve / Reject")
- Super_admin copy: neutral, informational ("Showing all active interest requests")

## Risks Or Blockers

1. **Migration DDL lock:** Dropping and replacing the unique constraint requires a brief table lock. In a production deployment this should be applied in a low-traffic window. For local dev, `npx supabase db reset` applies cleanly.

2. **RPC behavior change during cutover:** If a volunteer triggers the onboarding flow during the instant the migration is applied, the old RPC behavior (hard delete) may be active. Post-migration, the new RPC (soft-delete) takes over. Risk is minimal given onboarding is a one-time flow, but this is a real cutover-sensitive moment.

3. **RS-F005 scope change is live:** Updating `lib/availability/queries.ts` to filter by status changes which volunteers appear in the leader's blockout view. In a test environment with only auto-approved interests, this change is transparent. In production with real rejected interests, this narrowing of scope is intentional but visible.

4. **super_admin SELECT policy overlap:** The 00005 migration created a "Super admins can read all interests" policy. Migration 00008 must check whether this policy exists before creating a new one, or explicitly replace it to avoid duplicate policies.

5. **getDepartmentsAvailableToJoin subquery scope:** The `NOT IN` filter must use a subquery that correctly handles `deleted_at IS NULL`. If a volunteer previously withdrew an interest, that department should reappear as available. The partial unique index allows re-insert; the query must reflect this.

6. **sub_leader sees no Interests link:** If sub_leader navigates directly to `/interests`, they are redirected to `/dashboard`. This is correct but could be confusing if the nav shows the link. The nav must not show the Interests link for sub_leader.

## Validation Plan

### Automated checks
- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm run build` — passes
- `npx supabase db reset` — migration 00008 applies cleanly on top of 00007

### Manual checks
1. Sign in as volunteer → navigate to `/interests` → volunteer view (warm background, status list, submit form)
2. Submit a new interest → row appears with `pending` badge; DB row has `status = 'pending'`
3. Submit the same department again → inline error "You already have an active interest for this department"
4. Withdraw the pending interest → inline confirmation appears; confirm → row disappears from list; DB row has `deleted_at` set
5. Re-submit the same department → succeeds (partial unique index allows re-insert after soft-delete)
6. Sign in as dept_head who owns the department → `/interests` shows leader view (cool background); pending request is visible
7. Approve the request → button loading; row updates to `approved` badge; DB row has `status = 'approved'`, `reviewed_by` set
8. Sign in as volunteer → request now shows `approved` badge
9. Sign in as dept_head who does NOT own the department → request is not visible
10. Sign in as dept_head; reject a pending request → inline rejection confirmation appears; confirm → row updates to `rejected`; volunteer sees `rejected` badge
11. Sign in as volunteer; attempt to withdraw an approved interest → no withdraw control visible
12. Sign in as super_admin → `/interests` shows super_admin view (cool background); all interests across all departments; no approve/reject buttons
13. Sign in as sub_leader → redirected to `/dashboard`; no Interests nav link visible
14. Verify RS-F005 scope: sign in as dept_head; rejected volunteer no longer appears in `/availability` blockout view; pending volunteer still appears
15. Verify existing onboarding interests are `approved` after migration: check DB directly or via super_admin view

## Documentation Updates

On completion:
- `docs/tracking/progress.md` — RS-F006: `passed`
- `docs/features/feature-list.json` — RS-F006 `passes: true`
- `docs/tracking/claude-progress.txt` — full handoff update for next session
- This plan file — status updated to `Implemented and Validated`
