import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, hasMinimumRole } from "@/lib/auth/roles";
import { getEventById } from "@/lib/events/queries";
import { EventDetailCard } from "../_components/event-detail-card";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!isLeaderRole(session.profile.role)) redirect("/dashboard");

  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();

  const isSuperAdmin = hasMinimumRole(session.profile.role, "super_admin");

  return (
    <div className="flex flex-col gap-400">
      <Link
        href="/events"
        className="text-body-sm text-neutral-600 hover:text-neutral-950"
      >
        &larr; Back to events
      </Link>

      <EventDetailCard event={event} isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
