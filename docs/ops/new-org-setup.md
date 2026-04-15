# New Organisation Setup Guide

Step-by-step guide for deploying a fresh RosterServe instance for a new organisation.

---

## Prerequisites

- Node.js 18+ and npm installed
- Supabase CLI installed (`npm install -g supabase`)
- Vercel CLI installed (`npm install -g vercel`)
- GitHub account with access to the RosterServe repository

---

## Step 1: Clone the repository

```bash
git clone https://github.com/freshproduceuae-max/RosterServe.git
cd RosterServe
npm install
```

---

## Step 2: Create a new Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Choose a region close to your primary users.
3. Save the project password — you will need it for migrations.

---

## Step 3: Run migrations

```bash
# Link the CLI to your new project
supabase link --project-ref <your-project-ref>

# Apply all migrations
supabase db push
```

Verify all 35 migrations applied without error. If any fail, check the Supabase dashboard logs.

---

## Step 4: Set required environment variables

In the Vercel dashboard (or via `vercel env add`), set:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API → anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API → service_role key (keep secret) |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel deployment URL (e.g. `https://rosterserve.vercel.app`) |
| `RESEND_API_KEY` | Resend dashboard → API Keys (required for email notifications) |
| `DEVELOPER_EMAIL` | Email address for bug report escalations |
| `CRON_SECRET` | A random secret string — used to protect the `/api/cron/event-alerts` endpoint |

---

## Step 5: Deploy to Vercel

```bash
cd apps/web
vercel --prod
```

Or connect the GitHub repository in the Vercel dashboard and set the root directory to `apps/web`.

---

## Step 6: Seed the initial Super Admin user

1. In the Supabase dashboard, go to **Authentication → Users** and create a new user with the Super Admin's email and a temporary password.
2. Copy the user's UUID from the dashboard.
3. In the **SQL Editor**, run:

```sql
UPDATE public.profiles
SET role = 'super_admin'
WHERE id = '<user-uuid>';
```

4. Share the login credentials with the Super Admin and ask them to change their password on first sign-in.

---

## Step 7: Configure Vercel Cron

In `apps/web/vercel.json`, the cron job is already configured to fire daily at 09:00 UTC:

```json
{
  "crons": [{ "path": "/api/cron/event-alerts", "schedule": "0 9 * * *" }]
}
```

Ensure `CRON_SECRET` is set in Vercel environment variables (see Step 4).

---

## Step 8: Smoke-test checklist

After deployment, verify the following:

- [ ] Sign in as `super_admin` → Dashboard renders with correct role subtitle
- [ ] Navigate to Events → create a draft event → publish it
- [ ] Navigate to Departments → create a department → create a team within it
- [ ] Navigate to Admin → Admin Oversight page loads without error
- [ ] Navigate to `/privacy` without signing in → Privacy Notice renders
- [ ] Sign up as a new user → confirm email → complete onboarding
- [ ] Assign the new user to a department (as Super Admin via Interests)
- [ ] Sign in as the new volunteer → Service requests page loads
- [ ] Download my data from Account settings → JSON file downloads
- [ ] Sign in as `super_admin` again → confirm volunteer appears in Admin oversight if deletion was requested
- [ ] Mobile: open the app at 390px width → hamburger nav visible and functional
