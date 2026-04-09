# RosterServe Production Deployment Plan

> **For agentic workers:** This plan is executed inline (not subagent-per-task) due to sequential dependencies between every step. Execute tasks in strict order — each task depends on the previous one completing successfully.

**Goal:** Deploy RosterServe v1 to production — push 32 database migrations to the live Supabase project and deploy the Next.js app to Vercel.

**Architecture:** Supabase project `texvqyhsfhmykmmowwyj` (RosterServe, Tokyo) already exists with 0 migrations applied. Vercel CLI is authenticated as `freshproduceuae-max`. App lives at `apps/web/`. All secrets are available from Windows User Environment Variables.

**Tech Stack:** Next.js 15 App Router, Supabase Postgres + RLS, Vercel (cron + hosting), Resend (email).

---

## File Map

| File | Change |
|------|--------|
| `apps/web/vercel.json` | Create — move cron config here from repo root |
| `vercel.json` | Delete — moved to apps/web/ |
| `docs/tracking/progress.md` | Modify — note production deployment |

---

## Task 1: Move vercel.json into the Next.js app

Vercel looks for `vercel.json` at the root of the deployed project. Since Vercel will deploy from `apps/web/`, the file must live there.

- [ ] **Step 1: Create `apps/web/vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/event-alerts",
      "schedule": "0 9 * * *"
    }
  ]
}
```

- [ ] **Step 2: Delete root `vercel.json`**

```bash
rm vercel.json
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/vercel.json vercel.json
git commit -m "chore: move vercel.json into apps/web for correct Vercel deployment root"
```

---

## Task 2: Apply all 32 migrations to the remote Supabase project

Apply migrations **in order** (00001 → 00032) using the Supabase MCP `apply_migration` tool. Each call reads the local SQL file and posts it to the remote project `texvqyhsfhmykmmowwyj`.

- [ ] **Step 1: Apply migrations 00001–00032 in sequence**

For each file in `supabase/migrations/`, read the SQL content and call:
```
mcp__plugin_supabase_supabase__apply_migration(
  project_id: "texvqyhsfhmykmmowwyj",
  name: "<filename_without_.sql>",
  query: "<file_contents>"
)
```

Files in order:
1. `00001_auth_profiles.sql`
2. `00002_events.sql`
3. `00003_departments.sql`
4. `00004_leader_profile_read.sql`
5. `00005_onboarding.sql`
6. `00006_onboarding_interests_atomic.sql`
7. `00007_availability_blockouts.sql`
8. `00008_interest_requests.sql`
9. `00009_skills.sql`
10. `00010_fix_profiles_rls_recursion.sql`
11. `00011_assignments.sql`
12. `00012_skill_requirements.sql`
13. `00013_fix_rls_indirect_recursion.sql`
14. `00014_fix_rls_cross_table_cycles.sql`
15. `00015_revoke_helper_public_execute.sql`
16. `00016_fix_events_dept_head_policy.sql`
17. `00017_fix_assignments_softdelete_rls.sql`
18. `00018_volunteer_event_subteam_read.sql`
19. `00019_role_hierarchy_revision.sql`
20. `00020_role_hierarchy_migration.sql`
21. `00021_event_creation_grant.sql`
22. `00022_super_admin_grant_profile_update.sql`
23. `00023_granted_users_created_events_select.sql`
24. `00024_departments_teams_revision.sql`
25. `00025_department_members.sql`
26. `00026_skills_role_expansion.sql`
27. `00027_request_to_serve.sql`
28. `00028_fix_self_response_rls.sql`
29. `00029_instructions_media.sql`
30. `00030_served_transition_rls.sql`
31. `00031_dept_rotation_overrides.sql`
32. `00032_super_admin_supporter_assignment.sql`

If any migration fails, stop and investigate before continuing.

- [ ] **Step 2: Verify all 32 migrations applied**

```
mcp__plugin_supabase_supabase__list_migrations(project_id: "texvqyhsfhmykmmowwyj")
```

Expected: 32 entries, matching the local filenames in order.

---

## Task 3: Link app to Vercel and set environment variables

- [ ] **Step 1: Check Vercel auth**

```bash
vercel whoami
```
Expected: `freshproduceuae-max`

- [ ] **Step 2: Link the project**

```bash
cd C:/Projects/RosteringSystem/apps/web && vercel link --yes
```

When prompted, select:
- Scope: `freshproduceuae-max`
- Link to existing project: **No** (create new)
- Project name: `rosterserve`

- [ ] **Step 3: Generate CRON_SECRET**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this value — it goes into Vercel env vars and must also be stored somewhere safe (e.g. your password manager).

- [ ] **Step 4: Add all environment variables to Vercel (production)**

Read each secret from Windows User Environment Variables via PowerShell, then add to Vercel:

```bash
cd C:/Projects/RosteringSystem/apps/web

# Supabase
echo "https://texvqyhsfhmykmmowwyj.supabase.co" | vercel env add NEXT_PUBLIC_SUPABASE_URL production

echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleHZxeWhzZmhteWttbW93d3lqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDMxMzYsImV4cCI6MjA5MDQ3OTEzNn0.Qe9gySM6HktecR7GjlQ7MQDdHZd5kv0-WsWf1OaM6gA" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

powershell -Command "[System.Environment]::GetEnvironmentVariable('SUPABASE_SERVICE_ROLE_KEY','User')" | vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Email + notifications
powershell -Command "[System.Environment]::GetEnvironmentVariable('RESEND_API_KEY','User')" | vercel env add RESEND_API_KEY production

powershell -Command "[System.Environment]::GetEnvironmentVariable('DEVELOPER_EMAIL','User')" | vercel env add DEVELOPER_EMAIL production

powershell -Command "[System.Environment]::GetEnvironmentVariable('NEXT_PUBLIC_SUPPORT_WHATSAPP','User')" | vercel env add NEXT_PUBLIC_SUPPORT_WHATSAPP production

# Cron secret (paste the value generated in Step 3)
echo "<CRON_SECRET_VALUE>" | vercel env add CRON_SECRET production
```

Note: `NEXT_PUBLIC_SITE_URL` is set in Task 5 after the production URL is known.

- [ ] **Step 5: Verify env vars are listed**

```bash
vercel env ls production
```

Expected: 7 variables listed (NEXT_PUBLIC_SITE_URL comes in Task 5).

---

## Task 4: Initial production deploy

- [ ] **Step 1: Deploy to production**

```bash
cd C:/Projects/RosteringSystem/apps/web && vercel deploy --prod
```

Wait for the build to complete. It will print the production URL on success (e.g. `https://rosterserve.vercel.app`).

- [ ] **Step 2: Note the production URL**

Copy the URL printed by the deploy command. It is needed for Task 5.

- [ ] **Step 3: Confirm build succeeded**

```bash
vercel ls
```

Expected: one deployment with status `● Ready`.

---

## Task 5: Set production URL in Vercel and Supabase

- [ ] **Step 1: Add NEXT_PUBLIC_SITE_URL to Vercel**

```bash
echo "https://<production-url>" | vercel env add NEXT_PUBLIC_SITE_URL production
```

Replace `<production-url>` with the URL from Task 4 Step 2.

- [ ] **Step 2: Add production URL to Supabase Auth allowed redirect URLs**

Run via Supabase MCP:
```
mcp__plugin_supabase_supabase__execute_sql(
  project_id: "texvqyhsfhmykmmowwyj",
  query: "-- Supabase auth site URL and redirects are set via dashboard, not SQL.
          -- Navigate to: Authentication > URL Configuration in Supabase dashboard
          -- Site URL: https://<production-url>
          -- Redirect URLs: https://<production-url>/auth/callback"
)
```

Actually, auth URL config must be done via the Supabase dashboard:
1. Go to https://supabase.com/dashboard/project/texvqyhsfhmykmmowwyj/auth/url-configuration
2. Set **Site URL** to the production URL
3. Add `https://<production-url>/auth/callback` to **Redirect URLs**
4. Save

- [ ] **Step 3: Redeploy to pick up NEXT_PUBLIC_SITE_URL**

```bash
cd C:/Projects/RosteringSystem/apps/web && vercel deploy --prod
```

---

## Task 6: Smoke test

- [ ] **Step 1: Visit production URL**

Open `https://<production-url>` in browser. Expected: login page renders.

- [ ] **Step 2: Verify database is live**

```
mcp__plugin_supabase_supabase__execute_sql(
  project_id: "texvqyhsfhmykmmowwyj",
  query: "SELECT COUNT(*) FROM public.profiles;"
)
```

Expected: returns `0` (empty DB, schema is live).

- [ ] **Step 3: Update progress.md**

Add to `docs/tracking/progress.md` under Completed Milestones:
```
- Production deployment complete (2026-04-09): 32 migrations applied to Supabase `texvqyhsfhmykmmowwyj`; app deployed to Vercel at <production-url>; auth redirect URLs configured.
```

- [ ] **Step 4: Commit docs update**

```bash
git add docs/tracking/progress.md
git commit -m "docs: record production deployment milestone"
```

---

## Self-Review

### Coverage
| Requirement | Task |
|---|---|
| 32 migrations applied to remote Supabase | Task 2 |
| vercel.json at correct location | Task 1 |
| All 8 env vars set on Vercel | Task 3 |
| App deployed to production | Task 4 |
| Auth redirect URLs configured | Task 5 |
| NEXT_PUBLIC_SITE_URL set | Task 5 |
| Smoke test confirms live DB + app | Task 6 |

### Notes
- Migration 00019 adds `ADD VALUE` to an enum; 00020 depends on it. They are in separate files — apply strictly in order.
- If a migration fails mid-way, do not skip it. Investigate the error before proceeding.
- The Supabase auth URL config (Task 5 Step 2) requires the browser dashboard — it cannot be done via SQL or MCP.
