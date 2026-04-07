import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { hasMinimumRole } from "@/lib/auth/roles";
import { EventForm } from "../_components/event-form";

export default async function NewEventPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  // all_depts_leader can create events by default (RS-F001).
  // Dept Head / Team Head grants are handled in RS-F002.
  if (!hasMinimumRole(session.profile.role, "all_depts_leader")) redirect("/events");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-400">
      <div className="flex flex-col gap-100">
        <Link
          href="/events"
          className="text-body-sm text-neutral-600 hover:text-neutral-950"
        >
          &larr; Back to events
        </Link>
        <h1 className="font-display text-h1 text-neutral-950">Create event</h1>
      </div>

      <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 shadow-soft">
        <EventForm />
      </div>
    </div>
  );
}
