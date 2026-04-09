import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getVolunteerDashboardData,
  getDeptHeadDashboardData,
  getTeamHeadDashboardData,
  getSuperAdminDashboardData,
  getAllDeptsLeaderDashboardData,
  getSupporterDashboardData,
} from "@/lib/dashboard/queries";
import { VolunteerDashboard } from "./_components/volunteer-dashboard";
import { DeptHeadDashboard } from "./_components/dept-head-dashboard";
import { TeamHeadDashboard } from "./_components/team-head-dashboard";
import { SuperAdminDashboard } from "./_components/super-admin-dashboard";
import { AllDeptsLeaderDashboard } from "./_components/all-depts-leader-dashboard";
import { SupporterDashboard } from "./_components/supporter-dashboard";

export default async function DashboardPage() {
  // Opt out of the full-route cache so dashboard data is fresh on every
  // navigation. Note: rename to noStore() (no unstable_ prefix) on Next.js 15+.
  noStore();

  const session = await getSessionWithProfile();
  if (!session) {
    redirect("/sign-in");
  }

  const { profile } = session;
  const displayName = profile.display_name ?? "there";

  if (profile.role === "super_admin") {
    const data = await getSuperAdminDashboardData();
    return <SuperAdminDashboard data={data} />;
  }

  if (profile.role === "all_depts_leader") {
    const data = await getAllDeptsLeaderDashboardData();
    return <AllDeptsLeaderDashboard data={data} displayName={displayName} />;
  }

  if (profile.role === "dept_head") {
    const data = await getDeptHeadDashboardData(profile.id);

    // Build teamsByDept for rotation section — only fetch depts referenced in rotation entries
    type RotatableTeam = { id: string; department_id: string; name: string; rotation_label: "A" | "B" | "C" };
    const teamsByDept = new Map<string, RotatableTeam[]>();
    const rotationDeptIds = [...new Set(data.rotationEntries.map((e) => e.departmentId))];
    if (rotationDeptIds.length > 0) {
      const supabase = await createSupabaseServerClient();
      const { data: teamRows } = await supabase
        .from("teams")
        .select("id, department_id, name, rotation_label")
        .in("department_id", rotationDeptIds)
        .not("rotation_label", "is", null)
        .is("deleted_at", null);
      for (const t of (teamRows ?? []) as RotatableTeam[]) {
        if (!teamsByDept.has(t.department_id)) teamsByDept.set(t.department_id, []);
        teamsByDept.get(t.department_id)!.push(t);
      }
    }

    return <DeptHeadDashboard data={data} displayName={displayName} teamsByDept={teamsByDept} />;
  }

  if (profile.role === "team_head") {
    const data = await getTeamHeadDashboardData(profile.id);
    return <TeamHeadDashboard data={data} displayName={displayName} />;
  }

  if (profile.role === "supporter") {
    const data = await getSupporterDashboardData(profile.id);
    return <SupporterDashboard data={data} displayName={displayName} />;
  }

  // Default: volunteer
  const data = await getVolunteerDashboardData(profile.id);
  return <VolunteerDashboard data={data} displayName={displayName} />;
}
