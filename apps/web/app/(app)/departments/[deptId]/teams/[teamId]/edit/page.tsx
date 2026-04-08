import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import {
  getDepartmentById,
  getTeamById,
  getProfilesByRole,
} from "@/lib/departments/queries";
import { updateTeam } from "@/lib/departments/actions";
import { TeamForm } from "../../../_components/team-form";

export default async function EditTeamPage({
  params,
}: {
  params: Promise<{ deptId: string; teamId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { deptId, teamId } = await params;
  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) redirect(`/departments/${deptId}`);

  const [department, team] = await Promise.all([
    getDepartmentById(deptId),
    getTeamById(teamId),
  ]);
  if (!department || !team) notFound();

  // Check ownership before fetching team_head profiles to avoid leaking
  // the profile list to a dept_head who doesn't own this department.
  if (isDeptHead && department.owner_id !== session.profile.id) {
    redirect(`/departments/${deptId}`);
  }

  const teamHeadProfiles = await getProfilesByRole("team_head");

  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/departments/${deptId}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950"
      >
        &larr; Back to {department.name}
      </Link>
      <h1 className="font-display text-h1 text-neutral-950">Edit team</h1>
      <TeamForm
        mode="edit"
        departmentId={deptId}
        existing={team}
        teamHeadProfiles={teamHeadProfiles}
        action={updateTeam}
      />
    </div>
  );
}
