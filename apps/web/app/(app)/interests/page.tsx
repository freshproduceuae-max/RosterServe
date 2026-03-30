import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getMyInterests,
  getPendingInterestsForScope,
  getAllInterests,
  getDepartmentsAvailableToJoin,
} from "@/lib/interests/queries";
import { VolunteerInterestsView } from "./_components/volunteer-interests-view";
import { LeaderInterestsView } from "./_components/leader-interests-view";
import { SuperAdminInterestsView } from "./_components/super-admin-interests-view";

export default async function InterestsPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { profile } = session;

  if (profile.role === "volunteer") {
    const [interests, availableDepartments] = await Promise.all([
      getMyInterests(profile.id),
      getDepartmentsAvailableToJoin(profile.id),
    ]);
    return (
      <div className="mx-auto max-w-prose">
        <VolunteerInterestsView
          interests={interests}
          availableDepartments={availableDepartments}
        />
      </div>
    );
  }

  if (profile.role === "dept_head") {
    const interests = await getPendingInterestsForScope();
    return <LeaderInterestsView interests={interests} />;
  }

  if (profile.role === "super_admin") {
    const interests = await getAllInterests();
    return <SuperAdminInterestsView interests={interests} />;
  }

  redirect("/dashboard");
}
