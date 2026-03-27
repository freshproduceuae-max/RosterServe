# RosterServe PRD

Status: Canonical
Last updated: 2026-03-27
Owner: Project Architecture

## 1. Canonical Inputs

This PRD is based on the following inputs:
- `VisionDocument_ChurchRosterApp.md` as the canonical product vision
- `docs/design-system/design-system.md` as the canonical design and UX baseline
- `CLAUDE.md` as the operating contract for documentation authority, stack direction, and sequencing rules
- The current repo structure, which is greenfield and docs-only with no application code yet
- `docs/RosteringSystem_Design_Style_Guide.md` as a secondary historical design input already normalized into the canonical design-system document

Missing or limited inputs:
- There is no implemented application, schema, or API baseline yet
- There are no additional architecture docs beyond the current operating contract

## 2. Product Definition

RosterServe is a church rostering platform that helps church leaders plan weekly programmes and helps volunteers understand when, where, and how they are serving.

The current phase is a first operational release that replaces spreadsheet, WhatsApp, and email coordination with a structured product for:
- event and roster planning
- volunteer availability and interest capture
- assignment communication and response
- instructions and media distribution
- role-based operational visibility

RosterServe is not:
- a general church management suite
- a payroll or finance tool
- a live chat or messaging platform
- a streaming or media hosting platform
- a third-party integration hub in the first release

## 3. Repo And Technical Baseline

Current repo posture:
- The repo currently contains product and design documents only
- There is no live implementation to constrain the PRD
- The PRD must therefore define a build-ready scope without assuming completed architecture

Chosen technical direction from the operating contract:
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend platform: Supabase for Postgres, Auth, Storage, Realtime, and RLS
- Deployment: Vercel
- Supporting libraries likely to be used: Zod, date-fns, and Resend or Supabase Edge Functions for email flows

PRD implication:
- Requirements should assume a web product with role-based access, relational data, storage-backed media, and a responsive UI
- Requirements must not depend on Prisma-first abstractions or any other stack that conflicts with the current documented direction

## 4. Goals

Primary goals:
- Centralize roster planning and weekly programme communication in one product
- Give volunteers a simple, role-relevant way to manage availability, interest, and assignment responses
- Give leaders a structured operational view of departments, sub-teams, assignments, and skill coverage
- Reduce missed assignments and coordination gaps by making instructions, status, and alerts visible and timely
- Preserve safety and accountability through role-based visibility, soft-delete controls, and approval flows

Secondary goals:
- Create a product foundation that can later support richer reporting, integrations, and recurring workflows
- Make the first release clear enough to plan and implement in disciplined slices

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
- Build in reviewable slices: the product should later decompose cleanly into stable features and plans

## 7. Style And Experience Baseline

The canonical design source for all future UI work is `docs/design-system/design-system.md`.

All planning, implementation, and review must preserve the following design baseline:
- one shared product design language with two role expressions
- warm, welcoming, lower-friction volunteer experiences
- calm, structured, data-rich leader experiences
- mobile-first responsive behavior with strong desktop support for planning workflows
- token-driven UI decisions for color, spacing, radius, typography, and motion

The PRD does not authorize generic framework-default UI. Any future design or implementation that conflicts with the canonical design-system document is considered drift unless the design-system document is updated first.

## 8. Primary Users

### 8.1 Super Admin / Senior Leader

Needs:
- full visibility across events, departments, sub-teams, and users
- the ability to create or remove major structure
- approval control for destructive actions and administrative oversight
- a high-level operational view of programme health

### 8.2 Department Head

Needs:
- ownership of a department within each event
- the ability to review availability, interest, skills, and assignment status
- the ability to create assignments, post instructions, and react to declines or gaps
- confidence that only relevant volunteers and approved skills are used in planning

### 8.3 Sub-Leader / Overseer

Needs:
- delegated visibility into assigned departments or sub-teams
- the ability to manage the part of the roster they are responsible for
- visibility into accepted, declined, and pending assignments for their area

### 8.4 Volunteer

Needs:
- a simple onboarding and dashboard experience
- clear visibility into upcoming service, instructions, equipment notes, and team context
- the ability to set availability, express interest, add skills, and accept or decline assignments
- confidence that they only see information relevant to them

## 9. Scope By Release Posture

### 9.1 Initial Execution Scope

The first release should support:
- email/password authentication and role-based access
- event creation and lifecycle management
- department and sub-team structure within events
- volunteer onboarding, availability, and interest capture
- skill submission and approval
- roster building and assignment management
- skill-gap detection for leaders
- personalized weekly dashboards
- instructions and media sharing
- assignment acceptance and decline flows
- notifications for assignments and key status changes
- proactive leader alerts before events
- soft-delete and admin approval controls
- friendly error handling with support escalation paths

### 9.2 Later-Phase Scope

Later phases may include:
- richer analytics and reporting
- broader admin insight dashboards
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

1. A Senior Leader or Admin creates an event and sets its status
2. Departments and sub-teams for that event are created or assigned
3. Department Heads and Sub-Leaders gain scoped visibility for planning

### 10.2 Volunteer Onboards And Signals Readiness

1. A volunteer signs in and completes onboarding prompts
2. The volunteer sets general availability and blockout or preferred service times
3. The volunteer expresses interest in departments or sub-teams
4. The volunteer may add skills for approval

### 10.3 Leaders Build The Roster

1. A Department Head reviews event structure, volunteer availability, approved skills, and prior responses
2. The leader assigns volunteers into department and sub-team roles
3. The system highlights skill gaps or staffing risk
4. The leader posts instructions and attachments relevant to assigned people

### 10.4 Volunteer Receives And Responds To Assignment

1. The volunteer receives an assignment notification
2. The volunteer opens a personalized view of the programme
3. The volunteer accepts or declines the assignment with required confirmation where applicable
4. Leaders see the updated status and respond if the roster needs adjustment

### 10.5 Ongoing Weekly Operations

1. Users open their role-specific dashboards during the week
2. Leaders monitor gaps, declines, and planning status
3. Volunteers review instructions, equipment notes, and team context
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
Description: Establish authenticated access and enforce the product's role hierarchy from the first entry point.

Requirements:
- The product must support email/password authentication for all user roles.
- The system must support the roles `super_admin`, `dept_head`, `sub_leader`, and `volunteer`, with Senior Leader authority represented within the highest-privilege administrative role model.
- Authenticated users must land in a role-appropriate application experience.
- Unauthenticated users must not access protected programme or roster data.
- Role-based visibility must match the hierarchy defined in the vision and operating contract.

Validation:
1. Sign in as each supported role and verify access to only allowed screens and data.
2. Attempt to open protected routes without a session and confirm access is denied.
3. Attempt cross-role access, such as a volunteer opening leader-only data, and confirm visibility is blocked.

### RS-F002 - Event Lifecycle Management

Priority: `P0`  
Suggested order: `2`  
Description: Allow authorized leaders to create and manage the weekly programme unit that anchors all planning.

Requirements:
- Authorized admins must be able to create, edit, and view events.
- Each event must include a title, event type, event date, status, and creator reference.
- Event status must support `draft`, `published`, and `completed`.
- Departments, sub-teams, assignments, instructions, and notifications must relate back to an event.

Validation:
1. Create an event and verify required fields are stored and visible.
2. Move an event through each allowed status and confirm invalid transitions are rejected.
3. Confirm that downstream planning records cannot exist without an event reference.

### RS-F003 - Department And Sub-Team Structure

Priority: `P0`  
Suggested order: `3`  
Description: Model the church's planning hierarchy so ownership and visibility map cleanly to the real organization.

Requirements:
- An event must support one or more departments.
- A department may contain one or more sub-teams.
- Each department and sub-team must support leader ownership assignment.
- Department Heads and Sub-Leaders must only manage the structures they are responsible for.
- Super Admin or Senior Leader users must retain cross-department visibility.

Validation:
1. Create an event with multiple departments and sub-teams and verify hierarchy rendering.
2. Sign in as a Department Head and confirm access is limited to the assigned department.
3. Sign in as a Sub-Leader and confirm access is limited to the delegated scope.

### RS-F004 - Volunteer Onboarding And Profile Setup

Priority: `P0`  
Suggested order: `4`  
Description: Give new volunteers a guided setup path that captures the minimum information needed for rostering.

Requirements:
- New volunteer users must be guided through onboarding before being treated as fully configured.
- Onboarding must collect general availability preferences, department or sub-team interest, and optional skill submissions.
- The volunteer profile must retain the information needed for rostering, including basic identifying details relevant to the role.
- Onboarding completion must lead the volunteer into a role-appropriate dashboard state.

Validation:
1. Sign in as a new volunteer and verify onboarding is shown before the main dashboard.
2. Complete onboarding and confirm availability, interests, and optional skills are stored.
3. Reopen the volunteer experience and confirm onboarding is not forced again once complete unless profile data becomes incomplete by design.

### RS-F005 - Availability And Blockout Management

Priority: `P0`  
Suggested order: `5`  
Description: Allow volunteers to express when they can serve and make that information usable in planning.

Requirements:
- Volunteers must be able to set available dates and update them over time.
- The product must support general day or time preferences and blockout-style unavailability where applicable.
- Leaders must be able to view volunteer availability within their permitted planning scope.
- Availability must be associated with the relevant volunteer and usable during roster planning.

Validation:
1. Create or update availability for a volunteer and confirm it persists.
2. Sign in as a leader with access to that volunteer's planning scope and verify availability is visible.
3. Confirm that volunteers outside the leader's scope are not exposed.

### RS-F006 - Interest Request Management

Priority: `P1`  
Suggested order: `6`  
Description: Allow volunteers to express interest in serving areas and route those requests to the appropriate leader.

Requirements:
- Volunteers must be able to express interest in departments or sub-teams.
- The system must record each interest request with a reviewable status.
- Department Heads must be able to review, approve, or reject relevant requests.
- Volunteers must be able to see the current status of their requests.

Validation:
1. Submit an interest request as a volunteer and confirm it is recorded with a pending status.
2. Review the request as the appropriate leader and change the status.
3. Confirm the volunteer sees the updated outcome and unrelated leaders do not.

### RS-F007 - Skill Profile And Approval

Priority: `P0`  
Suggested order: `7`  
Description: Track volunteer skills in a way that supports planning without trusting unreviewed claims.

Requirements:
- Leaders must be able to define skills associated with departments.
- Volunteers must be able to add skills to their profiles.
- Added skills must enter an approval workflow before they affect planning logic.
- Leaders with the right scope must be able to approve or reject submitted skills.
- Only approved skills may be used in skill-gap calculations or planning indicators.

Validation:
1. Create a department skill and add it to a volunteer profile.
2. Confirm the new skill remains pending until reviewed.
3. Approve the skill and confirm it becomes visible as approved in planning.
4. Reject or leave a skill pending and confirm it does not count toward gap coverage.

### RS-F008 - Roster Planning And Assignment Management

Priority: `P0`  
Suggested order: `8`  
Description: Give leaders a structured way to assign volunteers to events, departments, and sub-teams.

Requirements:
- Authorized leaders must be able to create assignments for volunteers within an event.
- Each assignment must link an event, department, optional sub-team, volunteer, role, status, and creator context.
- Leaders must be able to update or remove assignments within their permitted scope.
- The planning flow must expose relevant availability and approved skill context while assigning.
- Assignment removal must be treated as a high-impact action and require confirmation.

Validation:
1. Create assignments across departments and verify they are stored with the required references.
2. Edit an assignment and confirm the updated role or placement is reflected correctly.
3. Remove an assignment and confirm confirmation is required before the change is applied.

### RS-F009 - Skill-Gap Detection And Planning Signals

Priority: `P0`  
Suggested order: `9`  
Description: Surface staffing or skill coverage risk early enough for leaders to act before the event.

Requirements:
- The system must support comparing rostered or candidate coverage against required skills for a planning scope.
- Department Heads must be alerted when required skills are not sufficiently covered.
- Gap detection must use only approved skills.
- Gap states must be visible in leader planning views before the event occurs.

Validation:
1. Define a required skill scenario with insufficient approved coverage and confirm a leader-visible gap state appears.
2. Add approved coverage and confirm the gap state resolves.
3. Repeat the test with unapproved skills and confirm the gap state does not resolve incorrectly.

### RS-F010 - Personalized Weekly Dashboard

Priority: `P0`  
Suggested order: `10`  
Description: Provide each role with a weekly operational view that reflects what matters to them.

Requirements:
- Volunteers must see their upcoming assignments, instructions, team context, and relevant programme details.
- Leaders must see department or delegated planning status, roster health, declines, and open issues within their scope.
- Senior leaders or admins must be able to access a broader oversight view.
- Dashboard content must be role-specific and must not expose data outside the user's allowed visibility.
- Updates to assignment state must be reflected quickly enough to support live weekly coordination.

Validation:
1. View the dashboard as each role and verify the content differs appropriately by responsibility.
2. Change assignment status and confirm the affected dashboard reflects the new state.
3. Confirm that a volunteer cannot see unrelated departments or teams.

### RS-F011 - Instructions And Media Sharing

Priority: `P1`  
Suggested order: `11`  
Description: Let leaders publish the weekly context volunteers need in order to serve effectively.

Requirements:
- Leaders must be able to create instructions tied to an event, department, or sub-team.
- Instructions must support text content and attachment of relevant images or documents.
- Instruction visibility must be limited to the people or teams the content is meant for.
- Instruction content must support practical operational guidance within the character limits established by the vision.

Validation:
1. Publish instructions with attachments for a department or sub-team.
2. Verify assigned volunteers can view the content from their relevant dashboard or assignment view.
3. Confirm unrelated volunteers cannot access those instructions.

### RS-F012 - Assignment Response Workflow

Priority: `P0`  
Suggested order: `12`  
Description: Close the loop between assignment creation and volunteer acknowledgement.

Requirements:
- Volunteers must be able to open an assignment and respond with accept or decline actions.
- Declining an assignment must require confirmation.
- Assignment status must support `invited`, `accepted`, `declined`, and `served`.
- Leaders must be able to see response state changes quickly enough to react operationally.
- The system must support marking an assignment as served when appropriate after the event.

Validation:
1. Accept an invited assignment and confirm status changes to accepted.
2. Decline an invited assignment and confirm confirmation is required before status changes.
3. Verify leader views reflect the accepted or declined result.
4. Mark the assignment as served after the event and confirm state progression is recorded correctly.

### RS-F013 - Notifications And Scheduled Alerts

Priority: `P1`  
Suggested order: `13`  
Description: Notify the right people at the right times without creating unnecessary noise.

Requirements:
- The system must send assignment notifications to volunteers when they are assigned.
- The system must notify relevant leaders when assignments are accepted or declined.
- The system must send proactive leader alerts 2 days and 5 days before an event.
- Notification logic must respect the user's current assignment status and relevant scope.
- Notification events must be recordable for user-facing or administrative visibility.

Validation:
1. Create an assignment and confirm the volunteer receives an assignment notification.
2. Accept or decline the assignment and confirm the appropriate leader notification is triggered.
3. Simulate the scheduled alert windows and confirm alerts are generated at the required offsets.
4. Confirm notifications are not sent for stale or invalid assignment states.

### RS-F014 - Admin Oversight, Soft Delete, And Approval Controls

Priority: `P0`  
Suggested order: `14`  
Description: Preserve accountability and recoverability for high-impact changes.

Requirements:
- All deletions must be soft deletions first.
- Permanent deletion must require an admin approval path.
- Super Admin or Senior Leader users must be able to review and act on pending destructive changes.
- Soft-deleted records must be removed from normal operational views while still remaining reviewable by authorized admins.
- High-impact administrative actions must be traceable enough to support oversight.

Validation:
1. Delete a department, sub-team, or event candidate and confirm it enters a pending state instead of being permanently removed.
2. Review the pending deletion as an authorized admin and confirm approval is required for permanent removal.
3. Confirm normal planning views no longer treat the soft-deleted item as active.

### RS-F015 - Error Handling And Support Escalation

Priority: `P2`  
Suggested order: `15`  
Description: Keep failures understandable and recoverable for church teams using the system during live operations.

Requirements:
- User-facing errors must use calm, human language consistent with the design system and vision.
- Error states must provide a clear next step where possible.
- Error states must offer a path to contact the relevant leader or department head via WhatsApp link where applicable.
- Error states must offer a bug-report path for developer follow-up.
- Failure states must not expose protected data or break role-based boundaries.

Validation:
1. Trigger a recoverable error and confirm the UI shows a human-readable message and next step.
2. Confirm the error state includes the expected support or contact path.
3. Confirm technical failure details are not exposed to unauthorized users.

## 12. Hard Acceptance Conditions

The implementation is not acceptable unless all of the following remain true:
- The product preserves the canonical church rostering use case and does not drift into a generic workforce tool
- The canonical design-system document remains the visual and interaction source of truth
- Volunteer experiences feel warm and approachable while leader experiences feel calm and structured
- The product works on both mobile and desktop
- Role-based visibility is enforced consistently across data and UI
- Volunteers cannot see departments, sub-teams, or contact details outside their allowed context
- All destructive or high-impact actions require confirmation
- All deletions follow soft-delete and admin approval rules before permanent removal
- Only approved skills count in planning and gap detection
- Assignment status progression remains controlled and observable
- Leaders receive enough planning visibility to detect declines and gaps before the event
- Notifications do not fire without checking relevant assignment state
- Error handling includes a friendly support path and bug-report option

## 13. Notes For The Next Planning Step

This PRD is intended to drive the canonical feature list next.

The functional requirement IDs already use the established `RS-F###` convention so they can map directly into the next documentation layer without renumbering.
