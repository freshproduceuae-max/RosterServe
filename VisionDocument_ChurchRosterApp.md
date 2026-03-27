# RosterServe — Vision Document

**Created:** March 26, 2026
**Status:** Ready for Development

---

## 1. The Problem

**Target User:** Timmy, 25, real estate agent — busy, irregular schedule, volunteers at church across multiple departments
**Their Problem:** No structured way to communicate roster assignments, role-specific instructions, skill requirements, or weekly programme details. Volunteers forget assignments, leaders struggle to track who's available and whether they have the right skills.
**Current Workaround:** Manual coordination via spreadsheets, WhatsApp messages, and general email blasts — no structure, no skill matching, no accountability trail.

---

## 2. The Solution

**What It Does:** A church rostering platform that matches volunteers to roles based on skills and availability, delivers targeted weekly instructions to each person, and gives every level of leadership a clear real-time view of planning health.
**Why It's Better:** Instead of chasing people on WhatsApp, leaders build the roster in one place, the system checks skill gaps automatically, volunteers opt in with one tap, and everyone — from the Senior Leader to the newest volunteer — sees exactly what's relevant to them on their own personalised dashboard.

---

## 3. Core Features (Version 1)

| # | Feature | Description |
|---|---------|-------------|
| 1 | Availability & Interest Setting | Volunteers set their available dates and express interest in departments/sub-teams via onboarding prompts and ongoing dashboard |
| 2 | Roster Building & Assignment | Dept Heads and Sub-Leaders assign volunteers to events, compare required vs available skills, and get alerted to gaps |
| 3 | Weekly Programme Dashboard | Each user sees their personalised weekly view — assignments, instructions, equipment notes, timelines, team members |
| 4 | Instructions & Media Sharing | Leaders post weekly notes, images, documents, and custom messages per department or sub-team |
| 5 | Notifications & Alerts | Email notifications on assignment, acceptance, decline; proactive alerts to leaders 2 and 5 days before events |

**Main User Flow:**
1. Senior Leader / Admin creates an Event (e.g., Sunday Service)
2. Each Department Head opens their department within the event
3. Dept Head reviews who has accepted availability and checks skill match
4. System alerts Dept Head if required skills are missing from accepted volunteers
5. Dept Head assigns volunteers to sub-teams, adds weekly instructions, uploads media/documents
6. App sends email to each assigned volunteer with a link to their personal dashboard
7. Volunteer clicks link → sees their roster, team members, instructions, equipment notes, and timeline
8. Volunteer clicks Accept or Decline (with confirmation dialog)
9. Dept Head sees real-time update; gets notified of declines and can act accordingly
10. Volunteer can also express interest in a programme they haven't been assigned to — request goes to Dept Head for review

**Deferred to Later:**
- Full WhatsApp integration
- Live chat (v1 has comments/notes only)
- Payroll or financial tracking
- Live video/streaming
- Third-party integrations (Planning Center, ChurchSuite)
- Full recurring event automation for special days (Easter, Good Friday, etc.)

---

## 4. Data Model

**Entities:** User, Event, Department, Sub-Team, Assignment, Skill, Instruction, Media/Document, Notification, Availability, Interest Request, Skill Approval Request

**Event Fields:**
| Field | Description |
|-------|-------------|
| event_id | Unique identifier |
| title | Name of the event (e.g., "Sunday Service – April 6") |
| event_type | Regular / Ad-hoc / Special Day |
| date | Date of the event |
| status | Draft → Published → Completed |
| created_by | Senior Leader or Admin user ID |

**Assignment Fields:**
| Field | Description |
|-------|-------------|
| assignment_id | Unique identifier |
| event_id | Linked event |
| department_id | Linked department |
| sub_team_id | Linked sub-team |
| volunteer_id | Linked user |
| role | Leader / Sub-Leader / Volunteer |
| status | Invited → Accepted → Declined → Served |
| instructions | Weekly notes from leader |
| documents | Attached files/images |

**Skill Fields:**
| Field | Description |
|-------|-------------|
| skill_id | Unique identifier |
| name | Skill name |
| department_id | Department this skill is associated with (flexible) |
| approved | Boolean — approved by Team Leader |

**Status Flow:** Invited → Accepted → Declined → Served
**Soft Delete:** All deletions are pending admin approval before permanent removal

---

## 5. Users & Access

**Authentication:** Email and password (free tier)
**Data Visibility:** Team view — volunteers can see who else is rostered with them that week; leaders see their full department; senior leaders see everything
**User Types & Roles:**

| Role | Access Level |
|------|-------------|
| Super Admin / Senior Leader | Full visibility across all departments; stats dashboard; create/delete departments; delegate authority |
| Department Head | Full control of own department; post instructions & media; make calls via system; approve/reject skill requests |
| Sub-Leader / Overseer | Delegated authority within a department or sub-team; see who's rostered, who declined |
| Volunteer | Personal dashboard; own roster; team view; express interest; add skills (pending approval); set availability & blockout dates |

**Skill Self-Adding:** Volunteers can add skills to their own profile. Team Leaders approve or reject — only approved skills count toward skill-gap calculations.

---

## 6. User Experience

**Empty State (New Volunteer):**
Onboarding prompts guide them through:
1. "When are you generally available to serve?" (day/time preferences)
2. "Which department(s) are you interested in?" (select from list)
3. "Do you have any skills you'd like to add?" (free input, pending approval)
After prompts, dashboard shows upcoming programmes they can express interest in.

**Success Feedback:**
- Screen updates instantly to reflect accepted/declined status
- Email confirmation sent immediately
- Leader dashboard updates in real-time

**Error Handling:**
- Friendly "It's not you, it's us" message
- WhatsApp link to contact the relevant leader/dept head directly
- Built-in bug report form to notify developer with error details

**Confirmation Required For:**
- Declining an assignment
- Removing a volunteer from a roster
- Deleting a department, sub-team, or event
- Approving or rejecting a skill request
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

**Limits:** Standard defaults applied (file sizes, character limits as above). No hard volunteer-per-team caps in v1.

**Success Metrics:**
- All users can access and interact with their role-specific dashboard
- Admins see full stats (uploads, invites, team/dept creations)
- Leaders see rostering health, skill gaps, unassigned potential volunteers
- Dept Heads can post instructions and see department-level planning view
- Sub-Leaders see their portion of the roster clearly
- Volunteers see their assignments, blockout dates, completed weeks, and skill gap opportunities
- Proactive alerts reach leaders 2 and 5 days before events
- Skill approval loop is functioning (volunteer adds → leader approves → counts in gap analysis)
- Notifications fire correctly on: assignment, acceptance, decline, interest request

---

## Summary for Development

**Build this week (Core V1):**
1. User auth + role system (5 roles)
2. Event → Department → Sub-Team → Assignment hierarchy
3. Volunteer availability + interest setting + onboarding flow
4. Weekly programme dashboard (per role)
5. Email notifications + 2-day/5-day leader alerts

**Tech requirements:**
- Authentication: Yes — email/password
- Database: Yes — relational (Users, Events, Departments, Sub-Teams, Assignments, Skills, Notifications)
- Primary device: Responsive — mobile and desktop
- Soft delete with admin approval queue
- Skill approval workflow (volunteer submits → leader approves)
- File/image/document upload per event programme

**Key constraints:**
- Nothing is permanently deleted without admin approval
- Only admin-approved skills count in skill-gap calculations
- Skill gap alerts must fire to Dept Head when assigned volunteers don't cover required skills
- All destructive actions require confirmation dialogs
- Error states must surface WhatsApp contact link + developer bug report option

---

*Ready for CLAUDE.md generation →*
