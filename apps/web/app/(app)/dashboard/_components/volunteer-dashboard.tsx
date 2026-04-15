import Link from "next/link";
import type { VolunteerDashboardData } from "@/lib/dashboard/types";
import { AssignmentCard } from "./assignment-card";

interface VolunteerDashboardProps {
  data: VolunteerDashboardData;
  displayName: string;
}

export function VolunteerDashboard({ data, displayName }: VolunteerDashboardProps) {
  const { upcomingAssignments, pendingSkillClaims, pendingInterests } = data;
  const firstName = displayName.split(" ")[0] ?? displayName;
  const hasPending = pendingSkillClaims > 0 || pendingInterests > 0;

  return (
    <div className="flex flex-col gap-400">
      {/* Greeting band */}
      <div className="rounded-300 bg-surface-warm px-400 py-400">
        <h1 className="font-display text-h1 text-neutral-950">Hi, {firstName}</h1>
        <p className="mt-50 text-body-sm text-neutral-600">Volunteer</p>
      </div>

      {/* Upcoming assignments */}
      <section className="flex flex-col gap-300">
        <h2 className="font-display text-h2 text-neutral-950">Coming up</h2>
        {upcomingAssignments.length === 0 ? (
          <p className="text-body text-neutral-600">
            Nothing coming up in the next two weeks. Check back after the next roster is published.
          </p>
        ) : (
          <div className="flex flex-col gap-300">
            {upcomingAssignments.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </section>

      {/* Pending action items */}
      {hasPending && (
        <section className="flex flex-col gap-200">
          <h2 className="font-display text-h2 text-neutral-950">Awaiting review</h2>
          <ul className="flex flex-col gap-100 text-body text-neutral-600">
            {pendingSkillClaims > 0 && (
              <li>
                <Link
                  href="/skills"
                  className="text-brand-calm-600 underline-offset-2 hover:underline"
                >
                  {pendingSkillClaims === 1
                    ? "1 skill claim pending review"
                    : `${pendingSkillClaims} skill claims pending review`}
                </Link>
              </li>
            )}
            {pendingInterests > 0 && (
              <li>
                <Link
                  href="/interests"
                  className="text-brand-calm-600 underline-offset-2 hover:underline"
                >
                  {pendingInterests === 1
                    ? "1 interest request pending"
                    : `${pendingInterests} interest requests pending`}
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
