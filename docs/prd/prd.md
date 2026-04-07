# RosterServe PRD

Status: Canonical
Last updated: 2026-04-07 — role hierarchy expanded, permanent group membership model added, team rotation added, request-to-serve flow, skills model broadened, new features RS-F016–RS-F018 added
Owner: Project Architecture

## 1. Canonical Inputs

This PRD is based on the following inputs:
- `VisionDocument_ChurchRosterApp.md` as the canonical product vision (revised 2026-04-07)
- `docs/design-system/design-system.md` as the canonical design and UX baseline
- `CLAUDE.md` as the operating contract for documentation authority, stack direction, and sequencing rules

## 2. Product Definition

RosterServe is a church rostering platform that helps church leaders plan weekly programmes and helps volunteers understand when, where, and how they are serving.

The current phase is a first operational release that replaces spreadsheet, WhatsApp, and email coordination with a structured product for:
- event and roster planning
- permanent volunteer group membership within departments
- request-to-serve confirmation flows
- skill management and gap detection
- instructions and media distribution
- role-based operational visibility

RosterServe is not:
- a general church management suite
- a payroll or finance tool
- a live chat or messaging platform
- a streaming or media hosting platform
- a third-party integration hub in the first release

## 3. Repo And Technical Baseline

Chosen technical direction:
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend platform: Supabase for Postgres, Auth, Storage, Realtime, and RLS
- Deployment: Vercel
- Supporting libraries: Zod, date-fns, Resend or Supabase Edge Functions for email flows

## 4. Goals

Primary goals:
- Centralize roster planning and weekly programme communication in one product
- Give volunteers a simple way to join departments, belong to named teams, and confirm service requests
- Give leaders a structured operational view of departments, teams, assignments, skill coverage, and headcount
- Surface non-confirmations and gaps early enough for leaders to act before the event
- Preserve safety and accountability through role-based visibility, soft-delete controls, and approval flows

Secondary goals:
- Support team rotation scheduling so departments can alternate teams across weekly events
- Provide analytics-driven auto-suggestions for cross-team gap filling
- Create a product foundation that can later support richer reporting, integrations, and recurring workflows

## 5. Non-Goals

The initial execution scope does not include:
- payroll or financial tracking
- live chat or full messaging
- live video or streaming
- third-party integrations such as Planning Center or ChurchSuite
- automated recurring special-event scheduling for Easter, Good Friday, or similar programmes
- WhatsApp integration beyond linking users to manual contact paths in error states
- a fully generic multi-industry workforce management platform

## 6. Product Principles

- Role relevance over information overload: each user should primarily see what is actionable for their role
- Warm for volunteers, calm for leaders: the product must balance encouragement with operational clarity
- Structured planning over side-channel coordination: assignments, instructions, and statuses belong in the system of record
- Safe operations by default: destructive and high-impact actions require confirmation and deletion never bypasses approval
- Approved data over assumed data: only approved skills count in planning decisions
- Visibility follows responsibility: users should not gain access outside the scope defined by the role hierarchy
- Permanent membership over per-event re-invitation: volunteers belong to named groups that persist; events pull from those groups
- Build in reviewable slices: the product should later decompose cleanly into stable features and plans

## 7. Style And Experience Baseline

The canonical design source for all future UI work is `docs/design-system/design-system.md`.

All planning, implementation, and review must preserve the following design baseline:
- one shared product design language with two role expressions
- warm, welcoming, lower-friction volunteer experiences
- calm, structured, data-rich leader experiences
- mobile-first responsive behavior with strong desktop support for planning workflows
- token-driven UI decisions for color, spacing, radius, typography, and motion

## 8. Primary Users

### 8.1 Super Admin

Needs:
- full visibility across all events, departments, teams, and users
- the ability to create, edit, and remove any structure
- approval control for permanent deletions and admin oversight
- a high-level stats and reporting dashboard
- the ability to grant or revoke event-creation access for Dept Heads and Team Heads
- bulk skill upload via template or manual entry

### 8.2 All Departments Leader

Needs:
- visibility and operational control across all their assigned departments
- the ability to create events, add departments, add skills, and add Team Heads within their scope
- the same planning and assignment capabilities as a Dept Head, applied across all departments they oversee
- a dashboard showing planning health, skill gaps, headcount coverage, and non-confirmations across their departments

### 8.3 Department Head

Needs:
- ownership and full control of their department and all teams within it
- the ability to select which team (A, B, C) serves each event — manually or via automatic rotation
- the ability to set headcount requirements per team per event type
- visibility into team member confirmations and non-confirmations for each event
- the ability to approve, edit, or remove volunteer skill claims within their department
- the ability to approve volunteer requests to join their department (creating permanent group membership)
- the ability to place approved volunteers into named teams within their department
- the ability to add instructions and media per event, department, or team

### 8.4 Team Head

Needs:
- ownership of their named team within a department
- visibility into their team members' confirmation status for each event they are selected for
- the ability to approve, edit, or remove volunteer skill claims for their team
- clear assignment within their department hierarchy — always under a Dept Head unless moved

### 8.5 Supporter / Secretary

Needs:
- to act on behalf of their assigned leader across all that leader's permitted actions
- access mirroring their assigned leader's role (Dept Head level, Team Head level, etc.)
- no admin-level access regardless of who they are assigned to

### 8.6 Volunteer

Needs:
- a simple onboarding experience that leads to requesting to join departments
- permanent group membership in a named team after their request is approved
- clear visibility into upcoming service requests, their team context, and instructions
- the ability to confirm or decline a request to serve, with confirmation required on decline
- the ability to add skills (pending approval), set availability, and manage their profile
- confidence that they only see information relevant to them

## 9. Scope By Release Posture

### 9.1 Initial Execution Scope

The first release should support:
- email/password authentication and role-based access for all six roles
- event creation and lifecycle management (Super Admin and All Departments Leader by default; others by grant)
- department and team structure with permanent volunteer group membership
- named team rotation support (Team A, B, C) with manual or automatic rotation scheduling
- headcount requirements per team per event type
- volunteer onboarding, availability, and request-to-serve interest capture
- skill submission and approval (Dept Head and Team Head can both approve/edit/remove)
- bulk skill upload via admin template
- roster confirmation flow (request to serve → Team Head confirms → volunteers confirm individually)
- cross-team auto-suggestions for gap filling based on skill match and availability analytics
- skill-gap and headcount-gap detection for leaders
- personalized weekly dashboards per role with cascading visibility
- instructions and media sharing per event, department, or team
- request-to-serve confirmation and decline flows
- notifications for requests to serve, confirmations, declines, and key status changes
- proactive leader alerts before events
- soft-delete and admin approval controls
- friendly error handling with support escalation paths

### 9.2 Later-Phase Scope

Later phases may include:
- richer analytics and reporting
- deeper recurring planning automation
- third-party integrations
- broader communications tooling

### 9.3 Explicitly Deferred

Deferred from the first release:
- WhatsApp integration
- real-time chat as a first-class feature
- payroll or finance tooling
- streaming/video support
- automated special-event recurrence
- external church-management platform sync

## 10. Core Workflows

### 10.1 Leader Creates And Prepares An Event

1. Super Admin or All Departments Leader creates an event and sets its status
2. Dept Head selects which team (A, B, C) serves this event — manually or via rotation schedule
3. Dept Head sends a request to serve to the selected team
4. Team Head receives the request and confirms (yes/no)
5. Each volunteer under that Team Head also confirms individually (yes/no)
6. Volunteers directly under the Dept Head (no Team Head) confirm directly
7. Non-confirmations are highlighted on the Dept Head dashboard for action

### 10.2 Volunteer Joins A Department

1. Volunteer signs in and completes onboarding
2. Volunteer submits a request to join a department
3. Dept Head reviews and approves or rejects the request
4. On approval, volunteer becomes a permanent member of that department
5. Dept Head optionally places the volunteer into a named team (Team A, B, C, or a standalone team)
6. Permanent membership persists across all future events

### 10.3 Gap Filling And Auto-Suggestions

1. A team member or Team Head cannot confirm for a specific event
2. The non-confirmation is highlighted on the Dept Head dashboard
3. The system suggests available members from other teams within the same department based on skill match and availability analytics
4. Dept Head reviews suggestions and manually confirms replacements
5. If no replacement is available from permanent members, Dept Head may consider external interest requests

### 10.4 Volunteer Confirms Or Declines

1. Volunteer receives a request to serve notification
2. Volunteer opens their dashboard and sees the request with event, team, and role context
3. Volunteer confirms or declines (decline requires confirmation dialog)
4. Dept Head and Team Head see the updated status in real time

### 10.5 Ongoing Weekly Operations

1. Users open their role-specific dashboards during the week
2. Leaders monitor gaps, non-confirmations, and planning health
3. Volunteers review instructions, team context, and upcoming service
4. The system sends scheduled alerts ahead of the event

### 10.6 Administrative Safety And Cleanup

1. A privileged user attempts a destructive change
2. The system requires confirmation
3. The item enters an admin approval path before permanent deletion
4. The approved state is reflected across normal views

## 11. Functional Requirements

Priority scale:
- `P0`: required for the first usable release
- `P1`: important for release completeness but follows the core path
- `P2`: important operational hardening that can follow after the primary flow is complete

### RS-F001 - Authentication And Role Access

Priority: `P0`
Suggested order: `1`
Description: Establish authenticated access and enforce the product's expanded role hierarchy from the first entry point.

Scope note: RS-F001 delivers the structural role/access foundation — enum, auth typing, route guards, baseline RLS, and role entry points. Supporter permission mirroring is owned by RS-F018. Event-creation grant is owned by RS-F002. Those behaviors are deliberately excluded from RS-F001 validation.

Requirements:
- The product must support email/password authentication for all user roles.
- The system must support six roles: `super_admin`, `all_depts_leader`, `dept_head`, `team_head`, `supporter`, and `volunteer`.
- Authenticated users must land in a role-appropriate application experience.
- Unauthenticated users must not access protected programme or roster data.
- Role-based visibility must cascade correctly using a role rank; higher-ranked roles have access to data within their structural scope.
- The `supporter` role must be stored in the database and routed to a dashboard stub; delegated permission mirroring is implemented in RS-F018.
- The `all_depts_leader` role must be stored and routed; cross-department read scope is established in RS-F003.

Validation:
1. Sign in as each of the six roles and verify access to only allowed screens and data within structural scope.
2. Attempt to open protected routes without a session and confirm access is denied.
3. Attempt cross-role access and confirm visibility is blocked at both UI and data layers.
4. Confirm `npm run typecheck`, `npm run lint`, and `npm run build` all pass with zero errors.
5. Confirm `npx supabase db reset` applies all migrations without error.
6. Confirm no TypeScript file references the removed `sub_leader` role string.

### RS-F002 - Event Lifecycle Management

Priority: `P0`
Suggested order: `2`
Description: Allow authorized leaders to create and manage the weekly programme unit that anchors all planning.

Requirements:
- Super Admin and All Departments Leaders must be able to create, edit, and view events by default.
- Dept Heads and Team Heads may create events only if explicitly granted access by Super Admin.
- Each event must include a title, event type, event date, status, and creator reference.
- Event status must support `draft`, `published`, and `completed`.
- Departments, teams, assignments, instructions, and notifications must relate back to an event.

Validation:
1. Create an event as Super Admin and All Departments Leader — confirm both succeed.
2. Attempt to create an event as a Dept Head without grant — confirm it is blocked.
3. Grant event-creation access to a Dept Head and confirm they can now create events.
4. Move an event through each allowed status and confirm invalid transitions are rejected.

### RS-F003 - Department And Team Structure

Priority: `P0`
Suggested order: `3`
Description: Model the church's planning hierarchy so ownership, team membership, and visibility map cleanly to the real organization.

Requirements:
- A department must support one or more named teams.
- A team is a named group independent of whether a Team Head is assigned to it.
- A team may have zero or one Team Head; a Team Head is optional.
- Each team may have an optional rotation label (e.g. A, B, C) for rotation scheduling.
- Each team may have a headcount requirement per event type set by the Dept Head or All Departments Leader.
- Volunteers directly under a Dept Head with no team assignment are valid and report to the Dept Head.
- Team Heads always belong to a department under a Dept Head unless moved or removed by an authorized leader.
- Super Admin and All Departments Leaders retain cross-department visibility.

Validation:
1. Create a department with multiple named teams, some with Team Heads and some without.
2. Confirm a team with no Team Head is valid and its members report to the Dept Head.
3. Set a headcount requirement on a team and verify it is stored and visible in planning.
4. Assign rotation labels to teams and confirm they are stored correctly.
5. Sign in as a Dept Head and confirm access is limited to their department.
6. Sign in as a Team Head and confirm access is limited to their team.

### RS-F004 - Volunteer Onboarding And Profile Setup

Priority: `P0`
Suggested order: `4`
Description: Give new volunteers a guided setup path that leads to requesting department membership.

Requirements:
- New volunteer users must be guided through onboarding before being treated as fully configured.
- Onboarding must collect general availability preferences, department interest (as a request to join), and optional skill submissions.
- The volunteer profile must retain the information needed for rostering.
- Onboarding completion must lead the volunteer into their role-appropriate dashboard.

Validation:
1. Sign in as a new volunteer and verify onboarding is shown before the main dashboard.
2. Complete onboarding and confirm availability, department interest requests, and optional skills are stored.
3. Reopen the volunteer experience and confirm onboarding is not forced again once complete.

### RS-F005 - Availability And Blockout Management

Priority: `P0`
Suggested order: `5`
Description: Allow volunteers to express when they can serve and make that information usable in planning and auto-suggestions.

Requirements:
- Volunteers must be able to set available dates and update them over time.
- The product must support general day or time preferences and blockout-style unavailability.
- Leaders must be able to view volunteer availability within their permitted scope.
- Availability data must be usable in cross-team auto-suggestion logic for gap filling.

Validation:
1. Create or update availability for a volunteer and confirm it persists.
2. Sign in as a leader and verify availability is visible within their permitted scope.
3. Confirm that volunteers outside the leader's scope are not exposed.

### RS-F006 - Request To Join And Permanent Group Membership

Priority: `P1`
Suggested order: `6`
Description: Allow volunteers to request to join departments and create permanent group membership on approval.

Requirements:
- Volunteers must be able to submit a request to join a department.
- The system must record each request with a reviewable status (`pending`, `approved`, `rejected`).
- Dept Heads must be able to review, approve, or reject relevant requests.
- On approval, the volunteer must become a permanent member of that department.
- The Dept Head must then be able to optionally place the approved volunteer into a named team within the department.
- Permanent membership must persist across all events — leaders always see their group members regardless of whether an event is active.
- Volunteers must be able to see the current status of their requests.

Validation:
1. Submit a request to join a department and confirm it is recorded as pending.
2. Approve the request as the Dept Head and confirm the volunteer appears as a permanent member of the department.
3. Place the volunteer into a team and confirm they appear under that team.
4. Confirm the membership is visible to the Dept Head and Team Head outside of any specific event.
5. Reject a request and confirm the volunteer is not added to the department.

### RS-F007 - Skill Profile And Approval

Priority: `P0`
Suggested order: `7`
Description: Track volunteer skills in a way that supports planning without trusting unreviewed claims.

Requirements:
- Super Admin must be able to define skills via manual entry or bulk template upload.
- Volunteers must be able to add skills to their profiles (pending approval).
- Both Dept Heads and Team Heads must be able to approve, edit, or remove volunteer skill claims within their scope.
- Only approved skills may be used in skill-gap calculations or planning indicators.
- Skills are associated with departments; a skill defined for a department applies to all teams within it.

Validation:
1. Upload skills via admin template and confirm they are created correctly.
2. Add a skill to a volunteer profile and confirm it remains pending.
3. Approve the skill as both a Dept Head and a Team Head — confirm both can act on it.
4. Confirm only approved skills count in gap calculations.
5. Edit and remove a skill claim as a Dept Head — confirm the change is applied.

### RS-F008 - Roster Planning And Request-To-Serve Flow

Priority: `P0`
Suggested order: `8`
Description: Give Dept Heads a structured way to select teams for events and send requests to serve to their members.

Requirements:
- Dept Heads must be able to select which team (by rotation label or manually) serves a given event.
- The system must send a request to serve to the selected Team Head and all team members.
- Team Heads must be able to confirm or decline their team's request to serve.
- Volunteers must be able to confirm or decline their individual request to serve.
- If a Team Head declines, the Dept Head must be able to assign a Team Head from another team for that event.
- Non-confirmations must be highlighted on the Dept Head dashboard.
- Assignment removal must be treated as a high-impact action and require confirmation.

Validation:
1. Select a team for an event and confirm requests to serve are sent to Team Head and all members.
2. Confirm as a Team Head and as a volunteer — verify status updates are reflected.
3. Decline as a Team Head — confirm the Dept Head is alerted and can assign a substitute.
4. Remove an assignment and confirm confirmation is required before the change is applied.

### RS-F009 - Skill-Gap Detection And Planning Signals

Priority: `P0`
Suggested order: `9`
Description: Surface staffing, skill, and headcount coverage risk early enough for leaders to act.

Requirements:
- The system must compare confirmed coverage against required skills and headcount for each team per event.
- Dept Heads must be alerted when required skills are not sufficiently covered.
- Dept Heads must be alerted when confirmed headcount is below the team's required headcount for the event type.
- Gap detection must use only approved skills.
- Gap and headcount states must be visible in leader planning views before the event occurs.

Validation:
1. Define a required skill with insufficient approved coverage and confirm a gap state appears.
2. Add approved coverage and confirm the gap resolves.
3. Set a headcount requirement and confirm a headcount gap appears when confirmed count is below it.
4. Confirm unapproved skills do not resolve gap states.

### RS-F010 - Personalized Weekly Dashboard

Priority: `P0`
Suggested order: `10`
Description: Provide each role with a weekly operational view that reflects what matters to them.

Requirements:
- Volunteers must see their upcoming service requests, team context, confirmation status, and instructions.
- Team Heads must see their team's confirmation status and any skill or headcount gaps for their team.
- Dept Heads must see all teams' confirmation status, skill gaps, headcount gaps, and non-confirmations within their department.
- All Departments Leaders must see planning health across all their departments.
- Super Admins must see a broader oversight view with event-level stats.
- Dashboard content must be role-specific and must not expose data outside the user's allowed visibility.
- Non-confirmations must be visually highlighted for leaders.

Validation:
1. View the dashboard as each role and verify content differs appropriately by responsibility.
2. Confirm a non-confirming member is highlighted on the Dept Head and Team Head dashboards.
3. Confirm a volunteer cannot see unrelated departments, teams, or members.

### RS-F011 - Instructions And Media Sharing

Priority: `P1`
Suggested order: `11`
Description: Let leaders publish the weekly context volunteers need in order to serve effectively.

Requirements:
- Leaders must be able to create instructions tied to an event, department, or team.
- Instructions must support text content and attachment of images or documents.
- Instruction visibility must be limited to the people or teams the content is meant for.
- Instruction content must support practical operational guidance within the character limits in the vision.

Validation:
1. Publish instructions with attachments for a department or team.
2. Verify assigned volunteers can view the content from their dashboard.
3. Confirm unrelated volunteers cannot access those instructions.

### RS-F012 - Request-To-Serve Response Workflow

Priority: `P0`
Suggested order: `12`
Description: Close the loop between a request to serve and volunteer or Team Head confirmation.

Requirements:
- Volunteers must be able to confirm or decline a request to serve.
- Team Heads must be able to confirm or decline their team's request to serve.
- Declining must require a confirmation dialog.
- Assignment status must support `requested`, `confirmed`, `declined`, and `served`.
- Leaders must be able to see response state changes quickly enough to react operationally.

Validation:
1. Confirm a request to serve as a volunteer — verify status changes to confirmed.
2. Decline a request — confirm a confirmation dialog is shown before the status changes.
3. Confirm as a Team Head — verify it is reflected on the Dept Head dashboard.
4. Mark an assignment as served after the event and confirm state progression is recorded.

### RS-F013 - Notifications And Scheduled Alerts

Priority: `P1`
Suggested order: `13`
Description: Notify the right people at the right times without creating unnecessary noise.

Requirements:
- The system must send a notification when a request to serve is issued.
- The system must notify relevant leaders when a request is confirmed or declined.
- The system must send proactive leader alerts 2 days and 5 days before an event.
- Notification logic must respect current assignment status and relevant scope.

Validation:
1. Issue a request to serve and confirm the recipient receives a notification.
2. Confirm or decline and verify the appropriate leader notification fires.
3. Simulate the 2-day and 5-day alert windows and confirm alerts generate correctly.
4. Confirm notifications are not sent for stale or invalid states.

### RS-F014 - Admin Oversight, Soft Delete, And Approval Controls

Priority: `P0`
Suggested order: `14`
Description: Preserve accountability and recoverability for high-impact changes.

Requirements:
- All deletions must be soft deletions first.
- Permanent deletion must require a Super Admin approval path.
- Soft-deleted records must be removed from normal operational views while remaining reviewable by admins.
- High-impact administrative actions must be traceable.

Validation:
1. Delete a department, team, or event and confirm it enters a pending soft-delete state.
2. Review as Super Admin and confirm approval is required for permanent removal.
3. Confirm normal views no longer show the soft-deleted item as active.

### RS-F015 - Error Handling And Support Escalation

Priority: `P2`
Suggested order: `15`
Description: Keep failures understandable and recoverable for church teams during live operations.

Requirements:
- User-facing errors must use calm, human language consistent with the design system.
- Error states must provide a clear next step where possible.
- Error states must offer a WhatsApp contact path to the relevant leader.
- Error states must offer a bug-report path for developer follow-up.
- Failure states must not expose protected data or break role boundaries.

Validation:
1. Trigger a recoverable error and confirm a human-readable message and next step appear.
2. Confirm the error state includes the expected support path.
3. Confirm technical details are not exposed to unauthorized users.

### RS-F016 - Team Rotation Scheduling

Priority: `P1`
Suggested order: `16`
Description: Allow Dept Heads to schedule team rotation across recurring events automatically or manually.

Requirements:
- Dept Heads and All Departments Leaders must be able to assign rotation labels (e.g. A, B, C) to teams within a department.
- The system must support automatic rotation — cycling through teams in label order across consecutive events of the same type.
- Dept Heads must also be able to manually override rotation and select a specific team for any event.
- The rotation schedule must be visible on the Dept Head dashboard.

Validation:
1. Assign rotation labels to three teams and enable automatic rotation.
2. Create three consecutive events of the same type and confirm teams are assigned in rotation order.
3. Override rotation for one event and confirm the manual selection takes effect without disrupting the rotation sequence for subsequent events.

### RS-F017 - Cross-Team Auto-Suggestions For Gap Filling

Priority: `P1`
Suggested order: `17`
Description: When a team member cannot confirm, surface available members from other teams as suggested replacements.

Requirements:
- When a team member or Team Head declines or does not confirm, the system must generate a ranked list of suggested replacements from other teams in the same department.
- Suggestions must be based on skill match against the team's required skills and volunteer availability.
- Suggestions must only include permanent members of the department who are not already assigned to that event.
- Dept Heads must be able to review and act on suggestions — accepting a suggestion creates an assignment for that volunteer.
- Auto-suggestions must not automatically assign anyone; all suggestions require Dept Head confirmation.

Validation:
1. Create a gap by having a team member decline and confirm auto-suggestions appear on the Dept Head dashboard.
2. Verify suggestions are ranked by skill match and availability.
3. Confirm suggestions do not include volunteers already assigned to the event.
4. Accept a suggestion and confirm the assignment is created with Dept Head confirmation recorded.

### RS-F018 - Supporter / Secretary Role Management

Priority: `P1`
Suggested order: `18`
Description: Allow leaders to delegate operational access to a supporter who acts on their behalf.

Requirements:
- A Super Admin must be able to assign a Supporter to a specific leader (Dept Head, Team Head, or All Departments Leader).
- A Supporter must have the same operational permissions as their assigned leader, excluding admin-level access.
- A Supporter must be explicitly linked to one leader at a time.
- The system must clearly indicate in audit trails and visible contexts that an action was performed by a Supporter on behalf of their leader.

Validation:
1. Assign a Supporter to a Dept Head and confirm the Supporter can perform all Dept Head actions.
2. Confirm the Supporter cannot access admin functions (permanent deletion, user management, bulk skill upload).
3. Confirm actions taken by the Supporter are attributed correctly in audit context.

## 12. Hard Acceptance Conditions

The implementation is not acceptable unless all of the following remain true:
- The product preserves the canonical church rostering use case and does not drift into a generic workforce tool
- The canonical design-system document remains the visual and interaction source of truth
- Volunteer experiences feel warm and approachable while leader experiences feel calm and structured
- The product works on both mobile and desktop
- Role-based visibility is enforced consistently across data and UI for all six roles
- Volunteers cannot see departments, teams, or contact details outside their allowed context
- Permanent group membership persists across events and is never reset by event-level actions
- All destructive or high-impact actions require confirmation
- All deletions follow soft-delete and admin approval rules before permanent removal
- Only approved skills count in planning and gap detection
- Headcount requirements are visible and factored into gap signals
- Request-to-serve status progression remains controlled and observable
- Auto-suggestions never automatically assign anyone — Dept Head confirmation is always required
- Leaders receive enough planning visibility to detect non-confirmations and gaps before the event
- Notifications do not fire without checking relevant assignment state
- Error handling includes a friendly support path and bug-report option

## 13. Impacted Features — Revision Required

The following already-built features require revision plans before their implementations are considered complete against this PRD:

| Feature | Revision needed |
|---|---|
| RS-F001 | Add `all_depts_leader`, `team_head`, `supporter` roles; update RLS and route guards. Scope: structural foundation only — Supporter mirroring in RS-F018, event-creation grant in RS-F002. |
| RS-F002 | Restrict event creation to Super Admin + All Departments Leader by default; add grant mechanism |
| RS-F003 | Rename sub-teams to teams; add rotation labels, headcount requirements, permanent membership model |
| RS-F006 | Change outcome of approval to create permanent group membership; add team placement step |
| RS-F007 | Add Team Head as an approver/editor/remover of volunteer skills |
| RS-F008 | Replace individual assignment creation with request-to-serve team selection flow |
| RS-F009 | Add headcount gap detection alongside skill gap detection |
| RS-F010 | Update dashboards for new roles and permanent membership visibility |

New features to plan and implement in order after existing revisions:
- RS-F016: Team Rotation Scheduling
- RS-F017: Cross-Team Auto-Suggestions
- RS-F018: Supporter / Secretary Role Management
