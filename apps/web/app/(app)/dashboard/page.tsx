import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getVolunteerDashboardData,
  getDeptHeadDashboardData,
  getTeamHeadDashboardData,
  getSuperAdminDashboardData,
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
    return <AllDeptsLeaderDashboard displayName={displayName} />;
  }

  if (profile.role === "dept_head") {
    const data = await getDeptHeadDashboardData(profile.id);
    return <DeptHeadDashboard data={data} displayName={displayName} />;
  }

  if (profile.role === "team_head") {
    const data = await getTeamHeadDashboardData(profile.id);
    return <TeamHeadDashboard data={data} displayName={displayName} />;
  }

  if (profile.role === "supporter") {
    return <SupporterDashboard displayName={displayName} />;
  }

  // Default: volunteer
  const data = await getVolunteerDashboardData(profile.id);
  return <VolunteerDashboard data={data} displayName={displayName} />;
}
