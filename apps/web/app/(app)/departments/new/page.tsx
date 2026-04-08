import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import { getProfilesByRole } from "@/lib/departments/queries";
import { createDepartment } from "@/lib/departments/actions";
import { DepartmentForm } from "../_components/department-form";

export default async function NewDepartmentPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!hasMinimumRole(session.profile.role, "super_admin")) redirect("/departments");

  const deptHeadProfiles = await getProfilesByRole("dept_head");

  return (
    <div className="flex flex-col gap-400">
      <Link
        href="/departments"
        className="text-body-sm text-neutral-600 hover:text-neutral-950"
      >
        &larr; Back to departments
      </Link>
      <h1 className="font-display text-h1 text-neutral-950">New department</h1>
      <DepartmentForm
        mode="create"
        deptHeadProfiles={deptHeadProfiles}
        action={createDepartment}
      />
    </div>
  );
}
