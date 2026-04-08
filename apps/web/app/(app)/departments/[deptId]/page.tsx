import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import {
  getDepartmentById,
  getOwnerDisplayNames,
  getTeamHeadcountRequirements,
} from "@/lib/departments/queries";
import { DepartmentDetailCard } from "./_components/department-detail-card";
import { TeamListSection } from "./_components/team-list-section";
import { HeadcountRequirementsSection } from "./_components/headcount-requirements-section";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!isLeaderRole(session.profile.role)) redirect("/dashboard");

  const { deptId } = await params;
  const department = await getDepartmentById(deptId);
  if (!department) notFound();

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isTeamHead = session.profile.role === "team_head";
  const isDeptHeadOwner =
    session.profile.role === "dept_head" &&
    department.owner_id === session.profile.id;
  const canManage = isSuperAdmin || isDeptHeadOwner;

  const ownerIds = [
    department.owner_id,
    ...department.teams.map((t) => t.owner_id),
  ].filter((id): id is string => id !== null);
  const ownerNames = await getOwnerDisplayNames(ownerIds);

  // team_head sees only their own team's headcount requirements
  const visibleTeamsForHeadcount = isTeamHead
    ? department.teams.filter((t) => t.owner_id === session.profile.id)
    : department.teams;

  const requirementsByTeam: Record<
    string,
    Awaited<ReturnType<typeof getTeamHeadcountRequirements>>
  > = {};
  if (canManage || isTeamHead) {
    await Promise.all(
      visibleTeamsForHeadcount.map(async (team) => {
        requirementsByTeam[team.id] = await getTeamHeadcountRequirements(team.id);
      })
    );
  }

  const ownerName = ownerNames[department.owner_id ?? ""] ?? "Unassigned";

  return (
    <div className="flex flex-col gap-400">
      <Link
        href="/departments"
        className="text-body-sm text-neutral-600 hover:text-neutral-950"
      >
        &larr; Back to departments
      </Link>

      <DepartmentDetailCard
        department={department}
        ownerName={ownerName}
        isSuperAdmin={isSuperAdmin}
      />

      <TeamListSection
        departmentId={deptId}
        teams={department.teams}
        ownerNames={ownerNames}
        canManage={canManage}
      />

      {(canManage || isTeamHead) && (
        <HeadcountRequirementsSection
          teams={visibleTeamsForHeadcount}
          requirementsByTeam={requirementsByTeam}
          canManage={canManage}
        />
      )}
    </div>
  );
}
