import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import { getDepartmentById, getProfilesByRole } from "@/lib/departments/queries";
import { createSubTeam } from "@/lib/departments/actions";
import { SubTeamForm } from "../../../_components/sub-team-form";

export default async function NewSubTeamPage({
  params,
}: {
  params: Promise<{ id: string; deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { id: eventId, deptId } = await params;

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHead = session.profile.role === "dept_head";

  if (!isSuperAdmin && !isDeptHead) {
    redirect(`/events/${eventId}/departments/${deptId}`);
  }

  const [department, ownerProfiles] = await Promise.all([
    getDepartmentById(deptId),
    getProfilesByRole("team_head"),
  ]);

  if (!department) notFound();

  // Dept head must own this department
  if (isDeptHead && department.owner_id !== session.profile.id) {
    redirect(`/events/${eventId}/departments/${deptId}`);
  }

  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/events/${eventId}/departments/${deptId}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950 hover:underline"
      >
        &larr; Back to department
      </Link>

      <div>
        <h1 className="font-display text-h1 text-neutral-950">Add sub-team</h1>
        <p className="mt-100 text-body-sm text-neutral-600">{department.name}</p>
      </div>

      <div className="max-w-lg rounded-200 border border-neutral-300 bg-neutral-0 p-500">
        <SubTeamForm
          departmentId={deptId}
          ownerProfiles={ownerProfiles}
          action={createSubTeam}
        />
      </div>
    </div>
  );
}
