/**
 * RS-F001 manual validation — test account setup
 * Run: node scripts/setup-test-accounts.mjs
 *
 * Creates 6 auth users, assigns roles, and seeds minimum validation data:
 *  - super_admin:       praise_john@outlook.com
 *  - all_depts_leader:  praisesstorage+alldepts@gmail.com
 *  - dept_head:         praise_john@yahoo.com       → owns "Worship Team"
 *  - team_head:         praisesstorage@gmail.com
 *  - supporter:         praisesstorage+supporter@gmail.com  → supporter_of dept_head
 *  - volunteer:         praizes@gmail.com           → onboarding complete, approved interest in Worship Team
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const DEFAULT_PASSWORD = 'Password123!';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── helpers ────────────────────────────────────────────────────────────────

async function createUser(email, displayName) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });

  if (error) {
    if (error.message?.includes('already been registered')) {
      const { data: list } = await admin.auth.admin.listUsers();
      const existing = list.users.find((u) => u.email === email);
      if (existing) {
        console.log(`  ↩  ${email} already exists — reusing`);
        return existing;
      }
    }
    throw new Error(`createUser(${email}): ${error.message}`);
  }

  console.log(`  ✓  created ${email}`);
  return data.user;
}

async function setRole(userId, role, displayName, extra = {}) {
  const { error } = await admin
    .from('profiles')
    .update({ role, display_name: displayName, ...extra })
    .eq('id', userId);
  if (error) throw new Error(`setRole(${userId}, ${role}): ${error.message}`);
}

// ── main ───────────────────────────────────────────────────────────────────

console.log('\n=== Creating test accounts ===\n');

// 1. Create auth users
const superAdmin    = await createUser('praise_john@outlook.com',             'Praise (Admin)');
const allDeptsLeader = await createUser('praisesstorage+alldepts@gmail.com',  'Praise (All Depts Leader)');
const deptHead      = await createUser('praise_john@yahoo.com',               'Praise (Dept Head)');
const teamHead      = await createUser('praisesstorage@gmail.com',            'Praise (Team Head)');
const supporter     = await createUser('praisesstorage+supporter@gmail.com',  'Praise (Supporter)');
const volunteer     = await createUser('praizes@gmail.com',                   'Praise (Volunteer)');

// Give trigger a moment to create profile rows
await new Promise((r) => setTimeout(r, 1500));

// 2. Assign roles
console.log('\n=== Assigning roles ===\n');
await setRole(superAdmin.id,     'super_admin',      'Praise (Admin)');
console.log('  ✓  super_admin assigned');
await setRole(allDeptsLeader.id, 'all_depts_leader', 'Praise (All Depts Leader)');
console.log('  ✓  all_depts_leader assigned');
await setRole(deptHead.id,       'dept_head',        'Praise (Dept Head)');
console.log('  ✓  dept_head assigned');
await setRole(teamHead.id,       'team_head',        'Praise (Team Head)');
console.log('  ✓  team_head assigned');
// supporter_of links this supporter to the dept_head
await setRole(supporter.id,      'supporter',        'Praise (Supporter)', { supporter_of: deptHead.id });
console.log('  ✓  supporter assigned (supporter_of = dept_head)');
// volunteer stays as 'volunteer' (default from trigger)

// 3. Mark volunteer onboarding complete + seed availability preferences
console.log('\n=== Volunteer onboarding ===\n');
const { error: prefErr } = await admin.from('availability_preferences').upsert(
  {
    volunteer_id: volunteer.id,
    preferred_days: ['sunday'],
    preferred_times: ['morning'],
  },
  { onConflict: 'volunteer_id' }
);
if (prefErr) throw new Error(`availability_preferences: ${prefErr.message}`);

const { error: onboardErr } = await admin
  .from('profiles')
  .update({ onboarding_complete: true })
  .eq('id', volunteer.id);
if (onboardErr) throw new Error(`onboarding_complete: ${onboardErr.message}`);
console.log('  ✓  volunteer onboarding marked complete');

// 4. Create a seed event (required for departments FK)
console.log('\n=== Creating seed event ===\n');
const { data: existingEvent } = await admin
  .from('events')
  .select('id')
  .eq('title', 'Sunday Service — April 6')
  .maybeSingle();

let eventId;
if (existingEvent) {
  eventId = existingEvent.id;
  console.log('  ↩  event already exists — reusing');
} else {
  const { data: newEvent, error: eventErr } = await admin.from('events').insert({
    title: 'Sunday Service — April 6',
    event_type: 'regular',
    event_date: '2026-04-06',
    created_by: superAdmin.id,
  }).select('id').single();
  if (eventErr) throw new Error(`events: ${eventErr.message}`);
  eventId = newEvent.id;
  console.log('  ✓  event created');
}

// 5. Create "Worship Team" department owned by dept_head
console.log('\n=== Creating Worship Team department ===\n');
const { data: existingDept } = await admin
  .from('departments')
  .select('id')
  .eq('name', 'Worship Team')
  .is('deleted_at', null)
  .maybeSingle();

let deptId;
if (existingDept) {
  deptId = existingDept.id;
  await admin.from('departments').update({ owner_id: deptHead.id }).eq('id', deptId);
  console.log('  ↩  Worship Team already exists — ownership confirmed');
} else {
  const { data: newDept, error: deptErr } = await admin.from('departments').insert({
    event_id: eventId,
    name: 'Worship Team',
    owner_id: deptHead.id,
    created_by: superAdmin.id,
  }).select('id').single();
  if (deptErr) throw new Error(`departments: ${deptErr.message}`);
  deptId = newDept.id;
  console.log('  ✓  Worship Team department created');
}

// 6. Create approved volunteer_interest for volunteer in Worship Team
console.log('\n=== Seeding approved interest ===\n');
const { data: existingInterest } = await admin
  .from('volunteer_interests')
  .select('id')
  .eq('volunteer_id', volunteer.id)
  .eq('department_id', deptId)
  .is('deleted_at', null)
  .maybeSingle();

if (existingInterest) {
  await admin
    .from('volunteer_interests')
    .update({ status: 'approved', reviewed_by: deptHead.id, reviewed_at: new Date().toISOString() })
    .eq('id', existingInterest.id);
  console.log('  ↩  interest already exists — status set to approved');
} else {
  const { error: intErr } = await admin.from('volunteer_interests').insert({
    volunteer_id: volunteer.id,
    department_id: deptId,
    status: 'approved',
    reviewed_by: deptHead.id,
    reviewed_at: new Date().toISOString(),
  });
  if (intErr) throw new Error(`volunteer_interests: ${intErr.message}`);
  console.log('  ✓  approved interest created');
}

// ── summary ────────────────────────────────────────────────────────────────

console.log(`
=== Setup complete — test credentials ===

  super_admin        praise_john@outlook.com                / ${DEFAULT_PASSWORD}
  all_depts_leader   praisesstorage+alldepts@gmail.com      / ${DEFAULT_PASSWORD}
  dept_head          praise_john@yahoo.com                  / ${DEFAULT_PASSWORD}
  team_head          praisesstorage@gmail.com               / ${DEFAULT_PASSWORD}
  supporter          praisesstorage+supporter@gmail.com     / ${DEFAULT_PASSWORD}
  volunteer          praizes@gmail.com                      / ${DEFAULT_PASSWORD}

  dept_head owns:    Worship Team
  supporter_of:      dept_head
  volunteer:         onboarding complete, approved interest in Worship Team

Ready for RS-F001 browser validation — Checks 5, 6, 7, 11.
`);
