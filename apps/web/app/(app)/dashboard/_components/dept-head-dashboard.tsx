import Link from "next/link";
import type { DeptHeadDashboardData } from "@/lib/dashboard/types";

function formatEventDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
import { RosterHealthBar } from "./roster-health-bar";

interface DeptHeadDashboardProps {
  data: DeptHeadDashboardData;
  displayName: string;
}

export function DeptHeadDashboard({ data, displayName }: DeptHeadDashboardProps) {
  const { eventSummaries, pendingInterests, pendingSkillApprovals } = data;
  const hasPending = pendingInterests > 0 || pendingSkillApprovals > 0;

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
        <h2 className="font-display text-h2 text-neutral-950">Your departments</h2>
        {eventSummaries.length === 0 ? (
          <p className="text-body text-neutral-600">
            No upcoming events in your departments.
          </p>
        ) : (
          <div className="flex flex-col gap-300">
            {eventSummaries.map((event) => (
              <div
                key={event.event_id}
                className="rounded-200 border border-neutral-300 bg-neutral-0 p-300"
              >
                <div className="flex flex-col gap-50">
                  <p className="font-display text-h3 text-neutral-950">{event.event_title}</p>
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
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending queues */}
      {hasPending && (
        <section className="flex flex-col gap-200">
          <h2 className="font-display text-h2 text-neutral-950">Action required</h2>
          <div className="flex flex-col gap-100 text-body text-neutral-600">
            {pendingInterests > 0 && (
              <Link
                href="/interests"
                className="text-brand-calm-600 underline-offset-2 hover:underline"
              >
                {pendingInterests === 1
                  ? "1 interest request pending"
                  : `${pendingInterests} interest requests pending`}
              </Link>
            )}
            {pendingSkillApprovals > 0 && (
              <Link
                href="/skills"
                className="text-brand-calm-600 underline-offset-2 hover:underline"
              >
                {pendingSkillApprovals === 1
                  ? "1 skill approval pending"
                  : `${pendingSkillApprovals} skill approvals pending`}
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
