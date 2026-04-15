# Plan: Phase 2 — Production Readiness & UX Hardening

Status: Approved
Type: Post-v1 production-hardening exception (see Governing-Doc Alignment below)
Source PRD: docs/prd/prd.md
Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

---

## Governing-Doc Alignment

`docs/plans/README.md` permits only feature-driven plans plus a single scaffolding exception. This plan is a **post-v1 production-hardening exception**. It is valid only if the user grants an explicit exception before any implementation begins. No code will be written until that approval is recorded here.

This plan covers six phases that address bugs found during the full Playwright UI review and three parallel security/GDPR/production-readiness audits conducted in April 2026. The work does not introduce new user-facing features; it corrects routing defects, accessibility gaps, security misconfigurations, and compliance obligations required before the app is deployed to organisations outside the development environment.

---

## Objective

Bring the live production app (`rosterserve.vercel.app`) to a state that:

1. Gives every role a correct, navigable experience with no dead-end nav links.
2. Works on mobile without nav overflow.
3. Closes the most critical security gaps (storage RLS, action-level ownership).
4. Meets the minimum GDPR obligations required before sharing the app with Red Cross / Red Crescent or similar organisations.
5. Fails loudly in a misconfigured deployment rather than silently.

---

## Scope And Non-Goals

**In scope:**
- Fix supporter/all-depts-leader nav-routing mismatches
- Add mobile hamburger navigation
- Dashboard greeting polish (role subtitle, contextual empty states)
- Tighten `instruction-media` storage RLS beyond "any authenticated user"
- Add ownership guard on membership mutations in `memberships/actions.ts`
- Consolidate env-var validation into a single entry point (middleware)
- Minimal privacy notice page + signup link
- Account deletion flow (soft-delete + admin review queue) and data-export action
- Vercel-native error observability and structured startup failure for missing env vars
- Ops guide for deploying a new org instance

**Not in scope:**
- New features from the feature list (RS-F008 onwards)
- Full legal GDPR audit or DPA template drafting
- Automated test suite
- Performance optimisation

---

## Applied Decisions

The following decisions from the plan review are locked in before implementation:

| # | Decision | Answer |
|---|----------|--------|
| 1 | Should Supporter see Interests (self-join)? | **No — hide Interests from Supporter nav.** Supporter is leader-assigned per vision. |
| 2 | "Assignments" vs "Service requests"? | **"Service requests" everywhere.** Matches the vision/PRD request-to-serve language. |
| 3 | Privacy policy — existing or new? | **New minimal privacy notice.** No canonical privacy doc exists in `docs/`. |
| 4 | Error tracking — Sentry or Vercel-native? | **Vercel-native observability.** Simpler default given current Vercel deployment. |

---

## Phase 2-A — Nav & Routing Fixes

**Branch:** `fix/rs-nav-routing`
**Risk:** Low — nav and page-level changes only, no DB

### Files To Create Or Modify

| File | Change |
|------|--------|
| `apps/web/app/(app)/app-nav.tsx` | Hide `Interests` from `supporter` (add `role !== "supporter"` to condition) |
| `apps/web/app/(app)/availability/page.tsx` | Add `supporter` case using the `VolunteerAvailabilityView` path |
| `apps/web/app/(app)/skills/page.tsx` | Add `supporter` case using the `VolunteerSkillsView` path |
| `apps/web/app/(app)/interests/page.tsx` | Add `all_depts_leader` case using `SuperAdminInterestsView` |
| `apps/web/app/(app)/availability/_components/leader-availability-view.tsx` | Change "in your departments" → "in your teams" when role is `team_head` |
| `apps/web/app/(app)/app-nav.tsx` | Rename "Assignments" label → "Service requests" for `team_head` and `supporter` |
| `apps/web/app/(app)/assignments/page.tsx` | Confirm page title already reads "Service requests"; make consistent |
| `apps/web/app/(app)/departments/page.tsx` | Improve empty state for `dept_head` with guidance to contact Super Admin |

### Rollout / Migration / Access Impact

None — no schema, auth, storage, or infrastructure changes.

### Implementation Steps

1. In `app-nav.tsx`, change the `Interests` `show` condition from `role !== "team_head"` to `role !== "team_head" && role !== "supporter"`.
2. In `availability/page.tsx`, add a `profile.role === "supporter"` branch before the final redirect that renders `VolunteerAvailabilityView` with the supporter's own blockouts and preferences.
3. In `skills/page.tsx`, add a `profile.role === "supporter"` branch that renders `VolunteerSkillsView` with the supporter's own claims and catalog skills.
4. In `interests/page.tsx`, add a `profile.role === "all_depts_leader"` branch that calls `getAllInterests()` and renders `SuperAdminInterestsView` (same data, same view as `super_admin`).
5. In `leader-availability-view.tsx`, thread the `role` prop through the page and swap the subtitle to "Showing blockout dates for volunteers in your teams." when `role === "team_head"`.
6. In `app-nav.tsx`, change the "Assignments" label to "Service requests" (it applies to `team_head` and `supporter`).
7. In the departments page empty-state copy for `dept_head`, replace "No departments yet." with "You have not been assigned to any department. Contact a Super Admin to set this up."

### Acceptance Criteria

- [ ] Supporter can navigate to `/availability` and see their own blockout-date view without redirect
- [ ] Supporter can navigate to `/skills` and see/claim their own skills without redirect
- [ ] Supporter nav shows: Dashboard, Service requests, Availability, Skills (no Interests)
- [ ] All Depts Leader can navigate to `/interests` without redirect; sees all pending requests
- [ ] Team Head `/availability` subtitle reads "in your teams"
- [ ] Nav label reads "Service requests" for `team_head` and `supporter` everywhere
- [ ] Dept Head `/departments` empty state includes actionable guidance text

### Style Guardrails

- Copy tone: calm, directive, not alarming. "Contact a Super Admin" not "You have been denied access."
- Empty states: use the existing `rounded-200 border border-neutral-200` card pattern with centred text.
- No new component abstractions — reuse existing views directly.

---

## Phase 2-B — Mobile Navigation

**Branch:** `fix/rs-mobile-nav`
**Dependency:** Must follow 2-A (both touch `app-nav.tsx`; they cannot be safely parallelised)
**Risk:** Low — layout/CSS change only

### Files To Create Or Modify

| File | Change |
|------|--------|
| `apps/web/app/(app)/app-nav.tsx` | Add `useState` open/close toggle; render nav links in a drawer at `< md` |
| `apps/web/app/(app)/layout.tsx` | Add hamburger icon button in the header at `< md`; hide it at `>= md` |

### Rollout / Migration / Access Impact

None.

### Implementation Steps

1. In `layout.tsx`, add a `"use client"` wrapper or extract the header into a `AppHeader` client component. Add a hamburger icon (inline SVG or `lucide-react` `Menu` icon) that is visible only below `md` breakpoint (`md:hidden`). Pass an `open` / `setOpen` state to both the button and `AppNav`.
2. In `app-nav.tsx`, accept an `open` prop. On `md+`, render the existing horizontal flex list. Below `md`, render an overlay drawer (`fixed inset-0 z-50 bg-neutral-0 flex flex-col gap-200 p-400`) that is conditionally visible when `open`. Include all nav links and a "Sign out" button inside the drawer.
3. Close the drawer on any link click (wrap each `<Link>` with `onClick={() => setOpen(false)}`).
4. Test at 390px (iPhone 14), 768px (tablet edge), and 1280px (desktop) — nav must not overflow at any width.

### Acceptance Criteria

- [ ] At 390px no nav links are cut off or overflowing
- [ ] Hamburger icon visible at 390px, hidden at 1280px
- [ ] Tapping a nav link closes the drawer and navigates correctly
- [ ] Sign out is accessible from within the mobile drawer
- [ ] Desktop nav is unaffected

### Style Guardrails

- Drawer background: `bg-neutral-0`, consistent with page surface.
- Nav links in drawer: same text style as desktop (`text-body-sm`), left-aligned, with adequate tap targets (`py-300` minimum).
- Hamburger: use `text-neutral-950` to match the logo weight. No animated transforms needed.

---

## Phase 2-C — Dashboard UX Polish

**Branch:** `fix/rs-dashboard-polish`
**Risk:** Low — display-only changes

### Files To Create Or Modify

| File | Change |
|------|--------|
| `apps/web/app/(app)/dashboard/_components/all-depts-leader-dashboard.tsx` | Add role subtitle "All departments leader" below greeting |
| `apps/web/app/(app)/dashboard/_components/dept-head-dashboard.tsx` | Add role subtitle "Department head" |
| `apps/web/app/(app)/dashboard/_components/team-head-dashboard.tsx` | Add role subtitle "Team head" |
| `apps/web/app/(app)/dashboard/_components/supporter-dashboard.tsx` | Add role subtitle; style "no leader assigned" warning as a callout card |
| `apps/web/app/(app)/dashboard/_components/volunteer-dashboard.tsx` | Add role subtitle "Volunteer" for consistency |

### Rollout / Migration / Access Impact

None.

### Implementation Steps

1. In each leader/supporter/volunteer dashboard component, add `<p className="mt-50 text-body-sm text-neutral-600">{roleLabel}</p>` directly below the `<h1>` greeting — matching the existing Super Admin pattern.
2. In `supporter-dashboard.tsx`, replace the inline `<p>` "No leader assigned yet..." plain text with a styled callout card (`rounded-200 border border-semantic-warning/30 bg-semantic-warning/5 px-300 py-250`) so the message is visually prominent.
3. For each leader dashboard, add at least one contextual quick-action link below the greeting block. Use the existing `rounded-200 border border-neutral-300` button style:
   - Dept Head: "View departments" → `/departments`
   - Team Head: "View service requests" → `/assignments`
   - All Depts Leader: "View events" → `/events`

### Acceptance Criteria

- [ ] Every role dashboard shows a role subtitle below the greeting
- [ ] Supporter "no leader assigned" state renders as a callout card, not plain grey text
- [ ] Each leader dashboard has at least one quick-action link
- [ ] All greeting+subtitle patterns are visually consistent across roles

### Style Guardrails

- Role subtitle: `text-body-sm text-neutral-600` — same as Super Admin.
- Callout card: warning tint, not red; use `semantic-warning` token, not destructive colours.
- Quick actions: reuse the existing `rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-150 text-body-sm font-semibold` pattern from `super-admin-dashboard.tsx`.

---

## Phase 2-D — Security Fixes

**Branch:** `fix/rs-security`
**Risk:** Medium — Supabase storage migration + action-level auth change

### Files To Create Or Modify

| File | Change |
|------|--------|
| `supabase/migrations/00034_tighten_storage_rls.sql` (new) | Replace permissive `auth_upload/read/delete` storage policies with role-scoped policies on `instruction-media` |
| `apps/web/lib/memberships/actions.ts` | Add scope check to `placeInTeam` and `removeMembership`: confirm the membership row belongs to a department the calling leader owns |
| `apps/web/middleware.ts` | Replace inline env check (`if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next()`) with call to `getPublicEnv()` from `lib/env.ts` so missing vars produce a hard failure instead of silently continuing |

### Rollout / Migration / Access Impact

- **Storage migration** — Supabase migration applied to production. Signed-URL reads continue to work because they are scoped by time and object path. The new policies restrict direct `SELECT` on `storage.objects` to leaders and members of the relevant department, and restrict `INSERT`/`DELETE` to leaders only.
- **Middleware change** — If env vars are missing in any deployment, requests will 500 immediately rather than reaching auth in a broken state. Test in staging before deploying.
- **Membership action change** — No user-visible change for legitimate callers. Malformed requests that currently pass will now return `{ error: "Unauthorized" }`.

### Implementation Steps

1. Create `supabase/migrations/00034_tighten_storage_rls.sql`. Drop the three existing permissive policies (`auth_upload_instruction_media`, `auth_read_instruction_media`, `auth_delete_instruction_media`) and replace with:
   - **SELECT (leaders)**: `public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')` AND `bucket_id = 'instruction-media'`.
   - **SELECT (volunteers/supporters)**: `public.get_my_role() IN ('volunteer', 'supporter')` AND `bucket_id = 'instruction-media'` AND `EXISTS (SELECT 1 FROM public.event_instructions ei JOIN public.assignments a ON a.event_id = ei.event_id AND a.department_id = ei.department_id WHERE ei.attachment_path = storage.objects.name AND a.volunteer_id = auth.uid() AND a.status != 'declined' AND a.deleted_at IS NULL AND ei.deleted_at IS NULL)`. Join uses `ei.attachment_path = storage.objects.name` directly — no string-split expression.
   - **INSERT**: `public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')` AND `bucket_id = 'instruction-media'`.
   - **DELETE**: `public.get_my_role() IN ('super_admin', 'all_depts_leader', 'dept_head', 'team_head')` AND `bucket_id = 'instruction-media'`.
2. In `memberships/actions.ts`, in `placeInTeam` and `removeMembership`, after the role check, for `dept_head` callers: run a **single query** joining `department_members` and `departments` — `SELECT dm.id FROM department_members dm JOIN departments d ON d.id = dm.department_id WHERE dm.id = memberId AND d.owner_id = auth.uid() AND d.deleted_at IS NULL`. If no row returned, return `{ error: "Unauthorized" }`. `super_admin` and `all_depts_leader` bypass this check via the existing `hasMinimumRole` guard. Single query avoids two round trips and eliminates TOCTOU exposure.
3. In `middleware.ts`, replace the inline `if (!supabaseUrl || !supabaseAnonKey) { return NextResponse.next({ request }) }` block with `import { getPublicEnv } from "@/lib/env"` and a `try/catch` that calls `getPublicEnv()`. On error, return `new Response("Server misconfiguration: missing required environment variables.", { status: 500 })` — use `new Response(...)` directly, not `NextResponse.next()` or `NextResponse.json()`, so the error is never silently swallowed.

### Acceptance Criteria

- [ ] Storage migration applies cleanly on production Supabase
- [ ] A volunteer without a department membership cannot generate a signed URL for an instruction attachment (test by calling `createSignedUrl` via the Storage API as an unrelated authenticated user — the SELECT RLS fires at URL generation time, not URL consumption time)
- [ ] A `dept_head` calling `placeInTeam` with a `memberId` from a department they do not own receives an Unauthorized error
- [ ] Deploying to a Vercel preview with `NEXT_PUBLIC_SUPABASE_URL` unset returns a 500 with a clear error message

---

## Phase 2-E — GDPR Foundations

**Branch:** `feat/rs-gdpr-foundations`
**Risk:** Medium — new pages, new server actions, touches auth/profile data

> **Scope note:** This phase establishes the minimum structural GDPR footprint. It does not constitute full GDPR legal compliance. The privacy notice is a minimal notice; a legally reviewed policy document should be commissioned separately before any regulated deployment.

### Files To Create Or Modify

| File | Change |
|------|--------|
| `apps/web/app/(app)/settings/account/page.tsx` (new) | Account settings page with "Download my data" and "Delete my account" buttons |
| `apps/web/lib/actions/account.ts` (new) | `exportMyData` and `requestAccountDeletion` server actions |
| `apps/web/app/(public)/privacy/page.tsx` (new) | Minimal privacy notice page |
| `apps/web/app/(auth)/sign-up/` | Add "By creating an account you agree to our Privacy Notice" + link before the sign-in button |
| `apps/web/app/(app)/app-nav.tsx` | Add "Account" nav item for all roles linking to `/settings/account` |
| `supabase/migrations/00035_account_deletion_request.sql` (new) | `account_deletion_requests` table: `user_id`, `requested_at`, `reviewed_at`, `reviewed_by`, `status` |

### Rollout / Migration / Access Impact

- New table `account_deletion_requests` — migration required; no existing data affected.
- `requestAccountDeletion` soft-deletes the profile (`deleted_at = now()`) and inserts a row into `account_deletion_requests`. Hard-delete is performed only by `super_admin` through the existing Admin Oversight panel (RS-F014), which already has a pending-deletion queue.
- `exportMyData` assembles profile, assignments, skills, and interests rows into a JSON blob and returns it as a file download. No new RLS required — queries use existing per-user RLS.

### Implementation Steps

1. Create migration `00035_account_deletion_request.sql` with the `account_deletion_requests` table:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
   - `requested_at timestamptz NOT NULL DEFAULT now()`
   - `reviewed_at timestamptz`
   - `reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL`
   - `status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected'))`
   - RLS: owner can INSERT; `super_admin` can SELECT/UPDATE via `get_my_role()`.
2. Create `apps/web/app/api/export/my-data/route.ts` (Route Handler inside the `app/` directory, not a server action):
   - `GET` handler verifies session via `getSessionWithProfile()`. Returns 401 if not authenticated.
   - Queries `profiles`, `assignments`, `skill_claims`, `interest_requests` for `auth.uid()` using existing per-user RLS (no service role needed).
   - Returns `new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="my-rosterserve-data.json"' }})`.
   - The "Download my data" button in the Account page is a plain `<a href="/api/export/my-data" download>` link.
3. Create `apps/web/lib/actions/account.ts`:
   - `requestAccountDeletion()` server action — sets `profiles.deleted_at = now()` for the calling user, inserts into `account_deletion_requests`. `await supabase.auth.signOut()` (must be awaited before redirect). Then call `redirect('/sign-in')` outside any try/catch block (redirect throws internally).
   - `approveAccountDeletion(userId)` server action (super_admin only) — hard-deletes the profile row, then calls `createSupabaseAdminClient().auth.admin.deleteUser(userId)` to remove the auth record. If adminClient is null (service key not set), return `{ error: "Service role key not configured" }` rather than silently failing.
4. Create `apps/web/app/(app)/settings/account/page.tsx` with two sections:
   - "Download my data" — plain `<a href="/api/export/my-data" download>` styled as a secondary button.
   - "Delete my account" — client component with inline text confirmation ("Type DELETE to confirm", no modal). Calls `requestAccountDeletion()` on submit.
5. Create `apps/web/app/(public)/privacy/page.tsx` — new `(public)` route group, no auth required. Static prose page.
6. In the sign-up flow, add privacy consent line between submit button and "Already have an account?" paragraph.
7. Add `{ label: "Account", href: "/settings/account", show: true }` to `app-nav.tsx` navItems.
8. Add `getAccountDeletionRequests()` as 4th entry in the admin page `Promise.all`. Render a new `AccountDeletionRequestsSection` below existing sections. Approve calls `approveAccountDeletion(userId)`; reject calls an `updateDeletionRequestStatus(id, 'rejected')` action.

### Acceptance Criteria

- [ ] Any logged-in user can navigate to `/settings/account`
- [ ] "Download my data" triggers a JSON file download containing the user's profile and all their records
- [ ] "Delete my account" soft-deletes the profile, signs the user out, and creates a row in `account_deletion_requests`
- [ ] The deleted account shows up in Super Admin's Admin Oversight panel for review
- [ ] `/privacy` page is reachable without authentication
- [ ] Sign-up page links to `/privacy`

### Style Guardrails

- Account deletion button: use `bg-semantic-error` destructive style with inline confirmation text ("Are you sure? Type DELETE to confirm" or similar minimal pattern — no modal).
- Privacy notice page: plain prose layout, `max-w-prose`, `text-body text-neutral-800`, no decorative elements.
- "Account" nav item: placed after existing nav items, same `text-body-sm` style.

---

## Phase 2-F — Production Hardening

**Branch:** `fix/rs-production-hardening`
**Risk:** Low — additive; no logic changes to existing paths

> **Note on env validation:** `lib/env.ts` already throws on missing vars. Phase 2-D step 3 consolidates this into `middleware.ts`. No further env validation work is needed here — this avoids the SEC-3/PROD-2 duplication.

### Files To Create Or Modify

| File | Change |
|------|--------|
| `apps/web/instrumentation.ts` (new) | Enable Vercel-native logging via `@vercel/otel` — register at app startup |
| `apps/web/next.config.mjs` | No change needed — Next.js 15 enables instrumentation by default (flag was promoted to stable) |
| `docs/ops/new-org-setup.md` (new) | Step-by-step guide for deploying a fresh org instance |

### Rollout / Migration / Access Impact

None — Vercel observability is additive. `instrumentation.ts` runs server-side only.

### Implementation Steps

1. Add `@vercel/otel` to `apps/web/package.json` (`npm install @vercel/otel`).
2. Create `apps/web/instrumentation.ts` with:
   ```ts
   import { registerOTel } from '@vercel/otel';
   export function register() {
     registerOTel({ serviceName: 'rosterserve' });
   }
   ```
3. No `next.config.mjs` change needed — the project is on Next.js 15, where `instrumentation.ts` is supported by default. The `experimental.instrumentationHook` flag was promoted to stable and removed in Next.js 15.
4. Create `docs/ops/new-org-setup.md` covering:
   - Fork/clone the repo
   - Create a new Supabase project and run migrations
   - Set all required env vars in Vercel
   - Deploy via `vercel --prod` from repo root
   - Seed initial `super_admin` user via Supabase Auth admin API
   - Smoke-test checklist (sign in as each role, verify nav, create one event)

### Acceptance Criteria

- [ ] `@vercel/otel` registers without build error
- [ ] Vercel dashboard shows traces from a production request
- [ ] `docs/ops/new-org-setup.md` exists and covers all required steps

---

## Parallelisation Note

2-A must land before 2-B (both touch `app-nav.tsx`).  
2-C, 2-D, 2-F are independent and can be worked in parallel after 2-A.  
2-E depends on 2-D being merged first (account deletion needs correct auth checks).

```
2-A → 2-B
2-A → 2-C (parallel with 2-B)
2-D → 2-E
2-F (parallel with everything after 2-A)
```

---

## Risks Or Blockers

1. **Governance** — This plan requires an explicit user exception to the "feature-plan only" rule. No implementation begins until that exception is recorded.
2. **Storage RLS complexity** — The volunteer-scoped read policy (join through 3 tables) needs careful testing. A mistake could lock legitimate users out of instruction attachments.
3. **Supporter availability/skills data** — The supporter test account has no memberships or department associations, so the volunteer-equivalent views will show empty states in testing. This is expected; verify the redirect no longer fires.
4. **GDPR notice is not legal advice** — The minimal privacy notice satisfies a structural obligation but does not replace a legal review.

---

## Validation Plan

After each phase, run:
1. `npm run build` — must pass with no type errors
2. `npm run lint` — must pass
3. Manual Playwright walkthrough of all 6 roles — verify the specific acceptance criteria for that phase
4. For 2-D: apply migration to production Supabase, verify signed URLs still work for existing instruction attachments

---

## Documentation Updates

When all phases are complete, update:
- `docs/tracking/progress.md` — mark Phase 2 production hardening complete
- `docs/tracking/claude-progress.txt` — add wrap-up note
- `CLAUDE.md` — if any architectural patterns change (e.g. env validation consolidation)
