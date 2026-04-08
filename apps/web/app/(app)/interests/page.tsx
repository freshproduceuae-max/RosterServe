import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getMyInterests,
  getPendingInterestsForScope,
  getAllInterests,
  getDepartmentsAvailableToJoin,
  getTeamsByDepartmentIds,
} from "@/lib/interests/queries";
import { getMyMemberships } from "@/lib/memberships/queries";
import { VolunteerInterestsView } from "./_components/volunteer-interests-view";
import { LeaderInterestsView } from "./_components/leader-interests-view";
import { SuperAdminInterestsView } from "./_components/super-admin-interests-view";

export default async function InterestsPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { profile } = session;

  if (profile.role === "volunteer") {
    const [interests, availableDepartments, memberships] = await Promise.all([
      getMyInterests(profile.id),
      getDepartmentsAvailableToJoin(profile.id),
      getMyMemberships(profile.id),
    ]);
    return (
      <div className="mx-auto max-w-prose">
        <VolunteerInterestsView
          interests={interests}
          availableDepartments={availableDepartments}
          memberships={memberships}
        />
      </div>
    );
  }

  if (profile.role === "dept_head") {
    const interests = await getPendingInterestsForScope();
    const departmentIds = [...new Set(interests.map((i) => i.department_id))];
    const departmentTeams = await getTeamsByDepartmentIds(departmentIds);
    return <LeaderInterestsView interests={interests} departmentTeams={departmentTeams} />;
  }

  if (profile.role === "super_admin") {
    const interests = await getAllInterests();
    return <SuperAdminInterestsView interests={interests} />;
  }

  redirect("/dashboard");
}
