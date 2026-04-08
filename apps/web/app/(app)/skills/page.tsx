import { redirect } from "next/navigation";
import { getSessionWithProfile } from "@/lib/auth/session";
import {
  getDepartmentSkillsForLeader,
  getDepartmentSkillsForVolunteer,
  getMySkillClaims,
  getSkillClaimsForScope,
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
    // RLS returns all departments for all_depts_leader via the new policies in 00026.
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
