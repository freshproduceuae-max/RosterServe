# RosterServe Progress

Status: Canonical tracker
Last updated: 2026-04-02 (session 9)
Current phase: Feature implementation
Current build stage: RS-F008 passed; RS-F009 planning next

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

## Next Up

- RS-F009: Skill-gap detection and planning signals (P0)

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
| 3 | RS-F003 | Department and sub-team structure | P0 | passed |
| 4 | RS-F004 | Volunteer onboarding and profile setup | P0 | passed |
| 5 | RS-F005 | Availability and blockout management | P0 | passed |
| 6 | RS-F006 | Interest request management | P1 | passed |
| 7 | RS-F007 | Skill profile and approval | P0 | passed |
| 8 | RS-F008 | Roster planning and assignment management | P0 | passed |
| 9 | RS-F009 | Skill-gap detection and planning signals | P0 | not_started |
| 10 | RS-F010 | Personalized weekly dashboard | P0 | not_started |
| 11 | RS-F011 | Instructions and media sharing | P1 | not_started |
| 12 | RS-F012 | Assignment response workflow | P0 | not_started |
| 13 | RS-F013 | Notifications and scheduled alerts | P1 | not_started |
| 14 | RS-F014 | Admin oversight, soft delete, and approval controls | P0 | not_started |
| 15 | RS-F015 | Error handling and support escalation | P2 | not_started |

## Major Decisions

- The feature registry in `docs/features/feature-list.json` is the active execution order.
- The design system in `docs/design-system/design-system.md` is the UI source of truth for all future implementation and review.
- The repo has moved past greenfield: scaffolding and RS-F001 auth infrastructure are in place. Architecture direction is defined by the canonical docs and the live codebase.
- The one-time scaffolding phase is complete and the project now contains a runnable app and backend setup baseline.
- RS-F003: Events RLS visibility cutover — the pre-RS-F003 broad leader event-read policy was replaced with ownership-scoped policies. dept_head/sub_leader see no events until super_admin assigns department/sub-team ownership.
- RS-F008: Sub-leaders get write access (create/edit/remove assignments) scoped to sub-teams they own; they cannot manage dept-level assignments, other sub-leaders' sub-teams, or assign the dept_head role. Enforced at both RLS and server-action layers.
- RS-F008: One active assignment per volunteer per event per department (single partial unique index on `volunteer_id`, `event_id`, `department_id` where `deleted_at IS NULL`). `sub_team_id` is a placement field only, not a separate slot dimension.
