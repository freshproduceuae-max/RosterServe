import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import { getDepartmentById, getOwnerDisplayNames } from "@/lib/departments/queries";
import { DepartmentDetailCard } from "./_components/department-detail-card";

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string; deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!isLeaderRole(session.profile.role)) redirect("/dashboard");

  const { id: eventId, deptId } = await params;
  const department = await getDepartmentById(deptId);
  if (!department) notFound();

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const isDeptHeadOwner =
    session.profile.role === "dept_head" &&
    department.owner_id === session.profile.id;
  const canManage = isSuperAdmin || isDeptHeadOwner;

  // Sub-leaders reach this page via isLeaderRole but canManage is false.
  // They should still see the Roster link if they own a sub-team in this dept.
  const isSubLeaderInDept =
    session.profile.role === "sub_leader" &&
    department.sub_teams.some(
      (st) => st.owner_id === session.profile.id && st.deleted_at === null,
    );
  const canViewRoster = canManage || isSubLeaderInDept;

  // Collect only the owner IDs actually present on this department and its sub-teams
  const ownerIds = [
    department.owner_id,
    ...department.sub_teams.map((st) => st.owner_id),
  ].filter((id): id is string => id !== null);
  const ownerNames = await getOwnerDisplayNames(ownerIds);

  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/events/${eventId}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950 hover:underline"
      >
        &larr; Back to event
      </Link>

      <DepartmentDetailCard
        eventId={eventId}
        department={department}
        ownerNames={ownerNames}
        isSuperAdmin={isSuperAdmin}
        canManage={canManage}
        canViewRoster={canViewRoster}
      />
    </div>
  );
}
