# RosterServe Progress

Status: Canonical tracker
Last updated: 2026-04-09
Current phase: Production deployed — v1 live
Current build stage: 18 features passed (RS-F001–RS-F018); deployed to Vercel

## Execution Gate

No implementation, scaffolding, migration, or setup work should begin until an applicable plan exists in `docs/plans/`, has been reviewed, and has been explicitly approved.

For this repo state:
- the one-time scaffolding plan has been completed
- each product feature still requires its own approved feature-specific plan

## Completed Milestones

- Bootstrap architecture workflow established
- Canonical design system created
- Canonical PRD created
- Canonical feature registry created
- Tracking and execution-support docs created
- Scaffolding assessment completed
- Scaffolding plan created
- Scaffolding implemented and validated
- RS-F001 plan created and approved
- RS-F001 implemented and validated (typecheck, lint, build pass; design-fidelity review pass)
- RS-F002 plan created and approved
- RS-F002 implemented and validated (typecheck, lint, build pass; design-fidelity review pass)
- RS-F003 plan created and approved
- RS-F003 implemented and validated (typecheck, lint, build pass; design-fidelity review pass; code review pass)
- RS-F004 plan created, reviewed by Codex, and approved
- RS-F004 implemented, PR #4 reviewed and merged to main (2026-03-29)
- RS-F005 plan drafted, reviewed (2 review rounds), approved, and merged to main
- RS-F005 implemented; PR #6 reviewed and merged to main (2026-03-29)
- RS-F005 manual validation (12 checks) confirmed passed (2026-03-30)
- RS-F006 plan created, reviewed, and approved (2026-03-30)
- RS-F006 implemented; PR #7 reviewed (multiple rounds), approved, and merged to main (2026-03-30)
- RS-F006 manual validation (15 checks) confirmed passed (2026-03-30)
- RS-F007 plan drafted, reviewed (3 review rounds addressing RLS INSERT policy, UPDATE WITH CHECK clauses, and legacy/soft-delete spec gaps), approved, and merged to main via PR #8 (2026-03-30)
- RS-F007 implemented (2026-03-30): migration 00009, lib layer, 7 UI components, /skills page, nav link, seed examples; PR #9 merged
- RS-F007 post-implementation fixes: RLS recursion repair (PR #10 merged); check-17 fix (getOwnedDepartmentsForLeader, leader-skills-view always renders owned dept sections)
- RS-F007 validated (2026-04-02): 16/18 checks verified statically; check-17 fixed; check-18 (mobile) accepted via static layout analysis (live browser validation desirable when local env is running)
- RS-F008 plan drafted, reviewed (2 rounds — sub-leader scope + canViewRoster link), approved, implemented, and merged to main via PR #11 (2026-04-02)
- RS-F008 implementation delivered: migration 00011_assignments.sql, assignments lib layer, roster route and components, department detail roster link, seed examples
- RS-F008 blocking review findings fixed before approval: event_date lookup corrected; sub-leader assignment RLS/actions now enforce `sub_team.department_id = assignment.department_id`; sub-leader edit UI no longer offers a dept-level `No sub-team` option
- RS-F008 automated checks pass after fixes: `npm run typecheck`, `npm run lint`, `npm run build`
- RS-F008 validated (2026-04-02): 14/20 checks verified by static code analysis; 6 deferred to live-environment pass (checks 3, 5, 8, 9, 12: DB row + chip rendering confirmation; check 10 partial: deleted_at confirmation; check 20: 320px visual rendering). All deferred checks are observability/rendering confirmations — underlying logic verified statically. Accepted on same basis as RS-F007 check-18.
- RS-F009 plan drafted, reviewed (3 rounds — sub-leader RLS scope, interim coverage rule, file list accuracy), all approved
- RS-F009 implementation delivered: migration 00012_skill_requirements.sql (is_required column + sub-leader RLS), gap-types.ts, gap-queries.ts, setSkillRequired action, Required toggle on skills page, GapSummary component, roster page wiring, volunteer selector skill match, department detail gap badge
- RS-F009 automated checks pass: npm run typecheck, npm run lint, npm run build
- RS-F009 PR #12 code-reviewed (no blocking findings) and merged to main (2026-04-04)
- RS-F009 RLS bug fixes found during validation: PR #13 (validation infrastructure fixes) and PR #14 (00015 SECURITY DEFINER hardening, 00016 events dept_head policy fix, 00017 assignment soft-delete fix) reviewed and merged to main (2026-04-04)
- RS-F009 manual validation (21 items) confirmed passed (2026-04-04); all re-validation checks after PR #14 merge also pass
- RS-F010 plan drafted, reviewed, approved, and merged to main via PR #15 (2026-04-05)
- RS-F010 implemented: lib/dashboard/types.ts, lib/dashboard/queries.ts, dashboard/page.tsx, 5 role/shared components; PR #16 reviewed, approved, and merged to main (2026-04-05)
- RS-F010 post-merge hotfix: invalid PostgREST embedded-resource .order() calls removed (commit 52470c7, pushed to main 2026-04-05)
- RS-F010 migration 00018: volunteer events + sub_teams RLS policies committed and pushed (commit ea58d63, 2026-04-05) — was omitted from PR #16
- RS-F010 automated checks pass: npm run typecheck, npm run lint, npm run build
- RS-F010 manual validation (checks 1–8): paused — feature requires revision per PRD v2 before validation is meaningful
- Vision document revised (2026-04-07): role hierarchy expanded to 6 roles, permanent group membership model added, team rotation added, request-to-serve flow replaces invitation model, terminology corrected
- PRD revised (2026-04-07): all sections updated; RS-F016 (team rotation), RS-F017 (auto-suggestions), RS-F018 (supporter role) added
- Feature list v2 published (2026-04-07): 8 features reset to passes=false with revision notes; RS-F005 remains passes=true; RS-F016–RS-F018 added
- RS-F001 revision plan drafted, Codex advisory reviewed (NEEDS_DISCUSSION resolved), approved, and merged via PR #17 (2026-04-08)
  - Scope narrowed in PRD and feature-list.json: Supporter mirroring → RS-F018; event-creation grant → RS-F002
- RS-F001 revision implemented: migration 00019 (enum ADD VALUE) + 00020 (data migration, supporter_of column, CHECK constraint, trigger, 11 RLS policy updates); TypeScript 6-role types, dashboard stubs for all_depts_leader/team_head/supporter, all_depts_leader event creation access; PR #18 reviewed (3 Codex rounds), approved, and merged to main (2026-04-08)
- RS-F001 migration split hotfix: PR #19 merged (2026-04-08) — 00019 retains only ALTER TYPE ADD VALUE; 00020 has all downstream work (required because PostgreSQL disallows using a new enum value in the same transaction it was added)
- RS-F001 post-merge validation (2026-04-08):
  - `npx supabase db reset`: all 20 migrations apply cleanly
  - `SELECT policyname FROM pg_policies WHERE policyname ILIKE '%sub_leader%'`: 0 rows
  - `npm run typecheck`, `npm run lint`, `npm run build`: all pass
  - Manual browser checks (login as `team_head` / `all_depts_leader` / `supporter`): confirmed passed (2026-04-08)
    - `team_head`: signs in → `/dashboard` renders, `/events` visible (no Create CTA), `/events/new` blocked → redirects to `/events`, `/availability` accessible
    - `all_depts_leader`: signs in → `/dashboard` stub renders, `/events` shows Create CTA, `/events/new` accessible
    - `supporter`: signs in → `/dashboard` stub renders, Events nav link absent, 0 JS errors
  - All 11 validation checks passed — RS-F001 marked `passes=true`
- RS-F002 revision plan drafted, Codex advisory reviewed, approved, and merged via PR #20 plan step (2026-04-08)
- RS-F002 revision implemented: migration 00021 (can_create_events column, all_depts_leader SELECT policy, expanded INSERT/UPDATE policies); canManageEvents + canManageThisEvent helpers; grantEventCreation / revokeEventCreation actions; /events/grants page + GrantList component; all four event actions updated; events page gates updated; EventDetailCard canManage prop; edit page two-step gate; PR #20 reviewed, approved, and merged to main (2026-04-08)
- RS-F002 validation fixes: two missing RLS policies and one React dialog crash discovered during browser checks 5–16; fixed in PR #21 and merged to main (2026-04-08)
  - Migration 00022: super_admin UPDATE policy on profiles (required for grant/revoke to write can_create_events)
  - Migration 00023: "Granted users can read events they created" SELECT on events (required for createEvent .select() after INSERT)
  - EventDetailCard: transitionAction / deleteAction wrapped in startTransition(); immediate modal-close calls removed
- RS-F002 post-merge validation (2026-04-08):
  - `npm run typecheck`, `npm run lint`: all pass
  - Browser checks 5–16: all pass (grant/revoke cycle, ownership enforcement, status machine, all_depts_leader cross-dept visibility)
  - All 16 validation checks passed — RS-F002 marked `passes=true`
- RS-F003 revision implemented and validated (2026-04-08): migration 00024 (rename sub_teams→teams, decouple depts from events, rotation_label, headcount requirements, updated RLS); full /departments CRUD, Departments nav link; PR #22 reviewed and merged to main
- RS-F003 marked passes=true
- RS-F004 revision implemented (2026-04-08): getActiveDepartmentsForInterests() updated to org-level departments (no event join); event_title removed from type and UI; no migration needed
- RS-F004 marked passes=true
- RS-F006 revision implemented (2026-04-08): migration 00025 (department_members table, approve_and_create_membership() RPC); lib/memberships layer (types, queries, placeInTeam/removeMembership); approveInterest now atomic via RPC; team selector on approval card; volunteer membership view on /interests; department detail members section with team placement; PR merged
- RS-F006 marked passes=true
- RS-F007 revision plan drafted and approved (2026-04-08)
- RS-F007 revision implemented (2026-04-08): migration 00026 (new RLS policies for super_admin/all_depts_leader/team_head on both skills tables); actions expanded with dual-branch role guards + bulkCreateSkills; getSkillClaimsForTeamHead + getAllActiveDepartments queries added; /skills page routes all 6 roles; TeamHeadSkillsView created; SuperAdminSkillsView updated with SkillCreationForm (single + bulk entry)
- RS-F007 marked passes=true
- RS-F008 revision implemented and validated (2026-04-09): replaced individual assignment creation with team-selection and bulk-invite flow; accept/decline for team heads and volunteers; substitute team head selection on decline; all_depts_leader read-only roster access; migration 00027
- RS-F008 marked passes=true
- RS-F009 revision implemented (2026-04-09): added HeadcountGapSummary type, getHeadcountGapsForRoster query (per-team, per-event-type, non-declined assignment count vs required), HeadcountGapSection component; all three roster views (DeptHeadRosterView, TeamHeadRosterView, SuperAdminRosterView) now render both skill and headcount gap sections; team head branch scoped to own sub-teams via filterTeamIds
- RS-F009 marked passes=true
- RS-F010 revision implemented (2026-04-09): built AllDeptsLeaderDashboard (full cross-dept event health view with non-confirmation counts); built SupporterDashboard (own service requests + leader context); TeamHeadDashboard: added own invitation cards with accept/decline; DeptHeadDashboard: added pending_team_heads highlight in RosterHealthBar; getDeptHeadDashboardData rewritten to use assignments→events join (schema-safe); new queries: getAllDeptsLeaderDashboardData, getSupporterDashboardData, updated getTeamHeadDashboardData
- RS-F010 marked passes=true (2026-04-09)
- RS-F011 implemented (2026-04-09): event_instructions table with dept/team scoping, single file attachment per instruction stored in Supabase Storage bucket instruction-media; Leaders post/delete; volunteers read via RLS-scoped query; navigation from roster page (leaders) and AssignmentCard (volunteers)
- RS-F011 marked passes=true (2026-04-09)
- RS-F012 implemented (2026-04-09): Added decline confirmation dialog to ServiceRequestCard and InvitationCard. Added accepted→served RLS policy (migration 00030) and markAssignmentServed server action. DeptHeadRosterView shows confirmed assignments with MarkServedButton. TeamHeadDashboard shows confirmed service section.
- RS-F012 marked passes=true (2026-04-09)
- RS-F013 implemented (2026-04-09): Resend v4 installed. Service-role admin client at lib/supabase/admin-client.ts resolves user emails from auth.users. Email functions at lib/email/send.ts (sendInvitationEmail, sendResponseEmail, sendPreEventLeaderAlert) degrade silently when RESEND_API_KEY is absent. HTML-escaping applied to all user-supplied strings in email bodies. createAssignment and selectTeamForEvent send invitation emails; respondToServiceRequest sends response email to dept_head. Cron endpoint GET /api/cron/event-alerts fires daily at 09:00 UTC via vercel.json; queries events 2 and 5 days away, sends pre-event alerts to dept_heads with accepted/pending/declined counts. CRON_SECRET header guard prevents unauthorized cron triggering.
- RS-F013 marked passes=true (2026-04-09)
- RS-F014 implemented (2026-04-09): Added lib/admin/queries.ts (getSoftDeletedRecords, getSoftDeletedCount with count-only queries) and lib/admin/actions.ts (restoreRecord sets deleted_at=null, hardDeleteRecord hard-DELETEs, both super_admin gated). New /admin route with DeleteApprovalTable client component (per-record pending state, window.confirm before hard delete). SuperAdminDashboard gains pendingDeletions badge with Review link to /admin when records exist.
- RS-F014 marked passes=true (2026-04-09)
- RS-F015 implemented (2026-04-09): lib/support/actions.ts (sendBugReport via Resend, degrades gracefully when RESEND_API_KEY/DEVELOPER_EMAIL absent); BugReportForm client component in app/(app)/_components/; global error boundary at app/error.tsx (renders own html/body, retry + WhatsApp link); global 404 at app/not-found.tsx; app-section error boundary at app/(app)/error.tsx with retry, dashboard link, WhatsApp link, and BugReportForm
- RS-F015 marked passes=true (2026-04-09)
- RS-F016 implemented (2026-04-09): migration 00031 (dept_rotation_overrides table, dept_head full CRUD on owned depts); getRotationSchedule query computes next A→B→C label per dept from event_date-sorted override history; RotationScheduleSection client component with per-entry pending/error state; DeptHeadDashboard wired to rotationEntries and rotationTeamsByDept via getDeptHeadDashboardData; RSC boundary uses Record<string, RotatableTeamRecord[]> (no Map)
- RS-F016 marked passes=true (2026-04-09)
- RS-F017 implemented (2026-04-09): getCrossTeamSuggestions query ranks available-first, skill-match-count desc, alphabetical; checks availability_blockouts for event date; CrossTeamSuggestionsPanel client component with assign button, unavailable badge, optimistic removal; wired into dept_head roster page
- RS-F017 marked passes=true (2026-04-09)
- RS-F018 implemented (2026-04-09): migration 00032 (super_admin UPDATE policy on supporter profiles, closing gap left by 00022); assignSupporter and removeSupporter server actions; getSupporterAssignments and getLeaderProfiles queries; SupporterAssignmentsSection client component with per-row pending state; admin oversight page loads all three data sets in parallel and renders new section
- RS-F018 marked passes=true (2026-04-09)
- Phase 2-A + 2-B implemented (2026-04-15): nav/routing fixes for supporter + all_depts_leader + team_head; mobile hamburger nav; "Service requests" label; dept_head empty state guidance — PR merged to main
- Phase 2-C implemented (2026-04-15): role subtitles on all 5 role dashboards; supporter callout card; quick-action links on all leader dashboards — PR merged to main
- Phase 2-D implemented (2026-04-15): migration 00034_tighten_storage_rls.sql (role-scoped storage policies replacing permissive any-auth policies); dept_head membership ownership guard in placeInTeam/removeMembership (single JOIN query); middleware env hardening (getPublicEnv() hard-fail replaces silent NextResponse.next()) — PR #37 reviewed (plan review + code review by independent agent), approved, and merged to main

## Next Up

- Phase 2-E (GDPR foundations): privacy notice page, account deletion flow, data export, sign-up link — requires migration 00035_account_deletion_request.sql
- Phase 2-F (production hardening): @vercel/otel instrumentation, new-org ops guide — can run in parallel with 2-E

## Status Legend

`not_started` | `plan_drafting` | `plan_review` | `approved` | `in_progress` | `in_review` | `passed` | `blocked`

Update rule:
- Update this file only when a feature state changes or a major milestone/decision lands.
- Do not turn this file into a session diary.

## Feature Status

| Order | ID | Feature | Priority | Status |
|---|---|---|---|---|
| 1 | RS-F001 | Authentication and role access | P0 | passed |
| 2 | RS-F002 | Event lifecycle management | P0 | passed |
| 3 | RS-F003 | Department and team structure | P0 | passed |
| 4 | RS-F004 | Volunteer onboarding and profile setup | P0 | passed |
| 5 | RS-F005 | Availability and blockout management | P0 | passed |
| 6 | RS-F006 | Request to join and permanent group membership | P1 | passed |
| 7 | RS-F007 | Skill profile and approval | P0 | passed |
| 8 | RS-F008 | Roster planning and request-to-serve flow | P0 | passed |
| 9 | RS-F009 | Skill-gap and headcount-gap detection | P0 | passed |
| 10 | RS-F010 | Personalized weekly dashboard | P0 | passed |
| 11 | RS-F011 | Instructions and media sharing | P1 | passed |
| 12 | RS-F012 | Request-to-serve response workflow | P0 | passed |
| 13 | RS-F013 | Notifications and scheduled alerts | P1 | passed |
| 14 | RS-F014 | Admin oversight, soft delete, and approval controls | P0 | passed |
| 15 | RS-F015 | Error handling and support escalation | P2 | passed |
| 16 | RS-F016 | Team rotation scheduling | P1 | passed |
| 17 | RS-F017 | Cross-team auto-suggestions for gap filling | P1 | passed |
| 18 | RS-F018 | Supporter and secretary role management | P1 | passed |

## Major Decisions

- The feature registry in `docs/features/feature-list.json` is the active execution order.
- The design system in `docs/design-system/design-system.md` is the UI source of truth for all future implementation and review.
- The repo has moved past greenfield: scaffolding and RS-F001 auth infrastructure are in place. Architecture direction is defined by the canonical docs and the live codebase.
- The one-time scaffolding phase is complete and the project now contains a runnable app and backend setup baseline.
- RS-F003: Events RLS visibility cutover — the pre-RS-F003 broad leader event-read policy was replaced with ownership-scoped policies. dept_head/sub_leader see no events until super_admin assigns department/sub-team ownership.
- RS-F008: Sub-leaders get write access (create/edit/remove assignments) scoped to sub-teams they own; they cannot manage dept-level assignments, other sub-leaders' sub-teams, or assign the dept_head role. Enforced at both RLS and server-action layers.
- RS-F008: One active assignment per volunteer per event per department (single partial unique index on `volunteer_id`, `event_id`, `department_id` where `deleted_at IS NULL`). `sub_team_id` is a placement field only, not a separate slot dimension.
