# RosterServe Progress

Status: Canonical tracker
Last updated: 2026-03-28
Current phase: Feature implementation
Current build stage: RS-F003 merged; RS-F004 plan in review

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
- RS-F004 plan created; under Codex review

## Next Up

- RS-F004 plan approval before implementation begins

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
| 4 | RS-F004 | Volunteer onboarding and profile setup | P0 | plan_review |
| 5 | RS-F005 | Availability and blockout management | P0 | not_started |
| 6 | RS-F006 | Interest request management | P1 | not_started |
| 7 | RS-F007 | Skill profile and approval | P0 | not_started |
| 8 | RS-F008 | Roster planning and assignment management | P0 | not_started |
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
- RS-F003: Sub-leaders are read-only in this feature slice. "Manage the structures they are responsible for" deferred to RS-F008+ where sub-leaders act within their sub-team context.
- RS-F003: Events RLS visibility cutover — the pre-RS-F003 broad leader event-read policy was replaced with ownership-scoped policies. dept_head/sub_leader see no events until super_admin assigns department/sub-team ownership.
