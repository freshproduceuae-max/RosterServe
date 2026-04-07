# RosterServe — Vision Document

**Created:** March 26, 2026
**Last revised:** 2026-04-07 (rev 2) — team rotation model added (Team A/B/C), cross-team gap filling with auto-suggestions, terminology corrected (request to serve, not invitation)
**Status:** Active — revised

---

## 1. The Problem

**Target User:** Timmy, 25, real estate agent — busy, irregular schedule, volunteers at church across multiple departments
**Their Problem:** No structured way to communicate roster assignments, role-specific instructions, skill requirements, or weekly programme details. Volunteers forget assignments, leaders struggle to track who's available and whether they have the right skills.
**Current Workaround:** Manual coordination via spreadsheets, WhatsApp messages, and general email blasts — no structure, no skill matching, no accountability trail.

---

## 2. The Solution

**What It Does:** A church rostering platform that matches volunteers to roles based on skills and availability, delivers targeted weekly instructions to each person, and gives every level of leadership a clear real-time view of planning health.
**Why It's Better:** Instead of chasing people on WhatsApp, leaders build the roster in one place, the system checks skill gaps automatically, volunteers confirm with one tap, and everyone — from the Senior Leader to the newest volunteer — sees exactly what's relevant to them on their own personalised dashboard.

---

## 3. Core Features (Version 1)

| # | Feature | Description |
|---|---------|-------------|
| 1 | Availability & Interest Setting | Volunteers set available dates and express interest in departments via onboarding prompts and ongoing dashboard |
| 2 | Permanent Group Membership | Interest approval places a volunteer permanently into a department group (e.g. Team A, B, or C); membership means they belong to that group and can be assigned to future events — it does not mean they are automatically on every event |
| 3 | Team Rotation Scheduling | A department can have multiple teams (Team A, Team B, Team C); rotation can be automatic (system alternates teams across weeks) or manual (Dept Head selects which team serves each event) |
| 4 | Roster Confirmation & Gap Filling | Dept Head sends a request to serve to the selected team for an event; members confirm individually; non-confirmations are highlighted; if a Team Head declines, Dept Head can select a Team Head from another team; system auto-suggests replacements from other teams based on skill match and availability analytics |
| 5 | Skill Management & Gap Detection | Skills defined by admins/leaders; volunteers declare their skills; leaders at all levels compare coverage against requirements |
| 6 | Weekly Programme Dashboard | Each user sees their personalised weekly view — assignments, instructions, team context, planning health |
| 7 | Instructions & Media Sharing | Leaders post weekly notes, images, documents, and custom messages per department or team |
| 8 | Notifications & Alerts | Notifications on request to serve, confirmation, decline; proactive alerts to leaders 2 and 5 days before events |

**Main User Flow:**
1. Super Admin or All Departments Leader creates an event
2. Dept Head selects which team (e.g. Team A, Team B, Team C) is rostered for this event based on their rotation schedule
3. Dept Head sends a request to serve to the selected team — Team Head receives it and confirms (yes/no)
4. Each volunteer under that Team Head also receives a request to serve and confirms individually (yes/no)
5. Volunteers directly under the Dept Head (no Team Head) receive a request to serve and confirm directly to the Dept Head
6. Non-confirming Team Heads and volunteers are highlighted on the Dept Head's dashboard
7. Where gaps exist, the system auto-suggests available members from other teams within the same department based on skill match and past availability analytics
8. Dept Head reviews skill coverage and headcount against requirements — system surfaces remaining gaps after auto-fill suggestions
9. Dept Head adds weekly instructions and uploads media/documents
10. Volunteers see their roster, team members, instructions, and timeline on their personal dashboard
11. A volunteer not yet in a department can submit a request to serve — goes to Dept Head for review and, if approved, creates permanent membership

**Deferred to Later:**
- Full WhatsApp integration
- Live chat (v1 has comments/notes only)
- Payroll or financial tracking
- Live video/streaming
- Third-party integrations (Planning Center, ChurchSuite)
- Full recurring event automation for special days (Easter, Good Friday, etc.)

---

## 4. Data Model

**Entities:** User, Event, Department, Team, Team Membership, Assignment, Skill, Department Skill Requirement, Volunteer Skill, Instruction, Media/Document, Notification, Availability, Interest Request, Supporter Link

**Event Fields:**
| Field | Description |
|-------|-------------|
| event_id | Unique identifier |
| title | Name of the event (e.g., "Sunday Service – April 6") |
| event_type | Regular / Ad-hoc / Special Day |
| date | Date of the event |
| status | Draft → Published → Completed |
| created_by | Super Admin or All Departments Leader user ID |

**Team Fields:**
| Field | Description |
|-------|-------------|
| team_id | Unique identifier |
| department_id | Parent department |
| name | Team name (e.g. "Sound Team", "Team A", "Team B") — independent of whether a Team Head exists |
| team_head_id | Optional — null if no Team Head assigned |
| rotation_label | Optional — e.g. "A", "B", "C" for rotation scheduling within the same department |
| required_headcount | Optional per event type — minimum number of people needed |

**Team Membership Fields (permanent):**
| Field | Description |
|-------|-------------|
| membership_id | Unique identifier |
| volunteer_id | The volunteer |
| department_id | Their permanent department |
| team_id | Optional — their team within the department (null if reporting directly to Dept Head) |
| created_by | Dept Head who approved the membership |

**Assignment Fields:**
| Field | Description |
|-------|-------------|
| assignment_id | Unique identifier |
| event_id | Linked event |
| department_id | Linked department |
| team_id | Linked team (optional) |
| volunteer_id | Linked user |
| role | Team Head / Volunteer |
| status | Invited → Accepted → Declined → Served |

**Skill Fields:**
| Field | Description |
|-------|-------------|
| skill_id | Unique identifier |
| name | Skill name |
| department_id | Department this skill is associated with |
| created_by | Admin (via upload or manual entry) |

**Volunteer Skill Fields:**
| Field | Description |
|-------|-------------|
| volunteer_skill_id | Unique identifier |
| volunteer_id | The volunteer |
| skill_id | The declared skill |
| status | Pending → Approved / Rejected |
| reviewed_by | Dept Head or Team Head who acted on it |

**Department Skill Requirement Fields:**
| Field | Description |
|-------|-------------|
| requirement_id | Unique identifier |
| department_id | The department |
| team_id | Optional — scoped to a specific team |
| skill_id | Required skill |
| is_required | Boolean |

**Status Flow:** Invited → Accepted → Declined → Served
**Soft Delete:** All deletions are pending admin approval before permanent removal

---

## 5. Users & Access

**Authentication:** Email and password
**Data Visibility:** Cascading — each role sees everything directly beneath them in the hierarchy; volunteers see only their own context

### Role Hierarchy

| Role | Event Creation | Department / Team Management | Skill Management | Roster / Assignment | Notes |
|------|---------------|------------------------------|-----------------|---------------------|-------|
| **Super Admin** | Yes | Full system | Add skills (manual or template upload); all approvals | Full | Full visibility; stats dashboard; permanent deletion approval |
| **All Departments Leader** | Yes | Add departments, add Team Heads, manage all their departments | Add skills; approve/edit/remove volunteer skills | Full across their departments | Inherits all Dept Head permissions across their scope |
| **Department Head** | No (unless granted by admin) | Manage teams within their department; set headcount requirements per team per event type | Approve/edit/remove volunteer skills in their department | Full within their department; inherits Team Head permissions for all teams | Permanent membership approvals; places volunteers into teams |
| **Team Head** | No (unless granted by admin) | Manage their own team only | Approve/edit/remove volunteer skills for their team | Manage assignments within their team | Always sits under a Dept Head; can be moved or removed |
| **Supporter / Secretary** | Mirrors assigned leader | Mirrors assigned leader | Mirrors assigned leader | Mirrors assigned leader | No admin-level access; acts on behalf of their assigned leader; one supporter may be linked to one leader |
| **Volunteer** | No | No | Add own skills (pending approval by Dept Head or Team Head) | Accept or decline own assignments | Permanent member of a department; optionally assigned to a team |

### Team Structure Rules

- A team has a name independent of whether a Team Head exists
- A Team Head is optional — a team may have 0 or 1 Team Head
- A volunteer without a team reports directly to their Dept Head
- A team may have as few as 1 member with no Team Head
- A volunteer always belongs to a department; a team is optional
- Structure: `Department → [Team [→ Team Head]] → Volunteer`

### Permanent Membership Rules

- A volunteer becomes a permanent member of a department group (e.g. Team A, B, or C) when their request to serve is approved by a Dept Head
- "Permanent" means they belong to that group — it does not mean they are automatically assigned to every event
- The group (team) is what gets assigned to an event, either via automatic rotation or manual Dept Head selection
- Dept Heads and Team Heads always see their permanent group members, not just during active events
- If a Team Head declines a request to serve for a specific event, the Dept Head can assign a Team Head from another team for that event — permanent group membership is unaffected
- A volunteer may only be moved to a different department or team by an authorized leader

---

## 6. User Experience

**Empty State (New Volunteer):**
Onboarding prompts guide them through:
1. "When are you generally available to serve?" (day/time preferences)
2. "Which department(s) are you interested in?" (select from list)
3. "Do you have any skills you'd like to add?" (free input, pending approval)
After prompts, dashboard shows departments they can express interest in joining.

**Event Confirmation Flow (not individual assignment creation):**
1. Dept Head creates event invitation for their department
2. Team Heads receive invitation and confirm yes/no
3. Volunteers under each Team Head receive invitation and confirm yes/no
4. Volunteers directly under Dept Head receive invitation and confirm yes/no
5. Non-confirmations are highlighted on the Dept Head's dashboard for action
6. Dept Head can add replacements or reassign

**Success Feedback:**
- Screen updates instantly to reflect confirmed/declined status
- Email notification sent on invitation and on confirmation/decline
- Leader dashboard updates in real-time

**Error Handling:**
- Friendly "It's not you, it's us" message
- WhatsApp link to contact the relevant leader/dept head directly
- Built-in bug report form to notify developer with error details

**Confirmation Required For:**
- Declining a request to serve
- Removing a volunteer from a team or department
- Deleting a department, team, or event
- Approving, editing, or removing a skill
- Any permanent or high-impact action
- All deletions route to admin approval queue (soft delete)

---

## 7. Design Direction

**Primary Device:** Both mobile and desktop (responsive)
**Feel:** Warm and engaging for volunteers (fun, friendly, approachable) + Calm and professional for leaders (structured, data-rich, Monday.com-inspired)
**Design Inspiration:** Monday.com — clean layout, color-coded structure, satisfying visual feedback; adapted with warmth and playfulness for the volunteer-facing side

**Character Limits (Standard Defaults):**
- Headers: ~60 characters
- Descriptions: ~300 characters
- Notes / Instructions: ~2000 characters

---

## 8. Boundaries

**Out of Scope (Version 1):**
- Payroll or financial tracking
- Live video or streaming
- Full real-time chat (comments/notes only)
- Third-party church management integrations
- Automated recurring special event scheduling (Easter, Good Friday, etc.)

**Limits:** Standard defaults applied (file sizes, character limits as above). Headcount requirements per team per event type are set by Dept Heads and All Departments Leaders.

**Success Metrics:**
- All users can access and interact with their role-specific dashboard
- Super Admin sees full stats (uploads, invites, team/dept creations, membership counts)
- All Departments Leaders and Dept Heads see rostering health, skill gaps, headcount coverage, and non-confirming members
- Team Heads see their team's confirmation status and skill coverage
- Volunteers see their assignments, instructions, team context, and availability
- Permanent membership is visible to leaders at every level, not just per-event
- Proactive alerts reach leaders 2 and 5 days before events
- Skill approval loop is functioning (volunteer adds → Dept Head or Team Head approves → counts in gap analysis)
- Notifications fire correctly on: invitation, confirmation, decline, interest request

---

## Summary for Development

**Core V1:**
1. User auth + expanded role system (Super Admin, All Departments Leader, Dept Head, Team Head, Supporter, Volunteer)
2. Permanent group membership model (request to serve → approval → placed into Team A/B/C → that group is selectable for future events; membership ≠ automatic assignment to every event)
3. Event → Department → Team → Assignment hierarchy (Team Head optional at team level)
4. Multiple teams per department with optional rotation labels (Team A, B, C) for weekly rotation scheduling
5. Team headcount requirements per event type (set by Dept Head or All Departments Leader)
6. Request-to-serve and confirmation flow (Dept Head selects team → Team Heads confirm → Volunteers confirm individually; non-confirmations highlighted)
7. Cross-team auto-suggestions for gap filling based on skill match and availability analytics
8. Skill management (admin creates skills via upload or manual entry; volunteers declare; Dept Head or Team Head approves/edits/removes)
9. Weekly programme dashboard (per role, cascading visibility)
10. Instructions and media per department or team
11. Email notifications + 2-day/5-day leader alerts

**Tech requirements:**
- Authentication: Yes — email/password
- Database: Yes — relational (Users, Events, Departments, Teams, Team Memberships, Assignments, Skills, Volunteer Skills, Notifications)
- Primary device: Responsive — mobile and desktop
- Soft delete with admin approval queue
- Skill approval workflow (volunteer submits → Dept Head or Team Head approves)
- File/image/document upload per event programme
- Bulk skill upload via admin template

**Key constraints:**
- Nothing is permanently deleted without admin approval
- Only approved volunteer skills count in skill-gap calculations
- Skill gap and headcount alerts must fire to Dept Head when coverage is insufficient
- All destructive actions require confirmation dialogs
- Error states must surface WhatsApp contact link + developer bug report option
- Permanent membership persists across events — leaders always see their people
- Team Head is optional at the team level; Dept Head is always required for a volunteer
- Event creation limited to Super Admin and All Departments Leader by default; Dept Heads and Team Heads may be granted access by admin

---

*Vision revised 2026-04-07 — supersedes original March 26 2026 version for all planning and implementation decisions going forward.*
