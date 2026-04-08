import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole, canManageThisEvent } from "@/lib/auth/roles";
import { getEventById } from "@/lib/events/queries";
import { getDepartmentsByEventId, getOwnerDisplayNames } from "@/lib/departments/queries";
import { EventDetailCard } from "../_components/event-detail-card";
import { DepartmentListSection } from "./departments/_components/department-list-section";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!isLeaderRole(session.profile.role)) redirect("/dashboard");

  const { id } = await params;
  const [event, departments] = await Promise.all([
    getEventById(id),
    getDepartmentsByEventId(id),
  ]);
  if (!event) notFound();

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");
  const canManage = canManageThisEvent(session.profile, event);

  // Build owner display name map from the actual owner IDs present in this event's departments
  const ownerIds = departments
    .map((d) => d.owner_id)
    .filter((id): id is string => id !== null);
  const ownerNames = await getOwnerDisplayNames(ownerIds);

  return (
    <div className="flex flex-col gap-400">
      <Link
        href="/events"
        className="text-body-sm text-neutral-600 hover:text-neutral-950"
      >
        &larr; Back to events
      </Link>

      <EventDetailCard event={event} canManage={canManage} />

      <DepartmentListSection
        eventId={id}
        departments={departments}
        ownerNames={ownerNames}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
