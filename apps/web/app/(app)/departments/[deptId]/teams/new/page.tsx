import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import { getDepartmentById, getProfilesByRole } from "@/lib/departments/queries";
import { createTeam } from "@/lib/departments/actions";
import { TeamForm } from "../../_components/team-form";

export default async function NewTeamPage({
  params,
}: {
  params: Promise<{ deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { deptId } = await params;
  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) redirect(`/departments/${deptId}`);

  const [department, teamHeadProfiles] = await Promise.all([
    getDepartmentById(deptId),
    getProfilesByRole("team_head"),
  ]);
  if (!department) notFound();

  // Dept head can only create teams in departments they own
  if (isDeptHead && department.owner_id !== session.profile.id) {
    redirect(`/departments/${deptId}`);
  }

  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/departments/${deptId}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950"
      >
        &larr; Back to {department.name}
      </Link>
      <h1 className="font-display text-h1 text-neutral-950">New team</h1>
      <TeamForm
        mode="create"
        departmentId={deptId}
        teamHeadProfiles={teamHeadProfiles}
        action={createTeam}
      />
    </div>
  );
}
