import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import { getEventById } from "@/lib/events/queries";
import { getProfilesByRole } from "@/lib/departments/queries";
import { createDepartment } from "@/lib/departments/actions";
import { DepartmentForm } from "../_components/department-form";

export default async function NewDepartmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!hasMinimumRole(session.profile.role, "super_admin")) {
    const { id } = await params;
    redirect(`/events/${id}`);
  }

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const ownerProfiles = await getProfilesByRole("dept_head");

  return (
    <div className="flex flex-col gap-400">
      <Link
        href={`/events/${id}`}
        className="text-body-sm text-neutral-600 hover:text-neutral-950 hover:underline"
      >
        &larr; Back to event
      </Link>

      <div>
        <h1 className="font-display text-h1 text-neutral-950">Add department</h1>
        <p className="mt-100 text-body-sm text-neutral-600">{event.title}</p>
      </div>

      <div className="max-w-lg rounded-200 border border-neutral-300 bg-neutral-0 p-500">
        <DepartmentForm
          eventId={id}
          ownerProfiles={ownerProfiles}
          action={createDepartment}
        />
      </div>
    </div>
  );
}
