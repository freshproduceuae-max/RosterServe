import Link from "next/link";
import type { SuperAdminDashboardData } from "@/lib/dashboard/types";
import { formatEventDate } from "@/lib/format-date";

interface SuperAdminDashboardProps {
  data: SuperAdminDashboardData;
  displayName: string;
}

export function SuperAdminDashboard({ data, displayName }: SuperAdminDashboardProps) {
  const { upcomingEvents, pendingDeletions } = data;

  return (
    <div className="flex flex-col gap-400">

      {/* Greeting */}
      <div className="rounded-300 bg-surface-cool px-400 py-400">
        <h1 className="font-display text-h1 text-neutral-950">
          Hi, {displayName.split(" ")[0]}
        </h1>
        <p className="mt-50 text-body-sm text-neutral-600">System administrator</p>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-200">
        <Link
          href="/events/new"
          className="rounded-200 bg-brand-calm-600 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80"
        >
          Create event
        </Link>
        <Link
          href="/departments"
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-150 text-body-sm font-semibold text-neutral-950 transition-colors duration-fast hover:bg-neutral-100"
        >
          Departments
        </Link>
        <Link
          href="/events/grants"
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-150 text-body-sm font-semibold text-neutral-950 transition-colors duration-fast hover:bg-neutral-100"
        >
          Manage grants
        </Link>
      </div>

      {/* Admin oversight card — always visible */}
      <Link
        href="/admin"
        className="flex items-center justify-between gap-200 rounded-200 border border-neutral-200 bg-neutral-0 px-300 py-200 transition-colors duration-fast hover:bg-neutral-50"
      >
        <div className="flex flex-col gap-50">
          <p className="text-body-sm font-semibold text-neutral-950">Admin oversight</p>
          {pendingDeletions > 0 ? (
            <p className="text-body-sm text-semantic-warning">
              {pendingDeletions} record{pendingDeletions !== 1 ? "s" : ""} pending review
            </p>
          ) : (
            <p className="text-body-sm text-semantic-success">All clear — no pending reviews</p>
          )}
        </div>
        <span className="text-body-sm text-brand-calm-600">
          {pendingDeletions > 0 ? "Review →" : "View →"}
        </span>
      </Link>

      {/* Upcoming events */}
      <section className="flex flex-col gap-300">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-h2 text-neutral-950">Upcoming events</h2>
          <Link
            href="/events"
            className="text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
          >
            View all
          </Link>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="rounded-200 border border-neutral-200 bg-neutral-0 p-400 text-center">
            <p className="text-body-sm text-neutral-600">No events in the next two weeks.</p>
            <Link
              href="/events/new"
              className="mt-200 inline-block text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
            >
              Create the first one →
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile: card stack */}
            <div className="flex flex-col gap-300 md:hidden">
              {upcomingEvents.map((event) => (
                <div
                  key={event.event_id}
                  className="rounded-200 border border-neutral-300 bg-neutral-0 p-300"
                >
                  <div className="flex items-start justify-between gap-200">
                    <div className="flex flex-col gap-50">
                      <p className="font-display text-h3 text-neutral-950">{event.event_title}</p>
                      <p className="text-body-sm text-neutral-600">
                        {formatEventDate(event.event_date)}
                      </p>
                    </div>
                    <Link
                      href={`/events/${event.event_id}`}
                      className="shrink-0 text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                  <div className="mt-200 flex gap-300 text-body-sm text-neutral-600">
                    <span>{event.department_count} dept{event.department_count !== 1 ? "s" : ""}</span>
                    <span>{event.assigned_count} assigned</span>
                    <span className="capitalize">{event.event_status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-300">
                    <th className="pb-200 text-left text-body-sm font-medium text-neutral-600">Event</th>
                    <th className="pb-200 text-left text-body-sm font-medium text-neutral-600">Date</th>
                    <th className="pb-200 text-left text-body-sm font-medium text-neutral-600">Status</th>
                    <th className="pb-200 text-right text-body-sm font-medium text-neutral-600">Depts</th>
                    <th className="pb-200 text-right text-body-sm font-medium text-neutral-600">Assigned</th>
                    <th className="pb-200"></th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingEvents.map((event) => (
                    <tr key={event.event_id} className="border-b border-neutral-200">
                      <td className="py-200 text-body-sm font-medium text-neutral-950">
                        {event.event_title}
                      </td>
                      <td className="py-200 text-body-sm text-neutral-600">
                        {formatEventDate(event.event_date)}
                      </td>
                      <td className="py-200">
                        <span className={`inline-flex items-center rounded-full px-200 py-50 text-body-sm font-medium capitalize
                          ${event.event_status === "published"
                            ? "bg-semantic-success/10 text-semantic-success"
                            : event.event_status === "completed"
                            ? "bg-neutral-100 text-neutral-500"
                            : "bg-neutral-100 text-neutral-600"
                          }`}>
                          {event.event_status}
                        </span>
                      </td>
                      <td className="py-200 text-right text-body-sm text-neutral-600">
                        {event.department_count}
                      </td>
                      <td className="py-200 text-right text-body-sm text-neutral-600">
                        {event.assigned_count}
                      </td>
                      <td className="py-200 text-right">
                        <Link
                          href={`/events/${event.event_id}`}
                          className="text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
