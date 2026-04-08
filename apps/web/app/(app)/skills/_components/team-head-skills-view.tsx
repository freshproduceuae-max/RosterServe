"use client";

import type { SkillClaimWithVolunteer } from "@/lib/skills/types";
import { SkillClaimCard } from "./skill-claim-card";

export function TeamHeadSkillsView({
  claims,
}: {
  claims: SkillClaimWithVolunteer[];
}) {
  if (claims.length === 0) {
    return (
      <div className="flex flex-col gap-500">
        <div>
          <h1 className="text-h2 text-neutral-950">Skill claims</h1>
          <p className="mt-100 text-body-sm text-neutral-600">
            Review and approve volunteer skill claims for your team&apos;s
            departments.
          </p>
        </div>
        <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 text-center">
          <p className="text-h3 text-neutral-950">No skill claims found.</p>
        </div>
      </div>
    );
  }

  const grouped = claims.reduce<Record<string, SkillClaimWithVolunteer[]>>(
    (acc, claim) => {
      const dept = claim.department_name;
      acc[dept] = [...(acc[dept] ?? []), claim];
      return acc;
    },
    {},
  );
  const departments = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-500">
      <div>
        <h1 className="text-h2 text-neutral-950">Skill claims</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Review and approve volunteer skill claims for your team&apos;s
          departments.
        </p>
      </div>
      <div className="flex flex-col gap-600">
        {departments.map((dept) => {
          const pendingCount = grouped[dept].filter(
            (c) => c.status === "pending",
          ).length;
          return (
            <section key={dept} className="flex flex-col gap-300">
              <div className="flex items-baseline gap-200">
                <h2 className="text-h3 text-neutral-950">{dept}</h2>
                <span className="text-body-sm text-neutral-600">
                  {pendingCount === 0
                    ? "All reviewed"
                    : `${pendingCount} pending`}
                </span>
              </div>
              <div className="grid gap-300 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[dept].map((claim) => (
                  <SkillClaimCard key={claim.id} claim={claim} readOnly={false} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
