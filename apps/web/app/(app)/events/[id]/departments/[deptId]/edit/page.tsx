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
  params: Promise<{ id: string; deptId: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");

  const { id: eventId, deptId } = await params;

  if (!hasMinimumRole(session.profile.role, "super_admin")) {
    redirect(`/events/${eventId}/departments/${deptId}`);
  }

  const [department, ownerProfiles] = await Promise.all([
    getDepartmentById(deptId),
    getProfilesByRole("dept_head"),
  ]);

  if (!department) notFound();

  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/events/${eventId}/departments/${deptId}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950 hover:underline"
      >
        &larr; Back to department
      </Link>

      <h1 className="font-display text-h1 text-neutral-950">Edit department</h1>

      <div className="max-w-lg rounded-200 border border-neutral-300 bg-neutral-0 p-500">
        <DepartmentForm
          eventId={eventId}
          ownerProfiles={ownerProfiles}
          action={updateDepartment}
          existing={department}
        />
      </div>
    </div>
  );
}
