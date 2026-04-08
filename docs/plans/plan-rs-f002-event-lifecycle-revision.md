# Implementation Plan: RS-F002 — Event Lifecycle Revision

**Status:** Implemented and validated (passes=true) — 2026-04-08
**Feature:** RS-F002 Event lifecycle management
**Revision:** PRD v2 (2026-04-07) — expand event creation to all_depts_leader by default; add grant mechanism for dept_head / team_head
**Depends on:** RS-F001 (role hierarchy, six-role enum and TypeScript types — in place)

---

## Context and Baseline

RS-F002 was originally implemented against a four-role hierarchy where only `super_admin` could create events. The PRD v2 revision requires:

- `super_admin` and `all_depts_leader` can create and fully manage events by default
- `dept_head` and `team_head` can create and manage events only when explicitly granted access by `super_admin`
- The grant is a per-user boolean flag (`can_create_events`) stored on the `profiles` row

RS-F001 partially addressed this: the page gates at `/events` and `/events/new` were updated to use `hasMinimumRole(role, "all_depts_leader")`. What was deferred to RS-F002:

- Server actions still gate on `super_admin` — `all_depts_leader` is blocked at the action layer
- RLS INSERT/UPDATE still only covers `super_admin`
- `all_depts_leader` has no events SELECT policy — they see zero events at the DB layer
- No grant column, grant actions, or grant management UI exists

---

## Scope

### In Scope

- Add `can_create_events boolean NOT NULL DEFAULT false` column to `profiles`
- Add `all_depts_leader` events SELECT policy
- Expand events INSERT and UPDATE RLS policies to cover `all_depts_leader` by default and granted `dept_head` / `team_head`
- Update all four server actions (`createEvent`, `updateEvent`, `transitionEventStatus`, `softDeleteEvent`) to use a centralized `canManageEvents` check
- Add `canManageEvents(profile)` helper in `lib/auth/roles.ts`
- Add `can_create_events: boolean` to the `Profile` type
- Grant management: new server actions (`grantEventCreation`, `revokeEventCreation`) and a Super Admin-only page at `/events/grants`
- Update `events/page.tsx` `canCreateEvent` and `events/new/page.tsx` gate to use `canManageEvents`
- Update `events/[id]/edit/page.tsx` gate

### Not In Scope

- Event visibility scoping to only events containing the user's owned departments/teams — that was scoped to RS-F003 as a planned refinement and remains there
- Volunteer-facing event access (RS-F010)
- Soft-delete cascade to downstream records (RS-F014)

---

## Database Migration

**File:** `supabase/migrations/00021_event_creation_grant.sql`

### Step 1 — Add `can_create_events` to profiles

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_create_events boolean NOT NULL DEFAULT false;
```

No index needed — this is a rare write column used in point lookups, not range scans.

### Step 2 — Add `all_depts_leader` events SELECT policy

`all_depts_leader` currently has no SELECT policy on `events` and sees zero events at the DB layer.

Intended read scope: all active events (not soft-deleted). This is broader than `dept_head`, whose visibility was scoped to events containing departments they own (`00016_fix_events_dept_head_policy.sql`). `all_depts_leader` is a cross-department role with full active-event visibility — no ownership constraint applies.

```sql
CREATE POLICY "All depts leaders can read active events"
  ON public.events FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );
```

### Step 3 — Expand events INSERT policy

Drop the existing super_admin-only INSERT policy and recreate it to cover:
- `super_admin` — always
- `all_depts_leader` — always
- `dept_head` / `team_head` — when `can_create_events = true`

```sql
DROP POLICY IF EXISTS "Super admins can create events" ON public.events;

CREATE POLICY "Authorized users can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.get_my_role() IN ('super_admin', 'all_depts_leader')
      OR (
        public.get_my_role() IN ('dept_head', 'team_head')
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND can_create_events = true AND deleted_at IS NULL
        )
      )
    )
  );
```

### Step 4 — Expand events UPDATE policy

Drop the existing super_admin-only UPDATE policy and recreate it:
- `super_admin` / `all_depts_leader` — can update any active event
- `dept_head` / `team_head` with grant — can only update events they created (`created_by = auth.uid()`)

```sql
DROP POLICY IF EXISTS "Super admins can update active events" ON public.events;

CREATE POLICY "Authorized users can update active events"
  ON public.events FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      public.get_my_role() IN ('super_admin', 'all_depts_leader')
      OR (
        public.get_my_role() IN ('dept_head', 'team_head')
        AND created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND can_create_events = true AND deleted_at IS NULL
        )
      )
    )
  )
  WITH CHECK (
    public.get_my_role() IN ('super_admin', 'all_depts_leader')
    OR (
      public.get_my_role() IN ('dept_head', 'team_head')
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND can_create_events = true AND deleted_at IS NULL
      )
    )
  );
```

---

## TypeScript Changes

### `apps/web/lib/auth/types.ts`

Add `can_create_events: boolean` to the `Profile` type. This flows through `getSessionWithProfile()` automatically since the profile is fetched with `select("*")`.

```typescript
export type Profile = {
  // ... existing fields ...
  supporter_of: string | null;
  can_create_events: boolean;
};
```

### `apps/web/lib/auth/roles.ts`

Add two helpers. Both accept `Profile` (not just role) because the check requires `can_create_events`.

**`canManageEvents(profile)`** — entry-level gate used by list/new pages and action layer:

```typescript
export function canManageEvents(profile: Profile): boolean {
  if (hasMinimumRole(profile.role, "all_depts_leader")) return true;
  if (
    (profile.role === "dept_head" || profile.role === "team_head") &&
    profile.can_create_events
  ) return true;
  return false;
}
```

**`canManageThisEvent(profile, event)`** — ownership-aware gate used by the detail page and edit page to decide whether action controls (edit link, transition buttons, delete) are shown:

```typescript
export function canManageThisEvent(
  profile: Profile,
  event: { created_by: string }
): boolean {
  if (hasMinimumRole(profile.role, "all_depts_leader")) return true;
  if (
    (profile.role === "dept_head" || profile.role === "team_head") &&
    profile.can_create_events &&
    event.created_by === profile.id
  ) return true;
  return false;
}
```

`super_admin` and `all_depts_leader` can manage any event. Granted `dept_head` / `team_head` can only manage events they created — this mirrors the RLS UPDATE `created_by = auth.uid()` constraint.

---

## Server Actions

### `apps/web/lib/events/actions.ts`

Replace the `hasMinimumRole(role, "super_admin")` check in all four actions with `canManageEvents(session.profile)`. This is the entry-level check — does this user have any event management capability? The ownership constraint (for granted dept_head/team_head on their own events) is enforced by the RLS UPDATE `created_by = auth.uid()` clause, so no additional ownership check is needed in the action layer.

```typescript
// Before (all four actions):
if (!session || !hasMinimumRole(session.profile.role, "super_admin")) {
  return { error: "You do not have permission to ..." };
}

// After:
if (!session || !canManageEvents(session.profile)) {
  return { error: "You do not have permission to ..." };
}
```

### New grant actions (inline in `apps/web/lib/events/grants.ts`)

```typescript
export async function grantEventCreation(userId: string): Promise<{ error?: string }>;
export async function revokeEventCreation(userId: string): Promise<{ error?: string }>;
```

Both check `super_admin` before executing. Both validate the target user is `dept_head` or `team_head` (not other roles). Return `{ error }` on failure, `{}` on success.

---

## UI Pages

### `apps/web/app/(app)/events/page.tsx`

Replace `hasMinimumRole(session.profile.role, "all_depts_leader")` with `canManageEvents(session.profile)` for `canCreateEvent`.

Add a "Manage grants" link visible only to `super_admin`:

```tsx
{session.profile.role === "super_admin" && (
  <Link href="/events/grants" className="...text-body-sm text-brand-calm-600...">
    Manage grants
  </Link>
)}
```

### `apps/web/app/(app)/events/new/page.tsx`

Replace `hasMinimumRole(session.profile.role, "all_depts_leader")` gate with `canManageEvents(session.profile)`.

### `apps/web/app/(app)/events/[id]/page.tsx`

Currently computes `isSuperAdmin = hasMinimumRole(role, "super_admin")` and passes it to both `EventDetailCard` and `DepartmentListSection`.

Change to:
- Keep `isSuperAdmin` for `DepartmentListSection` (department management is RS-F003 scope)
- Compute `canManageEvent = canManageThisEvent(session.profile, event)` and pass as `canManage` to `EventDetailCard`

```tsx
const isSuperAdmin = session.profile.role === "super_admin";
const canManageEvent = canManageThisEvent(session.profile, event);
// ...
<EventDetailCard event={event} canManage={canManageEvent} />
<DepartmentListSection ... isSuperAdmin={isSuperAdmin} />
```

### `apps/web/app/(app)/events/_components/event-detail-card.tsx`

Currently accepts `isSuperAdmin: boolean` and uses it to gate `canEdit` and the action buttons section. Rename the prop to `canManage: boolean`.

```tsx
// Before:
export function EventDetailCard({ event, isSuperAdmin }: { event: Event; isSuperAdmin: boolean })
const canEdit = isSuperAdmin && event.status !== "completed";
{isSuperAdmin && (<div ...>{/* transition + delete buttons */}</div>)}

// After:
export function EventDetailCard({ event, canManage }: { event: Event; canManage: boolean })
const canEdit = canManage && event.status !== "completed";
{canManage && (<div ...>{/* transition + delete buttons */}</div>)}
```

This is the complete detail-surface management UX fix. No logic changes — only the prop name and its source changes.

### `apps/web/app/(app)/events/[id]/edit/page.tsx`

The current file already uses `notFound()` when the event cannot be loaded — no change needed there. The gate is `hasMinimumRole(role, "super_admin")`. Replace with a two-step check:

1. Entry check: `canManageEvents(session.profile)` — if false, redirect to `/events/${id}`
2. Ownership check after loading the event: `canManageThisEvent(session.profile, event)` — if false, redirect to `/events/${id}`

```tsx
if (!canManageEvents(session.profile)) redirect(`/events/${id}`);
const event = await getEventById(id);
if (!event) notFound();
if (event.status === "completed") redirect(`/events/${id}`);
if (!canManageThisEvent(session.profile, event)) redirect(`/events/${id}`);
```

Note: `getEventById` uses `notFound()` pattern already on null — no ambiguity between "missing" and "RLS-blocked" is introduced here. A dept_head who doesn't own the event will get null from `getEventById` (RLS blocks the SELECT), landing on `notFound()`. The ownership check above acts as a friendlier short-circuit before the query for the case where the user has grant but the event belongs to someone else — but since `getEventById` also naturally returns null via RLS, `notFound()` is the safe fallback in all cases.

### New: `apps/web/app/(app)/events/grants/page.tsx`

Super Admin-only page. Fetches all `dept_head` and `team_head` profiles (display_name, email, role, can_create_events). Renders a `GrantList` component.

Profile reads for `super_admin` are already covered by the "Super admins can read all profiles" policy (`00010_fix_profiles_rls_recursion.sql`, uses `get_my_role() = 'super_admin'`) — no additional RLS policy needed for this query.

```tsx
// Page gate:
if (session.profile.role !== "super_admin") redirect("/events");
```

### New: `apps/web/app/(app)/events/grants/_components/grant-list.tsx`

Client component. Renders a table of dept_head / team_head users. Each row has a toggle button ("Grant" / "Revoke") that calls the appropriate server action. Uses `useActionState` or `useTransition` for pending state.

Design: same table density as `event-list-table.tsx`. No new component patterns.

---

## New Files

| Path | Purpose |
|------|---------|
| `supabase/migrations/00021_event_creation_grant.sql` | `can_create_events` column, new event SELECT/INSERT/UPDATE policies |
| `apps/web/lib/events/grants.ts` | `grantEventCreation`, `revokeEventCreation` actions + `getGrantableUsers` query |
| `apps/web/app/(app)/events/grants/page.tsx` | Super Admin grant management page |
| `apps/web/app/(app)/events/grants/_components/grant-list.tsx` | Grant toggle table |

## Modified Files

| Path | Change |
|------|--------|
| `apps/web/lib/auth/types.ts` | Add `can_create_events: boolean` to `Profile` |
| `apps/web/lib/auth/roles.ts` | Add `canManageEvents(profile)` + `canManageThisEvent(profile, event)` helpers |
| `apps/web/lib/events/actions.ts` | Swap `super_admin` checks → `canManageEvents` in all 4 actions |
| `apps/web/app/(app)/events/page.tsx` | Use `canManageEvents`; add "Manage grants" link for super_admin |
| `apps/web/app/(app)/events/new/page.tsx` | Use `canManageEvents` for gate |
| `apps/web/app/(app)/events/[id]/page.tsx` | Compute `canManageThisEvent`; pass `canManage` to `EventDetailCard` |
| `apps/web/app/(app)/events/_components/event-detail-card.tsx` | Rename `isSuperAdmin` prop to `canManage` |
| `apps/web/app/(app)/events/[id]/edit/page.tsx` | Two-step gate: `canManageEvents` then `canManageThisEvent` |

---

## Authorization Matrix

| Action | super_admin | all_depts_leader | dept_head (no grant) | dept_head (granted) | team_head (granted) |
|--------|-------------|-----------------|----------------------|---------------------|---------------------|
| Read events list | ✓ (all incl. deleted) | ✓ (active) | ✓ (owned depts only) | ✓ | ✓ |
| Create event | ✓ | ✓ | ✗ | ✓ | ✓ |
| Edit any event | ✓ | ✓ | ✗ | own only | own only |
| Transition status | ✓ | ✓ | ✗ | own only | own only |
| Soft-delete event | ✓ | ✓ | ✗ | own only | own only |
| Grant/revoke access | ✓ | ✗ | ✗ | ✗ | ✗ |

---

## Validation Checks

| # | Check | Method |
|---|---|---|
| 1 | `npm run typecheck` passes | CLI |
| 2 | `npm run lint` passes | CLI |
| 3 | `npm run build` passes | CLI |
| 4 | `npx supabase db reset` applies all 21 migrations cleanly | CLI |
| 5 | Create an event as `super_admin` — succeeds, appears in list | Browser |
| 6 | Create an event as `all_depts_leader` — succeeds, appears in list | Browser |
| 7 | Navigate to `/events` as `dept_head` (no grant) — no "Create event" CTA | Browser |
| 8 | Navigate to `/events/new` as `dept_head` (no grant) — redirects to `/events` | Browser |
| 9 | As `super_admin`, navigate to `/events/grants`, grant access to `dept_head` | Browser |
| 10 | After grant: `dept_head` sees "Create event" CTA and can create an event | Browser |
| 11 | `dept_head` with grant can edit their own event, but not one created by super_admin | Browser |
| 12 | Revoke grant for `dept_head` — Create CTA disappears, `/events/new` blocks again | Browser |
| 13 | Move an event through each status; invalid transitions rejected | Browser |
| 14 | `can_create_events = false` by default for new profiles (`db reset` + inspect) | SQL |
| 15 | `all_depts_leader` can see all active events in the list (not just owned-dept ones) | Browser |
| 16 | `dept_head` with grant: edit link and action buttons appear on events they created; absent on events created by others | Browser |

---

## Risks

1. **`canManageEvents` import path**: Both helpers accept a `Profile` from `lib/auth/types.ts`. The actions file imports `Profile` indirectly via `getSessionWithProfile`. Confirm no circular import before writing code.
2. **Stale session after grant**: If `super_admin` grants a dept_head access in one browser tab, the dept_head's session profile is cached and won't reflect the grant until they re-authenticate or the session refreshes. Acceptable for v1 — no in-session grant notification required.
3. **Edit page null vs RLS-blocked ambiguity**: `getEventById` returns `null` for both "event does not exist" and "event exists but RLS blocks the read." Both land on `notFound()`, which is safe. The ownership pre-check (`canManageThisEvent`) gives a friendlier redirect path before the DB query for the case where the user has grant but the event belongs to someone else — but `notFound()` is always the correct fallback.
4. **`DepartmentListSection` isSuperAdmin**: This prop is kept as `super_admin`-only for RS-F002. Department management control expansion is RS-F003 scope — do not bleed RS-F003 work into this revision.

---

## Implementation Outcome (2026-04-08)

**PRs merged:** #20 (implementation), #21 (validation fixes)
**Migrations delivered:** 00021, 00022, 00023
**All 16 validation checks passed.**

### Deviations from plan

**Migration 00022 — not in original plan:**
The plan added `can_create_events` to profiles and wrote the grant actions but did not include an UPDATE policy on `profiles` for `super_admin`. Without it, `grantEventCreation` / `revokeEventCreation` silently wrote 0 rows (Supabase returns no error for a 0-row UPDATE). Discovered and fixed during browser validation (Check 9).

**Migration 00023 — not in original plan:**
The plan described the dept_head / team_head authorization matrix as full active-event read once granted, but did not add the corresponding SELECT policy. The `createEvent` action chains `.select("id").single()` after INSERT; a newly created event has no departments, so the dept_head's existing SELECT policy (scoped to events with owned departments) blocked the read-back. Discovered and fixed during browser validation (Check 10).

**EventDetailCard dialog crash — not in plan:**
The plan did not specify the imperative dispatch pattern. The implementation called `transitionAction(fd)` and `deleteAction(fd)` outside `startTransition`, then immediately closed the modal, causing a React `removeChild` null crash on reconciliation. Fixed in PR #21 by wrapping dispatches in `startTransition()` and removing the premature modal-close calls.

### Migration / rollout status
- Local: all 23 migrations applied cleanly via `npx supabase db reset`
- Remote (production): not yet applied — must run `npx supabase db push` against the linked remote project before deploying
- Migrations 00022 and 00023 are required for the grant mechanism and event creation to function correctly in production
