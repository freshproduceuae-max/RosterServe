import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import { getAllDepartments, getOwnerDisplayNames } from "@/lib/departments/queries";
import { DepartmentListTable } from "./_components/department-list-table";

export default async function DepartmentsPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!isLeaderRole(session.profile.role)) redirect("/dashboard");

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const departments = await getAllDepartments();

  const ownerIds = departments
    .map((d) => d.owner_id)
    .filter((id): id is string => id !== null);
  const ownerNames = await getOwnerDisplayNames(ownerIds);

  return (
    <div className="flex flex-col gap-400">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-h1 text-neutral-950">Departments</h1>
        {isSuperAdmin && (
          <Link
            href="/departments/new"
            className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
          >
            Add department
          </Link>
        )}
      </div>

      <DepartmentListTable
        departments={departments}
        ownerNames={ownerNames}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
