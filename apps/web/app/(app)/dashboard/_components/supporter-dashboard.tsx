import type { SupporterDashboardData } from "@/lib/dashboard/types";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { AssignmentCard } from "./assignment-card";

interface SupporterDashboardProps {
  data: SupporterDashboardData;
  displayName: string;
}

export function SupporterDashboard({ data, displayName }: SupporterDashboardProps) {
  const { leaderName, leaderRole, upcomingAssignments } = data;

  return (
    <div className="flex flex-col gap-400">
      {/* Header band */}
      <div className="rounded-300 bg-surface-cool px-400 py-400">
        <h1 className="font-display text-h1 text-neutral-950">
          Hi, {displayName.split(" ")[0]}
        </h1>
        {leaderName && leaderRole && (
          <p className="mt-100 text-body-sm text-neutral-600">
            Supporting{" "}
            <span className="font-medium text-neutral-800">{leaderName}</span>
            {" "}({ROLE_LABELS[leaderRole]})
          </p>
        )}
        {!leaderName && (
          <p className="mt-100 text-body-sm text-neutral-500">
            No leader assigned yet. Contact a Super Admin to set up your supporter assignment.
          </p>
        )}
      </div>

      {/* Own service requests */}
      <section className="flex flex-col gap-300">
        <h2 className="font-display text-h2 text-neutral-950">Your service requests</h2>
        {upcomingAssignments.length === 0 ? (
          <p className="text-body text-neutral-600">
            No upcoming service requests.
          </p>
        ) : (
          <div className="flex flex-col gap-200">
            {upcomingAssignments.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
