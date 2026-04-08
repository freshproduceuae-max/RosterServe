import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { getGrantableUsers } from "@/lib/events/grants";
import { GrantList } from "./_components/grant-list";

export default async function EventGrantsPage() {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (session.profile.role !== "super_admin") redirect("/events");

  const users = await getGrantableUsers();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-400">
      <div className="flex flex-col gap-100">
        <Link
          href="/events"
          className="text-body-sm text-neutral-600 hover:text-neutral-950"
        >
          &larr; Back to events
        </Link>
        <h1 className="font-display text-h1 text-neutral-950">
          Event creation grants
        </h1>
        <p className="text-body-sm text-neutral-600">
          Grant or revoke the ability for Dept Heads and Team Heads to create
          and manage events.
        </p>
      </div>

      <GrantList users={users} />
    </div>
  );
}
