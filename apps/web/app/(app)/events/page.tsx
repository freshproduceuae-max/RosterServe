import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionWithProfile } from "@/lib/auth/session";
import { isLeaderRole, canManageEvents } from "@/lib/auth/roles";
import { getEvents } from "@/lib/events/queries";
import { EVENT_STATUSES, EVENT_STATUS_LABELS, type EventStatus } from "@/lib/events/types";
import { EventListTable } from "./_components/event-list-table";
import { EventEmptyState } from "./_components/event-empty-state";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSessionWithProfile();
  if (!session) redirect("/sign-in");
  if (!isLeaderRole(session.profile.role)) redirect("/dashboard");

  const params = await searchParams;
  const statusFilter =
    params.status && EVENT_STATUSES.includes(params.status as EventStatus)
      ? (params.status as EventStatus)
      : undefined;

  const events = await getEvents(statusFilter ? { status: statusFilter } : undefined);
  const canCreateEvent = canManageEvents(session.profile);

  return (
    <div className="flex flex-col gap-400">
      {/* Header */}
      <div className="flex flex-col gap-200 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-h1 text-neutral-950">Events</h1>
        <div className="flex items-center gap-300">
          {session.profile.role === "super_admin" && (
            <Link
              href="/events/grants"
              className="text-body-sm text-brand-calm-600 hover:underline"
            >
              Manage grants
            </Link>
          )}
          {canCreateEvent && (
            <Link
              href="/events/new"
              className="rounded-200 bg-brand-calm-600 px-400 py-200 text-center text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
            >
              Create event
            </Link>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-100">
        <FilterTab
          label="All"
          href="/events"
          active={!statusFilter}
        />
        {EVENT_STATUSES.map((s) => (
          <FilterTab
            key={s}
            label={EVENT_STATUS_LABELS[s]}
            href={`/events?status=${s}`}
            active={statusFilter === s}
          />
        ))}
      </div>

      {/* Content */}
      {events.length === 0 ? (
        <EventEmptyState canCreate={canCreateEvent} />
      ) : (
        <EventListTable events={events} />
      )}
    </div>
  );
}

function FilterTab({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-200 border px-300 py-100 text-body-sm transition-colors duration-fast ${
        active
          ? "border-brand-calm-600 bg-brand-calm-600 text-neutral-0"
          : "border-neutral-300 bg-neutral-0 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950"
      }`}
    >
      {label}
    </Link>
  );
}
