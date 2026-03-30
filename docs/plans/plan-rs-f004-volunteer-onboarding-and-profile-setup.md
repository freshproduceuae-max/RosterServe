# Plan: RS-F004 - Volunteer Onboarding And Profile Setup

Status: Implemented and merged via PR #4 (2026-03-29) — manual validation (13 checks) not explicitly confirmed
Feature: RS-F004
Source PRD: docs/prd/prd.md
Source Feature List: docs/features/feature-list.json
Design System: docs/design-system/design-system.md

## Objective

Gate new volunteers into a guided setup path immediately after sign-up, before they can reach their dashboard. The path collects general availability preferences, expressions of interest in serving areas, and optional skill submissions. On completion the volunteer is marked as onboarded and transitioned into the full volunteer dashboard experience. Leaders and admins are never sent to the onboarding path.

## Scope And Non-Goals

### In Scope

- Onboarding gate: volunteers with `onboarding_complete = false` are redirected to `/onboarding` from any `(app)` route
- Minimal onboarding layout (no nav bar, no events link) separate from the main `(app)` layout
- Three-step onboarding flow:
  - Step 1 — Availability preferences: select general days and times of availability (not dated blockouts)
  - Step 2 — Serving area interests: select departments from active events the volunteer would like to serve in (skippable if no departments exist yet)
  - Step 3 — Skills: optionally submit free-text skill names (stored as pending, no approval UI here)
- Database tables: `availability_preferences`, `volunteer_interests`, `volunteer_skills`
- RLS on all three new tables
- Server actions to save each step and to mark onboarding complete
- Step data is saved incrementally — partial onboarding data persists if the volunteer closes mid-flow
- On completion: `profiles.onboarding_complete` set to `true`, volunteer redirected to `/dashboard`
- Guard in `(app)/layout.tsx` to enforce the gate server-side (defense-in-depth behind the onboarding layout guard)
- Seed examples added to `supabase/seed.sql`

### Explicit Scope Boundaries

- **Dated availability and blockouts** — deferred to RS-F005. RS-F004 captures general day/time preferences only.
- **Interest request status and routing to leaders** — deferred to RS-F006. RS-F004 records the volunteer's expressed interests but adds no review workflow.
- **Skill approval workflow** — deferred to RS-F007. RS-F004 writes skill rows with `status = 'pending'`; no approval UI exists yet.
- **Profile photo upload** — not in v1 scope.
- **Display name editing** — display name is already captured at sign-up. No re-capture step in onboarding.
- **Leader or admin onboarding paths** — not required. Only the `volunteer` role is gated.

### Non-Goals

- Volunteer dashboard content (RS-F010)
- Skill gap calculations (RS-F009)
- Assignment or interest request management (RS-F006, RS-F008)
- Notification delivery (RS-F013)

## Approach

### Gate Mechanism

The `(app)/layout.tsx` already fetches `getSessionWithProfile()`. Add one check after the existing auth gate: if `profile.role === 'volunteer' && !profile.onboarding_complete`, redirect to `/onboarding`. This keeps the gate inside a server component and relies on an already-resolved session — no extra round-trip.

The `/onboarding` route lives in a new `(onboarding)` route group with its own layout. That layout handles:
- No session → redirect to `/sign-in`
- Non-volunteer role → redirect to `/dashboard`
- Already onboarded → redirect to `/dashboard`

This means both directions are gated: `(app)` routes eject un-onboarded volunteers; the onboarding route ejects everyone else.

### Data Model

**Migration `00005_onboarding.sql`:**

1. `availability_preferences` — one row per volunteer (UNIQUE on `volunteer_id`), upserted on save.
   - `id` uuid PK
   - `volunteer_id` uuid FK profiles NOT NULL, UNIQUE
   - `preferred_days` text[] NOT NULL DEFAULT '{}'
   - `preferred_times` text[] NOT NULL DEFAULT '{}'
   - `created_at`, `updated_at`
   - Valid `preferred_days` values: `monday tuesday wednesday thursday friday saturday sunday`
   - Valid `preferred_times` values: `morning afternoon evening`
   - CHECK constraints on both arrays

2. `volunteer_interests` — which departments a volunteer expressed interest in during onboarding.
   - `id` uuid PK
   - `volunteer_id` uuid FK profiles NOT NULL
   - `department_id` uuid FK departments NOT NULL
   - `created_at`
   - UNIQUE (`volunteer_id`, `department_id`)

3. `volunteer_skills` — skill names submitted by the volunteer, pending leader approval (RS-F007).
   - `id` uuid PK
   - `volunteer_id` uuid FK profiles NOT NULL
   - `name` text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100)
   - `status` text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))
   - `created_at`, `updated_at`, `deleted_at`

**RLS:**

`availability_preferences`:
- SELECT/INSERT/UPDATE: volunteer reads and writes own row only (`volunteer_id = auth.uid()`)
- SELECT: super_admin reads all

`volunteer_interests`:
- SELECT/INSERT/DELETE: volunteer manages own rows only (`volunteer_id = auth.uid()`)
- SELECT: super_admin reads all
- Leader-scoped reads for planning views deferred to RS-F006

`volunteer_skills`:
- SELECT: volunteer reads own rows; super_admin reads all
- INSERT: volunteer inserts own rows only, status must be `'pending'`
- UPDATE/DELETE: volunteer soft-deletes own pending rows only; approval writes reserved for RS-F007

### Server Actions (`apps/web/lib/onboarding/actions.ts`)

- `saveAvailabilityPreferences(formData)` — upserts one `availability_preferences` row for the current user
- `saveVolunteerInterests(departmentIds)` — replaces the volunteer's `volunteer_interests` rows (delete-insert within a transaction)
- `saveVolunteerSkills(skillNames)` — **append-only with dedupe**: inserts new `volunteer_skills` rows (pending) for any names not already present in a non-deleted row for this volunteer; does not delete previously saved skills on re-submit. This means a volunteer who saves Step 3, closes, and resumes will accumulate skills across submissions rather than having their prior entries replaced. Skills already saved appear pre-filled and cannot be re-added as duplicates.
- `completeOnboarding()` — sets `profiles.onboarding_complete = true` for the current user, then redirects to `/dashboard`

Each action verifies `role === 'volunteer'` before writing. No other role may write to these tables via these actions.

### Queries (`apps/web/lib/onboarding/queries.ts`)

- `getOnboardingState(userId)` — returns existing `availability_preferences`, `volunteer_interests`, and `volunteer_skills` rows for pre-filling if the volunteer resumes onboarding
- `getActiveDepartmentsForInterests()` — returns active (non-deleted) departments across all active events, with event title for context; used to populate the interests step selector; returns empty array if none exist. Must filter `departments.deleted_at IS NULL`.
- `getOnboardingState(userId)` — returns existing rows across all three tables for pre-fill. For `volunteer_interests`, must JOIN to `departments` and filter `departments.deleted_at IS NULL` — stale interest rows pointing to soft-deleted departments must not appear in the pre-fill list. The underlying rows are not deleted (FK is still valid) but they must be invisible to the volunteer at the UI layer.

### UI Structure

Route group: `apps/web/app/(onboarding)/`

```
(onboarding)/
  layout.tsx                          — minimal layout: gate logic + clean warm wrapper (no nav)
  onboarding/
    page.tsx                          — server component: fetches onboarding state + departments, renders OnboardingFlow
    _components/
      onboarding-flow.tsx             — client component: manages current step (1–3), passes data + actions down
      step-indicator.tsx              — displays "Step N of 3" with visual progress
      availability-step.tsx           — day checkboxes + time-of-day checkboxes, useActionState
      interests-step.tsx              — department multi-select or empty state, useActionState
      skills-step.tsx                 — repeater for skill text inputs + final "Complete setup" action
```

Step progression:
1. Volunteer completes step → client calls server action to save → on success advances to next step
2. Step 3 completion calls `saveVolunteerSkills` then `completeOnboarding` in sequence → server redirects to `/dashboard`
3. If volunteer skips an optional step, the step is still advanced (no data written for that step)

### Modified Files

- `apps/web/app/(app)/layout.tsx` — add onboarding redirect for `volunteer && !onboarding_complete`

## Files To Create Or Modify

| File | Create/Modify | Reason |
|------|--------------|--------|
| `supabase/migrations/00005_onboarding.sql` | Create | New tables + RLS for availability_preferences, volunteer_interests, volunteer_skills |
| `apps/web/lib/onboarding/types.ts` | Create | TypeScript types for onboarding entities |
| `apps/web/lib/onboarding/schemas.ts` | Create | Zod schemas for form validation |
| `apps/web/lib/onboarding/queries.ts` | Create | getOnboardingState, getActiveDepartmentsForInterests |
| `apps/web/lib/onboarding/actions.ts` | Create | saveAvailabilityPreferences, saveVolunteerInterests, saveVolunteerSkills, completeOnboarding |
| `apps/web/app/(onboarding)/layout.tsx` | Create | Minimal layout with gate checks |
| `apps/web/app/(onboarding)/onboarding/page.tsx` | Create | Server component entry point for onboarding flow |
| `apps/web/app/(onboarding)/onboarding/_components/onboarding-flow.tsx` | Create | Client component managing step state |
| `apps/web/app/(onboarding)/onboarding/_components/step-indicator.tsx` | Create | Step progress display |
| `apps/web/app/(onboarding)/onboarding/_components/availability-step.tsx` | Create | Step 1: day/time preference checkboxes |
| `apps/web/app/(onboarding)/onboarding/_components/interests-step.tsx` | Create | Step 2: department multi-select |
| `apps/web/app/(onboarding)/onboarding/_components/skills-step.tsx` | Create | Step 3: skill text inputs + completion |
| `apps/web/app/(app)/layout.tsx` | Modify | Add onboarding gate for volunteers |
| `supabase/seed.sql` | Modify | Add onboarding example data |
| `docs/tracking/progress.md` | Modify | Mark RS-F004 passed |
| `docs/tracking/claude-progress.txt` | Modify | Session handoff update |
| `docs/features/feature-list.json` | Modify | RS-F004 passes: true |

## Rollout / Migration / Access Impact

**Schema:** Three new tables added. No existing tables are altered except that `profiles.onboarding_complete` (existing column, already `false` by default) is now written to by `completeOnboarding`.

**Auth / access:** No new roles. No existing RLS policies changed. Three new tables each have their own RLS policies. Existing volunteers who signed up before this feature are currently held at `onboarding_complete = false` — they will be gated into the onboarding flow the next time they sign in after deployment. This is the intended behavior.

**Data model downstream contracts:**
- `availability_preferences` is the table RS-F005 will extend with dated availability. The v1 structure leaves room for RS-F005 to add a separate `availability_dates` / `blockouts` table without altering this one.
- `volunteer_interests` is the table RS-F006 will query when routing interest requests. The `department_id` FK already exists; RS-F006 adds a status column or a separate `interest_requests` table built on top.
- `volunteer_skills` has a `status` column that RS-F007's approval workflow will drive. The schema is intentionally ready for RS-F007 without requiring a migration to add the status column later.

**Migration safety:** Migration 00005 is purely additive. It does not touch events, departments, sub_teams, or profiles structure.

## Implementation Steps

1. Create migration `supabase/migrations/00005_onboarding.sql` with `availability_preferences`, `volunteer_interests`, and `volunteer_skills` tables, indexes, triggers, and RLS policies as described above.

2. Create `apps/web/lib/onboarding/types.ts` with `AvailabilityPreferences`, `VolunteerInterest`, `VolunteerSkill`, and `OnboardingState` TypeScript interfaces.

3. Create `apps/web/lib/onboarding/schemas.ts` with Zod schemas for each step:
   - `availabilityPreferencesSchema` (preferred_days array, preferred_times array)
   - `volunteerInterestsSchema` (array of department UUIDs)
   - `volunteerSkillsSchema` (array of skill name strings, each 1–100 chars)

4. Create `apps/web/lib/onboarding/queries.ts` implementing `getOnboardingState` and `getActiveDepartmentsForInterests`.

5. Create `apps/web/lib/onboarding/actions.ts` implementing `saveAvailabilityPreferences`, `saveVolunteerInterests`, `saveVolunteerSkills`, and `completeOnboarding`. Each action calls `getSessionWithProfile` and verifies `role === 'volunteer'` before writing.

6. Create `apps/web/app/(onboarding)/layout.tsx` — fetches session, applies gate logic, renders a minimal warm-surface wrapper (no nav header, no events link, RosterServe wordmark only for context).

7. Create the step components:
   - `step-indicator.tsx` — static display of current step number and total
   - `availability-step.tsx` — checkbox grid for days (Mon–Sun) and times (morning/afternoon/evening), `useActionState` with `saveAvailabilityPreferences`
   - `interests-step.tsx` — checkbox list of available departments with event name context; renders an informational empty state ("No serving areas are set up yet") if the list is empty; step is always skippable
   - `skills-step.tsx` — dynamic list of text inputs (add/remove), `useActionState`; on submit calls `saveVolunteerSkills` then `completeOnboarding`

8. Create `apps/web/app/(onboarding)/onboarding/_components/onboarding-flow.tsx` — client component holding `currentStep` state (1–3), rendering the active step component, handling step advance on server action success.

9. Create `apps/web/app/(onboarding)/onboarding/page.tsx` — server component that calls `getOnboardingState` and `getActiveDepartmentsForInterests`, then renders `<OnboardingFlow>` with initial data props.

10. Modify `apps/web/app/(app)/layout.tsx` — after the existing `if (!session) redirect('/sign-in')` guard, add: `if (session.profile.role === 'volunteer' && !session.profile.onboarding_complete) redirect('/onboarding')`.

11. Add onboarding seed examples to `supabase/seed.sql`.

12. Run `npm run typecheck && npm run lint && npm run build` — all must pass.

13. Update `docs/tracking/progress.md`, `docs/features/feature-list.json`, and `docs/tracking/claude-progress.txt`.

## Acceptance Criteria Mapping

**Feature registry steps (from feature-list.json):**

| Registry Step | How It Is Met |
|---|---|
| Gate new volunteer users into an onboarding path before the main dashboard | `(app)/layout.tsx` redirects volunteer + `onboarding_complete = false` → `/onboarding`; onboarding layout redirects any non-volunteer or already-onboarded user → `/dashboard` |
| Capture baseline profile details, interests, availability signals, and optional skill input | Three-step flow: availability preferences (Step 1), department interests (Step 2), skills (Step 3) |
| Transition completed volunteers into the role-appropriate dashboard experience | `completeOnboarding` sets `onboarding_complete = true` and redirects to `/dashboard` |

**PRD validation items:**

| PRD Item | Verification |
|---|---|
| Sign in as new volunteer and verify onboarding is shown before the main dashboard | Manual: sign up, sign in — should land on `/onboarding` not `/dashboard` |
| Complete onboarding and confirm availability, interests, and optional skills are stored | Manual: complete all steps, check DB rows in `availability_preferences`, `volunteer_interests`, `volunteer_skills` |
| Reopen volunteer experience and confirm onboarding is not forced again once complete | Manual: sign out, sign back in — should land on `/dashboard`, no redirect to `/onboarding` |

## Style Guardrails For UI Work

**Surface:** Volunteer-facing. The design system explicitly reserves the warmest, most welcoming treatment for onboarding and welcome moments.

**Layout:**
- Single column, centered, max-width constrained (narrower than main shell — fits on mobile without scrolling)
- No nav header. Wordmark only at top for orientation.
- Clean background using `bg-surface-warm` (#FFF8E8)
- Generous vertical spacing between steps

**Typography:**
- `font-display` (Space Grotesk) is appropriate here — the design system explicitly calls out "major onboarding moments" as a valid use case for `type.display`
- Step heading: `font-display text-h2` or `text-h1` for the main prompt (this is a singular focus moment, not a dense list)
- Body text: `text-body` or `text-body-sm` for descriptions and helper copy

**Colour:**
- `brand-warm-500` (#F2C14E) for accent and emphasis
- `bg-surface-warm` for page/card background
- `semantic-error` for validation errors (consistent with other form surfaces)

**CTAs:**
- Pill-shaped buttons (`rounded-pill`) are explicitly permitted here — "welcome or promotional moments" is the stated exception. Use pill shape for "Next", "Skip", and "Complete setup" actions.
- "Next" and "Skip" on intermediate steps; "Complete setup" on the final step (non-destructive, no confirmation needed)

**Step indicator:**
- Simple inline text ("Step 1 of 3") or dot-based indicator
- Use a thin progress bar (`h-1` or `h-0.5`) in `brand-warm-500` below the wordmark

**Form inputs:**
- Full-border inputs and checkboxes consistent with the rest of the system (`rounded-200`, focus ring)
- Checkbox groups for days and times — prefer a compact grid on mobile
- Day labels: abbreviated ("Mon", "Tue", etc.) on mobile, full name on desktop

**Tone (volunteer copy):**
- Warm and encouraging throughout
- First-person prompts: "When are you generally available to serve?"
- Supportive subtext: "You can always update this later from your dashboard."
- Skills empty state on the interests step: "No serving areas are set up yet — we'll let you know when you can express your interest."
- Completion message before redirect: a brief warm confirmation ("You're all set!")

**States that require fidelity:**
- Loading state on each step's submit button (spinner or disabled + "Saving…")
- Error state inline below form (not toast) if a server action fails
- Empty state on the interests step when no departments are available
- Skip affordance on Steps 2 and 3 — small secondary text link, not a button

## Risks Or Blockers

1. **Existing volunteers are immediately gated.** All volunteer accounts created before this feature ships have `onboarding_complete = false`. On first sign-in after deployment they will be redirected to `/onboarding`. This is the correct intended behavior, but it should be noted in seed docs and tested intentionally.

2. **Interests step may always be empty in early development.** No departments will exist in a fresh dev environment until a super_admin creates events and departments. The interests step must gracefully handle this and be skippable. The empty state message must not imply an error.

3. **`completeOnboarding` must be idempotent.** If called twice (e.g., double-submit), it should not error — the UPDATE to `onboarding_complete = true` is safe to run twice. The redirect will fire on first success.

4. **Step data saved by a partial onboarding is permanent.** If a volunteer saves Step 1 then abandons, they have an `availability_preferences` row. When they return, the page should pre-fill their saved data. The `getOnboardingState` query handles this — it must be called on page load and passed as initial props to the client component.

5. **`volunteer_interests` references live `departments` rows.** If a department is soft-deleted after a volunteer expressed interest, the FK still holds (departments use soft-delete, not hard-delete). The `getActiveDepartmentsForInterests` query filters `deleted_at IS NULL` — stale interest rows pointing to deleted departments are benign for v1 but RS-F006 should filter them out.

## Validation Plan

### Automated checks
- `npm run typecheck` — passes
- `npm run lint` — passes
- `npm run build` — passes
- `npx supabase db reset` — migration 00005 applies cleanly on top of 00004

### Manual checks
1. Sign up as a new volunteer → should be redirected to `/onboarding` on first sign-in
2. **Rollout path (existing volunteer):** Use a pre-existing volunteer account that has `onboarding_complete = false` (i.e., registered before this feature shipped) → sign in → should be gated to `/onboarding` via the `(app)/layout.tsx` guard, not just the onboarding layout. This is the primary rollout-sensitive path.
3. Sign in as super_admin → should go directly to `/dashboard`, never see `/onboarding`
4. Sign in as dept_head → should go directly to `/dashboard`, never see `/onboarding`
5. Navigate directly to `/onboarding` as a super_admin → should redirect to `/dashboard`
6. Complete Step 1 (availability), close browser, reopen → should return to `/onboarding` with Step 1 data pre-filled
7. **Step 3 resume:** Save skills on Step 3, close browser, reopen → previously saved skills appear pre-filled; submitting additional skills appends rather than replaces.
8. Complete all steps → should land on `/dashboard` with no further redirect to `/onboarding`
9. Sign out and sign back in as the now-onboarded volunteer → should go directly to `/dashboard`
10. Complete onboarding with no departments available (interests step empty) → skip should work, onboarding should complete
11. **Deleted department in interests:** Express interest in a department, then soft-delete that department as super_admin, then resume onboarding → stale interest should not appear in the pre-fill list.
12. Submit skills step with no skills entered → should complete without error (skills are optional)
13. Mobile layout check — single-column, checkboxes usable on small screen

## Documentation Updates

- `docs/tracking/progress.md` — mark RS-F004 as passed
- `docs/features/feature-list.json` — set RS-F004 `passes` to `true`
- `docs/tracking/claude-progress.txt` — full handoff update including new tables, gate pattern, and downstream contracts with RS-F005/F006/F007
- `supabase/seed.sql` — add commented onboarding examples
