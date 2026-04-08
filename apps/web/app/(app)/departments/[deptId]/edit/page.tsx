import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import { getDepartmentById, getProfilesByRole } from "@/lib/departments/queries";
import { updateDepartment } from "@/lib/departments/actions";
import { DepartmentForm } from "../../_components/department-form";

export default async function EditDepartmentPage({
  params,
}: {
  params: Promise<{ deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { deptId } = await params;

  if (!hasMinimumRole(session.profile.role, "super_admin")) {
    redirect(`/departments/${deptId}`);
  }

  const [department, deptHeadProfiles] = await Promise.all([
    getDepartmentById(deptId),
    getProfilesByRole("dept_head"),
  ]);
  if (!department) notFound();

  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/departments/${deptId}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950"
      >
        &larr; Back to {department.name}
      </Link>
      <h1 className="font-display text-h1 text-neutral-950">Edit department</h1>
      <DepartmentForm
        mode="edit"
        existing={department}
        deptHeadProfiles={deptHeadProfiles}
        action={updateDepartment}
      />
    </div>
  );
}
