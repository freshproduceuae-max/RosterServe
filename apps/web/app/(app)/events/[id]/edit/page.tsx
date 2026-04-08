import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { canManageEvents, canManageThisEvent } from "@/lib/auth/roles";
import { getEventById } from "@/lib/events/queries";
import { EventForm } from "../../_components/event-form";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  const { id } = await params;

  // Entry check: does this user have any event management capability?
  if (!canManageEvents(session.profile)) redirect(`/events/${id}`);

  const event = await getEventById(id);
  if (!event) notFound();

  // Completed events cannot be edited
  if (event.status === "completed") redirect(`/events/${id}`);

  // Ownership check: granted dept_head/team_head can only edit events they created
  if (!canManageThisEvent(session.profile, event)) redirect(`/events/${id}`);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-400">
      <div className="flex flex-col gap-100">
        <Link
          href={`/events/${id}`}
          className="text-body-sm text-neutral-600 hover:text-neutral-950"
        >
          &larr; Back to event
        </Link>
        <h1 className="font-display text-h1 text-neutral-950">Edit event</h1>
      </div>

      <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-soft">
        <EventForm event={event} />
      </div>
    </div>
  );
}
