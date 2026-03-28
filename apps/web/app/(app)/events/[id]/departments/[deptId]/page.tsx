import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import { getDepartmentById, getProfilesByRole } from "@/lib/departments/queries";
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

  const [deptHeadProfiles, subLeaderProfiles] = await Promise.all([
    getProfilesByRole("dept_head"),
    getProfilesByRole("sub_leader"),
  ]);

  const ownerNames = Object.fromEntries(
    [...deptHeadProfiles, ...subLeaderProfiles].map((p) => [p.id, p.display_name])
  );

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
      />
    </div>
  );
}
