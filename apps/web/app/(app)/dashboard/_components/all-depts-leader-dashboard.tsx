import Link from "next/link";
import type { AllDeptsLeaderDashboardData } from "@/lib/dashboard/types";
import { RosterHealthBar } from "./roster-health-bar";

function formatEventDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface AllDeptsLeaderDashboardProps {
  data: AllDeptsLeaderDashboardData;
  displayName: string;
}

export function AllDeptsLeaderDashboard({
  data,
  displayName,
}: AllDeptsLeaderDashboardProps) {
  const { eventSummaries } = data;

  return (
    <div className="flex flex-col gap-400">
      {/* Header band */}
      <div className="rounded-300 bg-surface-cool px-400 py-400">
        <h1 className="font-display text-h1 text-neutral-950">
          Hi, {displayName.split(" ")[0]}
        </h1>
      </div>

      {/* Event health cards */}
      <section className="flex flex-col gap-300">
        <h2 className="font-display text-h2 text-neutral-950">All departments</h2>
        {eventSummaries.length === 0 ? (
          <p className="text-body text-neutral-600">
            No upcoming events with active service requests.
          </p>
        ) : (
          <div className="flex flex-col gap-300">
            {eventSummaries.map((event) => (
              <div
                key={event.event_id}
                className="rounded-200 border border-neutral-300 bg-neutral-0 p-300"
              >
                <div className="flex flex-col gap-50">
                  <p className="font-display text-h3 text-neutral-950">
                    {event.event_title}
                  </p>
                  <p className="text-body-sm text-neutral-600">
                    {formatEventDate(event.event_date)}
                  </p>
                </div>
                <div className="mt-300 flex flex-col gap-200">
                  {event.departments.map((dept) => (
                    <div key={dept.department_id} className="flex flex-col gap-100">
                      <div className="flex items-center justify-between gap-200">
                        <p className="text-body-sm font-medium text-neutral-800">
                          {dept.department_name}
                        </p>
                        <Link
                          href={`/events/${event.event_id}/departments/${dept.department_id}/roster`}
                          className="text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
                        >
                          View Roster
                        </Link>
                      </div>
                      <RosterHealthBar
                        invited={dept.invited}
                        accepted={dept.accepted}
                        declined={dept.declined}
                        gapCount={dept.gap_count}
                        pendingTeamHeads={dept.pending_team_heads}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
