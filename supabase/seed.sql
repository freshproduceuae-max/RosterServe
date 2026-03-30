-- RS-F001: Seed data for local development
--
-- IMPORTANT: This seed does NOT create auth.users rows. Supabase Auth manages
-- user creation including password hashes and metadata. You cannot insert
-- working email/password accounts via plain SQL.
--
-- Dev setup workflow:
--   1. Start Supabase locally: npx supabase start
--   2. Register test users via the sign-up form at http://localhost:3000/auth/sign-up
--   3. Confirm each user via inbucket at http://localhost:54324
--   4. Run this seed to assign non-volunteer roles:
--      npx supabase db reset  (applies migrations + this seed)
--      OR run the UPDATE statements below manually in Supabase Studio SQL editor
--
-- After sign-up, the handle_new_user trigger creates a profile with role = 'volunteer'.
-- The statements below upgrade specific users to other roles for testing.
-- Replace the email addresses with the ones you used during sign-up.

-- Example: promote a user to super_admin
-- UPDATE public.profiles
-- SET role = 'super_admin'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');

-- Example: promote a user to dept_head
-- UPDATE public.profiles
-- SET role = 'dept_head'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'depthead@example.com');

-- Example: promote a user to sub_leader
-- UPDATE public.profiles
-- SET role = 'sub_leader'
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'subleader@example.com');

-- RS-F002: Example event seed data
-- Run these after creating a super_admin user via the steps above.
-- Replace the email with your actual super_admin user's email.

-- INSERT INTO public.events (title, event_type, event_date, created_by)
-- VALUES (
--   'Sunday Service — April 6',
--   'regular',
--   '2026-04-06',
--   (SELECT id FROM auth.users WHERE email = 'admin@example.com')
-- );

-- INSERT INTO public.events (title, event_type, event_date, status, created_by)
-- VALUES (
--   'Easter Special Service',
--   'special_day',
--   '2026-04-20',
--   'published',
--   (SELECT id FROM auth.users WHERE email = 'admin@example.com')
-- );

-- RS-F003: Example department and sub-team seed data
-- Run these after creating users and an event via the steps above.
-- This example assigns ownership so the RS-F003 visibility model can be verified:
-- after seeding, depthead@example.com should see the event; subleader@example.com
-- should see the event via their sub-team; volunteer@example.com should not.

-- Step 1: create a department owned by the dept_head user
-- INSERT INTO public.departments (event_id, name, owner_id, created_by)
-- VALUES (
--   (SELECT id FROM public.events WHERE title = 'Sunday Service — April 6'),
--   'Worship Team',
--   (SELECT id FROM auth.users WHERE email = 'depthead@example.com'),
--   (SELECT id FROM auth.users WHERE email = 'admin@example.com')
-- );

-- Step 2: create a sub-team owned by the sub_leader user
-- INSERT INTO public.sub_teams (department_id, name, owner_id, created_by)
-- VALUES (
--   (SELECT id FROM public.departments WHERE name = 'Worship Team'),
--   'Guitars',
--   (SELECT id FROM auth.users WHERE email = 'subleader@example.com'),
--   (SELECT id FROM auth.users WHERE email = 'admin@example.com')
-- );

-- Step 3: create a second department with no owner assigned
-- (verifies "invisible until assigned" behavior for dept_head role)
-- INSERT INTO public.departments (event_id, name, created_by)
-- VALUES (
--   (SELECT id FROM public.events WHERE title = 'Sunday Service — April 6'),
--   'AV Team',
--   (SELECT id FROM auth.users WHERE email = 'admin@example.com')
-- );

-- RS-F004: Example onboarding seed data
-- Run these after creating a volunteer user via sign-up and confirming via inbucket.
-- Replace the email with your actual volunteer user's email.
-- Note: the onboarding flow runs automatically when a volunteer signs in.
-- These examples let you manually inspect or reset the onboarding tables.

-- Example: view a volunteer's availability preferences
-- SELECT * FROM public.availability_preferences
-- WHERE volunteer_id = (SELECT id FROM auth.users WHERE email = 'volunteer@example.com');

-- Example: reset a volunteer's onboarding to re-test the gate
-- UPDATE public.profiles
-- SET onboarding_complete = false
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'volunteer@example.com');

-- Example: seed availability preferences directly (bypasses the onboarding UI)
-- INSERT INTO public.availability_preferences (volunteer_id, preferred_days, preferred_times)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'volunteer@example.com'),
--   ARRAY['sunday', 'saturday'],
--   ARRAY['morning']
-- )
-- ON CONFLICT (volunteer_id) DO UPDATE
--   SET preferred_days  = EXCLUDED.preferred_days,
--       preferred_times = EXCLUDED.preferred_times;

-- Example: seed a department interest for a volunteer
-- INSERT INTO public.volunteer_interests (volunteer_id, department_id)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'volunteer@example.com'),
--   (SELECT id FROM public.departments WHERE name = 'Worship Team')
-- )
-- ON CONFLICT DO NOTHING;

-- Example: seed a skill for a volunteer (status = 'pending' until RS-F007 approval)
-- INSERT INTO public.volunteer_skills (volunteer_id, name)
-- VALUES (
--   (SELECT id FROM auth.users WHERE email = 'volunteer@example.com'),
--   'Acoustic Guitar'
-- );

-- RS-F005: Example availability blockout seed data
-- Run these after the RS-F004 seed steps above.
-- Blockouts represent specific dates the volunteer cannot serve.

-- Example: add two blockouts for a volunteer
-- INSERT INTO public.availability_blockouts (volunteer_id, date, reason)
-- VALUES
--   (
--     (SELECT id FROM auth.users WHERE email = 'volunteer@example.com'),
--     '2026-04-13',
--     'Away on holiday'
--   ),
--   (
--     (SELECT id FROM auth.users WHERE email = 'volunteer@example.com'),
--     '2026-04-20',
--     NULL
--   )
-- ON CONFLICT DO NOTHING;

-- Example: view all active blockouts for a volunteer
-- SELECT * FROM public.availability_blockouts
-- WHERE volunteer_id = (SELECT id FROM auth.users WHERE email = 'volunteer@example.com')
--   AND deleted_at IS NULL
-- ORDER BY date;

-- Example: soft-delete a blockout (as if the volunteer removed it via the UI)
-- UPDATE public.availability_blockouts
-- SET deleted_at = now()
-- WHERE volunteer_id = (SELECT id FROM auth.users WHERE email = 'volunteer@example.com')
--   AND date = '2026-04-13';

-- Validation check: confirm a dept_head can see the volunteer's blockouts
-- (requires the volunteer to have expressed interest in the dept_head's department)
-- SELECT ab.*
-- FROM public.availability_blockouts ab
-- WHERE ab.deleted_at IS NULL;
-- (run this as the dept_head user in Supabase Studio; should only return in-scope rows)

-- ---------------------------------------------------------------------------
-- RS-F006 seed examples (commented out — requires real UUIDs from RS-F003/RS-F004)
-- Note for developers: These examples require RS-F003 department data and
-- RS-F004 volunteer profiles to already exist in the local DB.
-- Replace the placeholder UUIDs with real values from your local seed data.
-- ---------------------------------------------------------------------------
-- INSERT INTO public.volunteer_interests (volunteer_id, department_id, status, reviewed_by, reviewed_at)
-- VALUES
--   -- Pending interest (not yet reviewed)
--   ('VOLUNTEER_UUID', 'DEPARTMENT_UUID_1', 'pending', NULL, NULL),
--   -- Approved interest (reviewed and accepted)
--   ('VOLUNTEER_UUID', 'DEPARTMENT_UUID_2', 'approved', 'DEPT_HEAD_UUID', NOW()),
--   -- Rejected interest (reviewed and declined)
--   ('VOLUNTEER_UUID', 'DEPARTMENT_UUID_3', 'rejected', 'DEPT_HEAD_UUID', NOW());
