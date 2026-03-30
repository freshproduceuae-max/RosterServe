import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getDepartmentSkillsForLeader,
  getDepartmentSkillsForVolunteer,
  getMySkillClaims,
  getSkillClaimsForScope,
  getAllSkillClaims,
} from "@/lib/skills/queries";
import { VolunteerSkillsView } from "./_components/volunteer-skills-view";
import { LeaderSkillsView } from "./_components/leader-skills-view";
import { SuperAdminSkillsView } from "./_components/super-admin-skills-view";

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

  if (profile.role === "super_admin") {
    const claims = await getAllSkillClaims();
    return <SuperAdminSkillsView claims={claims} />;
  }

  redirect("/dashboard");
}
