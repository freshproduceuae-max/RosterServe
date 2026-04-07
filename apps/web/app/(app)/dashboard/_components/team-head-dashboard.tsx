import Link from "next/link";
import type { TeamHeadDashboardData } from "@/lib/dashboard/types";

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

interface TeamHeadDashboardProps {
  data: TeamHeadDashboardData;
  displayName: string;
}

export function TeamHeadDashboard({ data, displayName }: TeamHeadDashboardProps) {
  const { subTeamSummaries } = data;

  return (
    <div className="flex flex-col gap-400">
      {/* Header band */}
      <div className="rounded-300 bg-surface-cool px-400 py-400">
        <h1 className="font-display text-h1 text-neutral-950">
          Hi, {displayName.split(" ")[0]}
        </h1>
      </div>

      {/* Team roster cards */}
      <section className="flex flex-col gap-300">
        <h2 className="font-display text-h2 text-neutral-950">Your teams</h2>
        {subTeamSummaries.length === 0 ? (
          <p className="text-body text-neutral-600">
            No upcoming assignments in your teams.
          </p>
        ) : (
          <div className="flex flex-col gap-300">
            {subTeamSummaries.map((st) => (
              <div
                key={`${st.sub_team_id}-${st.event_id}`}
                className="rounded-200 border border-neutral-300 bg-neutral-0 p-300"
              >
                <div className="flex items-start justify-between gap-200">
                  <div className="flex flex-col gap-50">
                    <p className="font-display text-h3 text-neutral-950">{st.sub_team_name}</p>
                    <p className="text-body-sm text-neutral-600">
                      {st.event_title} · {formatEventDate(st.event_date)}
                    </p>
                    <p className="text-body-sm text-neutral-500">{st.department_name}</p>
                  </div>
                  <Link
                    href={`/events/${st.event_id}/departments/${st.department_id}/roster`}
                    className="shrink-0 text-body-sm text-brand-calm-600 underline-offset-2 hover:underline"
                  >
                    View Roster
                  </Link>
                </div>
                <div className="mt-200">
                  <RosterHealthBar
                    invited={st.invited}
                    accepted={st.accepted}
                    declined={st.declined}
                    gapCount={st.gap_count}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
