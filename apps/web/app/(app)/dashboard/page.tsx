import { redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getVolunteerDashboardData,
  getDeptHeadDashboardData,
  getSubLeaderDashboardData,
  getSuperAdminDashboardData,
} from "@/lib/dashboard/queries";
import { VolunteerDashboard } from "./_components/volunteer-dashboard";
import { DeptHeadDashboard } from "./_components/dept-head-dashboard";
import { SubLeaderDashboard } from "./_components/sub-leader-dashboard";
import { SuperAdminDashboard } from "./_components/super-admin-dashboard";

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

  if (profile.role === "dept_head") {
    const data = await getDeptHeadDashboardData(profile.id);
    return <DeptHeadDashboard data={data} displayName={displayName} />;
  }

  if (profile.role === "sub_leader") {
    const data = await getSubLeaderDashboardData(profile.id);
    return <SubLeaderDashboard data={data} displayName={displayName} />;
  }

  // Default: volunteer
  const data = await getVolunteerDashboardData(profile.id);
  return <VolunteerDashboard data={data} displayName={displayName} />;
}
