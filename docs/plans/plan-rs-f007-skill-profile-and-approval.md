
# RS-F007 Revision: Skill Profile and Approval

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the existing skills infrastructure so Super Admin can create skills via manual entry or bulk template upload, team_head can approve/reject skill claims scoped to their teams, all_depts_leader gets full read+write access, and the /skills page correctly routes and renders for every role.

**Architecture:** A single migration (00026) drops two stale `sub_leader` policies from 00012 and adds new RLS policies for `super_admin`/`all_depts_leader` (INSERT+UPDATE on `department_skills`; SELECT+UPDATE on `volunteer_skills`) and `team_head` (SELECT+UPDATE on `volunteer_skills` scoped to their teams via a `teams` JOIN). Server actions are expanded with dual-branch role guards (`dept_head` + ownership check vs. elevated roles relying on RLS). Two new queries and one new bulk action are added. The /skills page gains `team_head` and `all_depts_leader` branches. A new `TeamHeadSkillsView` component handles the team_head surface. `SuperAdminSkillsView` gains a `SkillCreationForm` sub-component (single-entry + bulk textarea toggle) and delegates claim rendering to `LeaderSkillsView`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS, Supabase Postgres + RLS

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/00026_skills_role_expansion.sql` | Create | Drop stale sub_leader policies; add super_admin/all_depts_leader/team_head RLS on both tables |
| `apps/web/lib/skills/actions.ts` | Modify | Expand 5 role guards; add `bulkCreateSkills` |
| `apps/web/lib/skills/queries.ts` | Modify | Add `getSkillClaimsForTeamHead`, `getAllActiveDepartments` |
| `apps/web/app/(app)/skills/page.tsx` | Modify | Add `team_head` and `all_depts_leader` branches; expand `super_admin` branch |
| `apps/web/app/(app)/skills/_components/team-head-skills-view.tsx` | Create | Claims view grouped by department for team_head |
| `apps/web/app/(app)/skills/_components/super-admin-skills-view.tsx` | Modify | Add `SkillCreationForm`; delegate claim list to `LeaderSkillsView` |
| `docs/features/feature-list.json` | Modify | RS-F007 `passes: true`, `revisionRequired: false`, add revisionNote |
| `docs/tracking/progress.md` | Modify | RS-F007 milestone + status table update |

---

## Task 1: Migration `00026_skills_role_expansion.sql`

**Files:**
- Create: `supabase/migrations/00026_skills_role_expansion.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration: 00026_skills_role_expansion.sql
-- Feature: RS-F007 revision — Skill Profile and Approval
--
-- 1. Drop stale sub_leader policies added by 00012 (role renamed to team_head
--    in RS-F001, sub_teams renamed to teams in RS-F003 — those policies were
--    already replaced in 00024 for the volunteer_skills approved-only policy
--    and the department_skills read policy; this migration cleans up the
--    originals in 00012 which may still exist under old names).
-- 2. Add super_admin / all_depts_leader INSERT + UPDATE policies on department_skills.
-- 3. Add all_depts_leader SELECT policy on department_skills.
-- 4. Add team_head SELECT policy on department_skills (departments where they own a team).
-- 5. Add super_admin / all_depts_leader SELECT + UPDATE policies on volunteer_skills.
-- 6. Add team_head SELECT + UPDATE (approve/reject) policies on volunteer_skills.

-- ============================================================
-- 1. Drop stale sub_leader policies from 00012
-- ============================================================

DROP POLICY IF EXISTS "Sub-leaders can read skills for owned sub-team departments"
  ON public.department_skills;

DROP POLICY IF EXISTS "Sub-leaders can read approved skills in owned sub-team departments"
  ON public.volunteer_skills;

-- ============================================================
-- 2. super_admin INSERT on department_skills
-- ============================================================

CREATE POLICY "Super admins can insert department skills"
  ON public.department_skills FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 3. super_admin UPDATE (soft-delete + is_required toggle) on department_skills
-- ============================================================

CREATE POLICY "Super admins can update department skills"
  ON public.department_skills FOR UPDATE
  USING (
    public.get_my_role() = 'super_admin'
  )
  WITH CHECK (
    public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 4. all_depts_leader SELECT on department_skills
-- ============================================================

CREATE POLICY "All depts leaders can read all department skills"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 5. all_depts_leader INSERT on department_skills
-- ============================================================

CREATE POLICY "All depts leaders can insert department skills"
  ON public.department_skills FOR INSERT
  WITH CHECK (
    public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 6. all_depts_leader UPDATE on department_skills
-- ============================================================

CREATE POLICY "All depts leaders can update department skills"
  ON public.department_skills FOR UPDATE
  USING (
    public.get_my_role() = 'all_depts_leader'
  )
  WITH CHECK (
    public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 7. team_head SELECT on department_skills
--    (departments where they own an active team)
-- ============================================================

CREATE POLICY "Team heads can read skills for departments with owned teams"
  ON public.department_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = department_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- ============================================================
-- 8. super_admin SELECT on volunteer_skills
-- ============================================================

CREATE POLICY "Super admins can read all volunteer skill claims"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 9. super_admin UPDATE (approve/reject) on volunteer_skills
-- ============================================================

CREATE POLICY "Super admins can review volunteer skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND public.get_my_role() = 'super_admin'
  )
  WITH CHECK (
    status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
    AND public.get_my_role() = 'super_admin'
  );

-- ============================================================
-- 10. all_depts_leader SELECT on volunteer_skills
-- ============================================================

CREATE POLICY "All depts leaders can read all volunteer skill claims"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 11. all_depts_leader UPDATE (approve/reject) on volunteer_skills
-- ============================================================

CREATE POLICY "All depts leaders can review volunteer skill claims"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND public.get_my_role() = 'all_depts_leader'
  )
  WITH CHECK (
    status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
    AND public.get_my_role() = 'all_depts_leader'
  );

-- ============================================================
-- 12. team_head SELECT on volunteer_skills
--     (all statuses for volunteers in teams they own; includes pending
--      claims so the team_head can see what they need to review)
-- ============================================================

CREATE POLICY "Team heads can read skill claims in departments with owned teams"
  ON public.volunteer_skills FOR SELECT
  USING (
    deleted_at IS NULL
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = volunteer_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );

-- ============================================================
-- 13. team_head UPDATE (approve/reject) on volunteer_skills
--     Scoped to departments where they own a team.
-- ============================================================

CREATE POLICY "Team heads can review skill claims in departments with owned teams"
  ON public.volunteer_skills FOR UPDATE
  USING (
    deleted_at IS NULL
    AND status = 'pending'
    AND department_id IS NOT NULL
    AND public.get_my_role() = 'team_head'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = volunteer_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
    AND reviewed_at IS NOT NULL
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.department_id = volunteer_skills.department_id
        AND t.owner_id = auth.uid()
        AND t.deleted_at IS NULL
    )
  );
```

- [ ] **Step 2: Verify migration applies cleanly**

```bash
npx supabase db reset
```

Confirm: zero errors, all 26 migrations apply, no policy name collisions.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00026_skills_role_expansion.sql
git commit -m "feat(rs-f007): migration 00026 — expand skills RLS for super_admin, all_depts_leader, team_head"
```

---

## Task 2: Expand `apps/web/lib/skills/actions.ts`

**Files:**
- Modify: `apps/web/lib/skills/actions.ts`

- [ ] **Step 1: Replace the entire file contents**

Replace `apps/web/lib/skills/actions.ts` with:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasMinimumRole } from "@/lib/auth/roles";
import type { AppRole } from "@/lib/auth/types";

// ---------------------------------------------------------------------------
// Role helpers (local)
// ---------------------------------------------------------------------------

function isElevated(role: AppRole): boolean {
  return role === "all_depts_leader" || hasMinimumRole(role, "super_admin");
}

// ---------------------------------------------------------------------------
// createDepartmentSkill
// dept_head: ownership check required.
// all_depts_leader / super_admin: no ownership check — RLS enforces nothing
// further, so the INSERT goes through as long as the department exists.
// ---------------------------------------------------------------------------
export async function createDepartmentSkill(
  departmentId: string,
  name: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !elevated) return { error: "Unauthorized" };

  if (!departmentId || typeof departmentId !== "string") {
    return { error: "Invalid department" };
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return { error: "Skill name is required" };
  }

  const supabase = await createSupabaseServerClient();

  if (isDeptHead) {
    // Verify ownership of the department
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!department) {
      return { error: "Department not found or unauthorized" };
    }
  }

  const { error } = await supabase.from("department_skills").insert({
    department_id: departmentId,
    name: name.trim(),
    created_by: session.profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A skill with this name already exists in this department",
      };
    }
    return { error: "Failed to create skill. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

// ---------------------------------------------------------------------------
// bulkCreateSkills
// Elevated roles only (all_depts_leader, super_admin).
// Loops through names, inserts each, accumulates created/skipped counts.
// Duplicate (code 23505) is treated as skipped, not a fatal error.
// ---------------------------------------------------------------------------
export async function bulkCreateSkills(
  departmentId: string,
  names: string[],
): Promise<{ error?: string; created?: number; skipped?: number }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  if (!isElevated(role)) return { error: "Unauthorized" };

  if (!departmentId || typeof departmentId !== "string") {
    return { error: "Invalid department" };
  }
  if (!Array.isArray(names) || names.length === 0) {
    return { error: "No skill names provided" };
  }

  const trimmed = names
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && n.length <= 100);

  if (trimmed.length === 0) {
    return { error: "No valid skill names after trimming" };
  }

  const supabase = await createSupabaseServerClient();
  let created = 0;
  let skipped = 0;

  for (const name of trimmed) {
    const { error } = await supabase.from("department_skills").insert({
      department_id: departmentId,
      name,
      created_by: session.profile.id,
    });

    if (!error) {
      created++;
    } else if (error.code === "23505") {
      skipped++;
    } else {
      // Non-duplicate error: abort and report
      return {
        error: `Failed to insert "${name}": ${error.message}`,
        created,
        skipped,
      };
    }
  }

  revalidatePath("/skills");
  return { created, skipped };
}

// ---------------------------------------------------------------------------
// deleteDepartmentSkill
// dept_head: ownership check required.
// elevated: no ownership check — RLS handles it.
// ---------------------------------------------------------------------------
export async function deleteDepartmentSkill(
  skillId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !elevated) return { error: "Unauthorized" };

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }

  const supabase = await createSupabaseServerClient();

  // Fetch skill to get department_id (needed for ownership check on dept_head)
  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (isDeptHead) {
    // Verify ownership of the department
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("id", skill.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!department) {
      return { error: "Unauthorized" };
    }
  }

  const { error } = await supabase
    .from("department_skills")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", skillId);

  if (error) {
    return { error: "Failed to delete skill. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

// ---------------------------------------------------------------------------
// claimSkill — unchanged; volunteer-only.
// ---------------------------------------------------------------------------
export async function claimSkill(
  skillId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id, name")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  const { data: interest } = await supabase
    .from("volunteer_interests")
    .select("id")
    .eq("volunteer_id", session.profile.id)
    .eq("department_id", skill.department_id)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();

  if (!interest) {
    return {
      error:
        "You must have an approved interest in this department before claiming a skill",
    };
  }

  const { error } = await supabase.from("volunteer_skills").insert({
    volunteer_id: session.profile.id,
    skill_id: skill.id,
    department_id: skill.department_id,
    name: skill.name,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You have already claimed this skill" };
    }
    return { error: "Failed to claim skill. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

// ---------------------------------------------------------------------------
// withdrawSkillClaim — unchanged; volunteer-only.
// ---------------------------------------------------------------------------
export async function withdrawSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session || session.profile.role !== "volunteer") {
    return { error: "Unauthorized" };
  }

  if (!claimId || typeof claimId !== "string") {
    return { error: "Invalid claim" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_skills")
    .select("id, volunteer_id, status, deleted_at")
    .eq("id", claimId)
    .maybeSingle();

  if (
    !existing ||
    existing.volunteer_id !== session.profile.id ||
    existing.deleted_at !== null
  ) {
    return { error: "Skill claim not found" };
  }

  if (existing.status !== "pending") {
    return { error: "Only pending skill claims can be withdrawn" };
  }

  const { error } = await supabase
    .from("volunteer_skills")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", claimId);

  if (error) {
    return { error: "Failed to withdraw skill claim. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

// ---------------------------------------------------------------------------
// approveSkillClaim
// dept_head: ownership check on the claim's department.
// team_head: no ownership check — RLS policy "Team heads can review skill claims
//   in departments with owned teams" enforces scope.
// elevated (all_depts_leader, super_admin): no ownership check — RLS handles.
// ---------------------------------------------------------------------------
export async function approveSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const isTeamHead = role === "team_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !isTeamHead && !elevated) return { error: "Unauthorized" };

  if (!claimId || typeof claimId !== "string") {
    return { error: "Invalid claim" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_skills")
    .select("id, department_id, status, deleted_at")
    .eq("id", claimId)
    .maybeSingle();

  if (!existing || existing.deleted_at !== null) {
    return { error: "Skill claim not found" };
  }

  if (existing.status !== "pending") {
    return { error: "Only pending skill claims can be approved" };
  }

  if (isDeptHead) {
    // Verify ownership of the claim's department
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("id", existing.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!department) {
      return { error: "Unauthorized" };
    }
  }

  // team_head and elevated: RLS enforces scope; no extra check needed.

  const { error } = await supabase
    .from("volunteer_skills")
    .update({
      status: "approved",
      reviewed_by: session.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (error) {
    return { error: "Failed to approve skill claim. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

// ---------------------------------------------------------------------------
// rejectSkillClaim
// Same role guard pattern as approveSkillClaim.
// ---------------------------------------------------------------------------
export async function rejectSkillClaim(
  claimId: string,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const isTeamHead = role === "team_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !isTeamHead && !elevated) return { error: "Unauthorized" };

  if (!claimId || typeof claimId !== "string") {
    return { error: "Invalid claim" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("volunteer_skills")
    .select("id, department_id, status, deleted_at")
    .eq("id", claimId)
    .maybeSingle();

  if (!existing || existing.deleted_at !== null) {
    return { error: "Skill claim not found" };
  }

  if (existing.status !== "pending") {
    return { error: "Only pending skill claims can be rejected" };
  }

  if (isDeptHead) {
    // Verify ownership of the claim's department
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("id", existing.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!department) {
      return { error: "Unauthorized" };
    }
  }

  const { error } = await supabase
    .from("volunteer_skills")
    .update({
      status: "rejected",
      reviewed_by: session.profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId);

  if (error) {
    return { error: "Failed to reject skill claim. Please try again." };
  }

  revalidatePath("/skills");
  return { success: true };
}

// ---------------------------------------------------------------------------
// setSkillRequired
// dept_head: ownership check required.
// elevated: no ownership check — RLS handles.
// ---------------------------------------------------------------------------
export async function setSkillRequired(
  skillId: string,
  isRequired: boolean,
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSessionWithProfile();
  if (!session) return { error: "Unauthorized" };

  const role = session.profile.role;
  const isDeptHead = role === "dept_head";
  const elevated = isElevated(role);

  if (!isDeptHead && !elevated) return { error: "Unauthorized" };

  if (!skillId || typeof skillId !== "string") {
    return { error: "Invalid skill" };
  }
  if (typeof isRequired !== "boolean") {
    return { error: "isRequired must be a boolean" };
  }

  const supabase = await createSupabaseServerClient();

  const { data: skill } = await supabase
    .from("department_skills")
    .select("id, department_id")
    .eq("id", skillId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!skill) {
    return { error: "Skill not found" };
  }

  if (isDeptHead) {
    // Verify ownership of the department
    const { data: department } = await supabase
      .from("departments")
      .select("id")
      .eq("id", skill.department_id)
      .eq("owner_id", session.profile.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (!department) {
      return { error: "Unauthorized" };
    }
  }

  const { error } = await supabase
    .from("department_skills")
    .update({ is_required: isRequired })
    .eq("id", skillId)
    .is("deleted_at", null);

  if (error) {
    return { error: "Failed to update skill. Please try again." };
  }

  revalidatePath("/skills");
  revalidatePath("/events", "layout");
  return { success: true };
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/skills/actions.ts
git commit -m "feat(rs-f007): expand skills actions — elevated role guards + bulkCreateSkills"
```

---

## Task 3: Update `apps/web/lib/skills/queries.ts`

**Files:**
- Modify: `apps/web/lib/skills/queries.ts`

- [ ] **Step 1: Add `getSkillClaimsForTeamHead` and `getAllActiveDepartments` to the file**

Append the following two functions after the existing `getAllSkillClaims` function:

```typescript
/**
 * getSkillClaimsForTeamHead
 * Team head: all skill claims (deleted_at IS NULL, department_id IS NOT NULL)
 * in departments where the caller owns at least one active team.
 * Returns all statuses so the team-head view can render pending + reviewed rows.
 * RLS policy "Team heads can read skill claims in departments with owned teams"
 * automatically restricts the result set — the query shape is identical to
 * getSkillClaimsForScope().
 */
export async function getSkillClaimsForTeamHead(): Promise<
  SkillClaimWithVolunteer[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("volunteer_skills")
    .select(
      "*, volunteer:profiles!volunteer_id(display_name), department_skill:department_skills!skill_id(name), department:departments!department_id(name)",
    )
    .is("deleted_at", null)
    .not("department_id", "is", null)
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  type RawRow = VolunteerSkillClaim & {
    volunteer: { display_name: string } | null;
    department_skill: { name: string } | null;
    department: { name: string } | null;
  };

  return (data as unknown as RawRow[]).map((row) => ({
    ...row,
    volunteer_display_name: row.volunteer?.display_name ?? "Unknown",
    skill_name: row.department_skill?.name ?? row.name,
    department_name: row.department?.name ?? "Unknown",
  }));
}

/**
 * getAllActiveDepartments
 * Super admin / all_depts_leader: all active (non-deleted) departments.
 * Used to populate the department selector in the super admin skill creation form.
 * RLS on departments already restricts this to callers with the correct role.
 */
export async function getAllActiveDepartments(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return data as { id: string; name: string }[];
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/skills/queries.ts
git commit -m "feat(rs-f007): add getSkillClaimsForTeamHead and getAllActiveDepartments queries"
```

---

## Task 4: Update `apps/web/app/(app)/skills/page.tsx`

**Files:**
- Modify: `apps/web/app/(app)/skills/page.tsx`

- [ ] **Step 1: Replace the file contents**

```typescript
import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getDepartmentSkillsForLeader,
  getDepartmentSkillsForVolunteer,
  getMySkillClaims,
  getSkillClaimsForScope,
  getAllSkillClaims,
  getSkillClaimsForTeamHead,
  getAllActiveDepartments,
} from "@/lib/skills/queries";
import { VolunteerSkillsView } from "./_components/volunteer-skills-view";
import { LeaderSkillsView } from "./_components/leader-skills-view";
import { SuperAdminSkillsView } from "./_components/super-admin-skills-view";
import { TeamHeadSkillsView } from "./_components/team-head-skills-view";

export default async function SkillsPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  const { profile } = session;

  if (profile.role === "volunteer") {
    const [claims, catalogSkills] = await Promise.all([
      getMySkillClaims(profile.id),
      getDepartmentSkillsForVolunteer(profile.id),
    ]);
    return (
      <div className="mx-auto max-w-prose">
        <VolunteerSkillsView claims={claims} catalogSkills={catalogSkills} />
      </div>
    );
  }

  if (profile.role === "dept_head") {
    const [catalogSkills, claims] = await Promise.all([
      getDepartmentSkillsForLeader(),
      getSkillClaimsForScope(),
    ]);
    return <LeaderSkillsView catalogSkills={catalogSkills} claims={claims} />;
  }

  if (profile.role === "all_depts_leader") {
    // RLS returns all departments for all_depts_leader via the new policies.
    // getDepartmentSkillsForLeader() and getSkillClaimsForScope() use the same
    // queries as the dept_head path — RLS automatically broadens the result set.
    const [catalogSkills, claims] = await Promise.all([
      getDepartmentSkillsForLeader(),
      getSkillClaimsForScope(),
    ]);
    return <LeaderSkillsView catalogSkills={catalogSkills} claims={claims} />;
  }

  if (profile.role === "team_head") {
    const claims = await getSkillClaimsForTeamHead();
    return <TeamHeadSkillsView claims={claims} />;
  }

  if (profile.role === "super_admin") {
    const [catalogSkills, claims, allDepartments] = await Promise.all([
      getDepartmentSkillsForLeader(),
      getSkillClaimsForScope(),
      getAllActiveDepartments(),
    ]);
    return (
      <SuperAdminSkillsView
        catalogSkills={catalogSkills}
        claims={claims}
        allDepartments={allDepartments}
      />
    );
  }

  redirect("/dashboard");
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/skills/page.tsx
git commit -m "feat(rs-f007): update skills page — add team_head, all_depts_leader, expand super_admin branch"
```

---

## Task 5: Create `apps/web/app/(app)/skills/_components/team-head-skills-view.tsx`

**Files:**
- Create: `apps/web/app/(app)/skills/_components/team-head-skills-view.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import type { SkillClaimWithVolunteer } from "@/lib/skills/types";
import { SkillClaimCard } from "./skill-claim-card";

export function TeamHeadSkillsView({
  claims,
}: {
  claims: SkillClaimWithVolunteer[];
}) {
  if (claims.length === 0) {
    return (
      <div className="flex flex-col gap-500">
        <div>
          <h1 className="text-h2 text-neutral-950">Skill claims</h1>
          <p className="mt-100 text-body-sm text-neutral-600">
            Review and approve volunteer skill claims for your team&apos;s
            departments.
          </p>
        </div>
        <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 text-center">
          <p className="text-h3 text-neutral-950">No skill claims found.</p>
        </div>
      </div>
    );
  }

  const grouped = claims.reduce<Record<string, SkillClaimWithVolunteer[]>>(
    (acc, claim) => {
      const dept = claim.department_name;
      acc[dept] = [...(acc[dept] ?? []), claim];
      return acc;
    },
    {},
  );
  const departments = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-500">
      <div>
        <h1 className="text-h2 text-neutral-950">Skill claims</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Review and approve volunteer skill claims for your team&apos;s
          departments.
        </p>
      </div>
      <div className="flex flex-col gap-600">
        {departments.map((dept) => {
          const pendingCount = grouped[dept].filter(
            (c) => c.status === "pending",
          ).length;
          return (
            <section key={dept} className="flex flex-col gap-300">
              <div className="flex items-baseline gap-200">
                <h2 className="text-h3 text-neutral-950">{dept}</h2>
                <span className="text-body-sm text-neutral-600">
                  {pendingCount === 0
                    ? "All reviewed"
                    : `${pendingCount} pending`}
                </span>
              </div>
              <div className="grid gap-300 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[dept].map((claim) => (
                  <SkillClaimCard key={claim.id} claim={claim} readOnly={false} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/skills/_components/team-head-skills-view.tsx"
git commit -m "feat(rs-f007): add TeamHeadSkillsView component"
```

---

## Task 6: Update `apps/web/app/(app)/skills/_components/super-admin-skills-view.tsx`

**Files:**
- Modify: `apps/web/app/(app)/skills/_components/super-admin-skills-view.tsx`

- [ ] **Step 1: Replace the file contents**

```typescript
"use client";

import { useState, useTransition } from "react";
import type { SkillClaimWithVolunteer } from "@/lib/skills/types";
import type { DepartmentSkillWithName } from "@/lib/skills/queries";
import { createDepartmentSkill, bulkCreateSkills } from "@/lib/skills/actions";
import { LeaderSkillsView } from "./leader-skills-view";

// ---------------------------------------------------------------------------
// SkillCreationForm
// Provides a department selector, a single-skill text input, and a toggle to
// switch to a bulk textarea (one skill name per line).
// ---------------------------------------------------------------------------
function SkillCreationForm({
  allDepartments,
}: {
  allDepartments: { id: string; name: string }[];
}) {
  const [departmentId, setDepartmentId] = useState(
    allDepartments[0]?.id ?? "",
  );
  const [name, setName] = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await createDepartmentSkill(departmentId, name.trim());
      if (result?.error) {
        setError(result.error);
      } else {
        setName("");
        setSuccessMsg("Skill created.");
      }
    });
  }

  function handleBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    const names = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (names.length === 0) {
      setError("Enter at least one skill name.");
      return;
    }
    startTransition(async () => {
      const result = await bulkCreateSkills(departmentId, names);
      if (result?.error) {
        setError(result.error);
      } else {
        setBulkText("");
        setSuccessMsg(
          `Done — ${result.created} created, ${result.skipped} skipped (duplicates).`,
        );
      }
    });
  }

  if (allDepartments.length === 0) {
    return (
      <p className="text-body-sm text-neutral-600">
        No active departments. Create a department before adding skills.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-300 rounded-300 border border-neutral-300 bg-neutral-0 p-400">
      <div className="flex items-center justify-between gap-200">
        <h2 className="text-h3 text-neutral-950">Create skills</h2>
        <button
          type="button"
          onClick={() => {
            setBulkMode((prev) => !prev);
            setError(null);
            setSuccessMsg(null);
          }}
          className="text-body-sm text-brand-calm-600 underline underline-offset-2 transition-opacity duration-fast hover:opacity-70"
        >
          {bulkMode ? "Switch to single entry" : "Switch to bulk entry"}
        </button>
      </div>

      {/* Department selector — shared between modes */}
      <div className="flex flex-col gap-100">
        <label
          htmlFor="dept-select"
          className="text-body-sm font-medium text-neutral-700"
        >
          Department
        </label>
        <select
          id="dept-select"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          disabled={isPending}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
        >
          {allDepartments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {bulkMode ? (
        <form onSubmit={handleBulkSubmit} className="flex flex-col gap-200">
          <div className="flex flex-col gap-100">
            <label
              htmlFor="bulk-textarea"
              className="text-body-sm font-medium text-neutral-700"
            >
              Skill names (one per line)
            </label>
            <textarea
              id="bulk-textarea"
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setError(null);
                setSuccessMsg(null);
              }}
              disabled={isPending}
              rows={6}
              placeholder={"Piano\nGuitar\nSound mixing"}
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
            />
          </div>
          {error && <p className="text-body-sm text-semantic-error">{error}</p>}
          {successMsg && (
            <p className="text-body-sm text-semantic-success">{successMsg}</p>
          )}
          <button
            type="submit"
            disabled={bulkText.trim() === "" || isPending}
            className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
          >
            {isPending ? "Uploading…" : "Upload skills"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSingleSubmit} className="flex items-start gap-200">
          <div className="flex flex-1 flex-col gap-100">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
                setSuccessMsg(null);
              }}
              disabled={isPending}
              placeholder="New skill name"
              className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 placeholder:text-neutral-400 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
            />
            {error && (
              <p className="text-body-sm text-semantic-error">{error}</p>
            )}
            {successMsg && (
              <p className="text-body-sm text-semantic-success">{successMsg}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={name.trim() === "" || isPending}
            className="rounded-200 border border-neutral-300 px-300 py-200 text-body-sm font-medium text-neutral-700 transition-colors duration-fast hover:border-neutral-400 hover:text-neutral-950 disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add skill"}
          </button>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuperAdminSkillsView
// ---------------------------------------------------------------------------
export function SuperAdminSkillsView({
  catalogSkills,
  claims,
  allDepartments,
}: {
  catalogSkills: DepartmentSkillWithName[];
  claims: SkillClaimWithVolunteer[];
  allDepartments: { id: string; name: string }[];
}) {
  return (
    <div className="flex flex-col gap-600">
      <div>
        <h1 className="text-h1 text-neutral-950">Skills administration</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Create and manage skill catalogs across all departments, and review
          volunteer skill claims.
        </p>
      </div>
      <SkillCreationForm allDepartments={allDepartments} />
      <LeaderSkillsView catalogSkills={catalogSkills} claims={claims} />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/skills/_components/super-admin-skills-view.tsx"
git commit -m "feat(rs-f007): update SuperAdminSkillsView — SkillCreationForm with single/bulk entry"
```

---

## Task 7: Update docs

**Files:**
- Modify: `docs/features/feature-list.json`
- Modify: `docs/tracking/progress.md`

- [ ] **Step 1: Update `docs/features/feature-list.json`**

Locate the RS-F007 entry (line ~139) and make these edits:
- Change `"passes": false` to `"passes": true`
- Change `"revisionRequired": true` to `"revisionRequired": false`
- Replace the existing `"revisionNote"` value with:

```
"Revised 2026-04-08. Super Admin now creates skills via manual entry or bulk template upload (migration 00026, bulkCreateSkills action, SkillCreationForm). Both Dept Head and Team Head can approve/reject volunteer skill claims within their scope (expanded RLS policies + role guards). all_depts_leader gets full read+write. /skills page routes all six roles correctly."
```

- [ ] **Step 2: Update `docs/tracking/progress.md`**

In the "Completed Milestones" section, add after the last RS-F006 entry:

```
- RS-F007 revision plan drafted and approved (2026-04-08)
- RS-F007 revision implemented (2026-04-08): migration 00026 (new RLS policies for super_admin/all_depts_leader/team_head on both skills tables); actions expanded with dual-branch role guards + bulkCreateSkills; getSkillClaimsForTeamHead + getAllActiveDepartments queries added; /skills page routes all 6 roles; TeamHeadSkillsView created; SuperAdminSkillsView updated with SkillCreationForm (single + bulk entry)
- RS-F007 marked passes=true
```

In the Feature Status table, change the RS-F007 row from `revision_required` to `passed`.

- [ ] **Step 3: Commit**

```bash
git add docs/features/feature-list.json docs/tracking/progress.md
git commit -m "docs(rs-f007): mark passes=true, update progress tracker"
```

---

## Objective

Enable Super Admin to define department skill catalogs via manual entry or line-by-line bulk upload. Ensure both Dept Head and Team Head can approve, edit (via Required toggle), and remove volunteer skill claims within their authorized scope. Ensure all_depts_leader has equivalent read+write access. Ensure only approved skills feed planning and gap detection logic (gap logic already gates on `status = 'approved'` — no change needed there).

---

## Scope and Non-Goals

**In scope:**
- Migration 00026: drop two stale `sub_leader` policies from 00012; add RLS policies for `super_admin`, `all_depts_leader`, and `team_head` on `department_skills` and `volunteer_skills`
- Expand 5 server action role guards from `dept_head`-only to multi-role
- Add `bulkCreateSkills` server action (elevated roles only)
- Add `getSkillClaimsForTeamHead` and `getAllActiveDepartments` queries
- Route `team_head` and `all_depts_leader` to correct skill views on `/skills`
- Create `TeamHeadSkillsView` component
- Rework `SuperAdminSkillsView` to include `SkillCreationForm` + delegate claim rendering to `LeaderSkillsView`
- Update feature-list.json and progress.md

**Not in scope:**
- Bulk CSV file upload (clipboard text only in this pass)
- Supporter role skills surface
- Skill notifications (RS-F013)
- Skill gap detection changes (RS-F009 already landed)

---

## Rollout / Migration / Access Impact

Migration 00026 is additive only (new CREATE POLICY statements plus two DROP POLICY for stale names). No table structure changes, no data mutations, no column additions. Safe to run with zero downtime.

Access impact: `super_admin` and `all_depts_leader` gain INSERT+UPDATE on `department_skills` and SELECT+UPDATE on `volunteer_skills`. `team_head` gains SELECT on `department_skills` for their departments and SELECT+UPDATE on `volunteer_skills` for their departments. These are strictly additive grants — no existing policy is weakened.

---

## Acceptance Criteria Mapping

| Feature step | Implementation |
|---|---|
| Allow Super Admin to define skills via manual entry or bulk template upload | `bulkCreateSkills` action + `SkillCreationForm` component with single/bulk toggle in `SuperAdminSkillsView`; RLS policies 2–6 in migration 00026 |
| Allow volunteers to add skills to their profiles (pending approval) | Already implemented; unchanged |
| Allow both Dept Heads and Team Heads to approve, edit, or remove volunteer skill claims within their scope | RLS policies 12–13 in migration 00026; expanded role guards on `approveSkillClaim`, `rejectSkillClaim`, `deleteDepartmentSkill`, `setSkillRequired`; `TeamHeadSkillsView` renders `SkillClaimCard readOnly={false}`; `team_head` branch in page.tsx |
| Ensure only approved skills feed planning and gap detection logic | Gap detection in RS-F009 already gates on `status = 'approved'`; no change needed |

---

## Style Guardrails For UI Work

- Follows existing token conventions: `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-body-sm`, spacing tokens `gap-100` through `gap-600`, `rounded-200`, `rounded-300`, `border-neutral-300`, `bg-neutral-0`, `text-neutral-950/700/600/400`, `brand-calm-600`
- `SkillCreationForm` uses the same input/button styles as `DepartmentSkillCatalog`'s inline add form
- The bulk textarea uses consistent border/focus ring styling with the single-entry input
- The "Switch to bulk entry / single entry" toggle uses the `underline underline-offset-2` link pattern
- Empty state in `TeamHeadSkillsView` mirrors the existing `SuperAdminSkillsView` empty state pattern
- No loading spinners introduced; `disabled={isPending}` + label changes (`"Adding…"`, `"Uploading…"`) provide feedback
- Copy tone: professional, imperative, sentence-case. No exclamation marks

---

## Risks or Blockers

1. **Policy name collision on 00024**: Migration 00024 already created `"Team heads can read skills for owned team departments"` on `department_skills` and `"Team heads can read approved skills in owned team departments"` on `volunteer_skills`. The new 00026 policies use different names and different scopes (00026 adds review/write for team_head on `volunteer_skills`; 00024's policy is read-only for approved rows only). No collision — but verify during `db reset` that names are distinct.
2. **team_head UPDATE scope on volunteer_skills**: The RLS WITH CHECK clause requires `reviewed_by = auth.uid()`, which matches the action writing `reviewed_by: session.profile.id`. This is consistent with the existing dept_head policy in 00009.
3. **`all_depts_leader` uses `getSkillClaimsForScope()`**: This query has no `get_my_role()` filter at the Supabase SDK layer — it relies entirely on RLS. The new SELECT policy for `all_depts_leader` on `volunteer_skills` ensures the query returns all rows across all departments. Same applies to `getDepartmentSkillsForLeader()`. Verify with a live `all_depts_leader` session after migration.
4. **`LeaderSkillsView` renders `DepartmentSkillCatalog`** which calls `createDepartmentSkill` and `deleteDepartmentSkill`. When `all_depts_leader` uses this view, those actions now permit their role. When `super_admin` uses it via `SuperAdminSkillsView`, same applies. No code change needed — the action layer already handles this after Task 2.

---

## Validation Plan

1. `npx supabase db reset` — confirm all 26 migrations apply cleanly with no errors
2. `cd apps/web && npx tsc --noEmit` — zero type errors
3. `npm run lint` — zero lint errors
4. `npm run build` — clean build
5. Sign in as `super_admin`: navigate to `/skills` — verify `SkillCreationForm` renders with department selector; verify single-entry creates a skill; verify bulk entry (3 names, 1 duplicate) returns "2 created, 1 skipped"; verify existing skill claim `Approve` and `Reject` buttons work
6. Sign in as `all_depts_leader`: navigate to `/skills` — verify `LeaderSkillsView` renders with skills from all departments; verify `Add skill` form works; verify `Approve`/`Reject` on pending claims works
7. Sign in as `dept_head`: navigate to `/skills` — existing behavior preserved; verify `Approve`/`Reject` still works
8. Sign in as `team_head`: navigate to `/skills` — verify `TeamHeadSkillsView` renders claims from their departments; verify `Approve`/`Reject` buttons appear on pending claims and work
9. Sign in as `volunteer`: navigate to `/skills` — verify unchanged experience
10. Verify gap detection: approve a skill as team_head, confirm the approved skill is counted in RS-F009 gap coverage (status filter is `approved` — no regression expected)

---

## Documentation Updates

- `docs/features/feature-list.json` — RS-F007 `passes: true`, `revisionRequired: false`, revisionNote updated (Task 7)
- `docs/tracking/progress.md` — RS-F007 revision milestone + status table updated to `passed` (Task 7)

---

### Critical Files for Implementation

- `/c/Projects/RosteringSystem/supabase/migrations/00026_skills_role_expansion.sql` (create new)
- `/c/Projects/RosteringSystem/apps/web/lib/skills/actions.ts`
- `/c/Projects/RosteringSystem/apps/web/lib/skills/queries.ts`
- `/c/Projects/RosteringSystem/apps/web/app/(app)/skills/page.tsx`
- `/c/Projects/RosteringSystem/apps/web/app/(app)/skills/_components/super-admin-skills-view.tsx`

---

The plan above is the complete, zero-ambiguity implementation plan for RS-F007 revision. It must be saved to `docs/plans/plan-rs-f007-skill-profile-and-approval.md`. Since I am operating in read-only planning mode, the agentic worker executing this plan should write the file contents above (from the `# RS-F007 Revision:` heading through the Critical Files section) to that path before beginning Task 1.