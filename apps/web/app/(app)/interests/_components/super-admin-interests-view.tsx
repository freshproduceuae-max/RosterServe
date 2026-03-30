"use client";

import type { InterestWithVolunteer } from "@/lib/interests/types";
import { InterestRequestCard } from "./interest-request-card";

export function SuperAdminInterestsView({
  interests,
}: {
  interests: InterestWithVolunteer[];
}) {
  if (interests.length === 0) {
    return (
      <div className="flex flex-col gap-500">
        <div>
          <h1 className="text-h1 text-neutral-950">All department interests</h1>
          <p className="mt-100 text-body-sm text-neutral-600">
            Read-only overview of all interest requests across all departments.
          </p>
        </div>
        <div className="rounded-300 border border-neutral-300 bg-neutral-0 p-500 text-center">
          <p className="text-h3 text-neutral-950">No interest requests found.</p>
        </div>
      </div>
    );
  }

  const grouped = interests.reduce<Record<string, InterestWithVolunteer[]>>((acc, interest) => {
    const dept = interest.department_name;
    acc[dept] = [...(acc[dept] ?? []), interest];
    return acc;
  }, {});
  const departments = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-500">
      <div>
        <h1 className="text-h1 text-neutral-950">All department interests</h1>
        <p className="mt-100 text-body-sm text-neutral-600">
          Read-only overview of all interest requests across all departments.
        </p>
      </div>
      <div className="flex flex-col gap-600">
        {departments.map((dept) => {
          const pendingCount = grouped[dept].filter((i) => i.status === "pending").length;
          return (
            <section key={dept} className="flex flex-col gap-300">
              <div className="flex items-baseline gap-200">
                <h2 className="text-h3 text-neutral-950">{dept}</h2>
                <span className="text-body-sm text-neutral-600">
                  {pendingCount === 0 ? "All reviewed" : `${pendingCount} pending`}
                </span>
              </div>
              <div className="grid gap-300 sm:grid-cols-2 lg:grid-cols-3">
                {grouped[dept].map((interest) => (
                  <InterestRequestCard key={interest.id} interest={interest} canReview={false} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
