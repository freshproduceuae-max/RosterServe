import Link from "next/link";
import type { SuperAdminDashboardData } from "@/lib/dashboard/types";

function formatEventDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface SuperAdminDashboardProps {
  data: SuperAdminDashboardData;
}

export function SuperAdminDashboard({ data }: SuperAdminDashboardProps) {
  const { upcomingEvents, pendingDeletions } = data;

  return (
    <div className="flex flex-col gap-400">
      {/* Admin oversight link */}
      {pendingDeletions > 0 && (
        <div className="flex items-center gap-200 rounded-200 border border-neutral-200 bg-neutral-50 px-300 py-200">
          <div className="flex flex-1 flex-col gap-50">
            <p className="text-body-sm font-semibold text-neutral-950">
              Pending approval
            </p>
            <p className="text-body-sm text-neutral-600">
              {pendingDeletions} record
              {pendingDeletions !== 1 ? "s" : ""} awaiting review
            </p>
          </div>
          <Link
            href="/admin"
            className="rounded-200 bg-neutral-950 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-80"
          >
            Review
          </Link>
        </div>
      )}
      <section className="flex flex-col gap-300">
        <h2 className="font-display text-h2 text-neutral-950">Upcoming events</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-body text-neutral-600">No events in the next two weeks.</p>
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
                    <th className="pb-200 text-right text-body-sm font-medium text-neutral-600">Departments</th>
                    <th className="pb-200 text-right text-body-sm font-medium text-neutral-600">Assigned</th>
                    <th className="pb-200 text-right text-body-sm font-medium text-neutral-600"></th>
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
                      <td className="py-200 text-body-sm text-neutral-600 capitalize">
                        {event.event_status}
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
