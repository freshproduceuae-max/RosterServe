"use client";

import type { AssignmentWithContext } from "@/lib/assignments/types";
import type { Team } from "@/lib/departments/types";
import { AssignmentRow, AssignmentCard } from "./assignment-row";

interface AssignmentListProps {
  assignments: AssignmentWithContext[];
  readOnly: boolean;
  subTeams: Pick<Team, "id" | "name">[];
  requireSubTeam: boolean;
}

export function AssignmentList({
  assignments,
  readOnly,
  subTeams,
  requireSubTeam,
}: AssignmentListProps) {
  if (assignments.length === 0) {
    return (
      <p className="text-body-sm text-neutral-500">
        No volunteers assigned yet.
      </p>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards (hidden at sm+) */}
      <div className="flex flex-col gap-200 sm:hidden">
        {assignments.map((a) => (
          <AssignmentCard
            key={a.id}
            assignment={a}
            readOnly={readOnly}
            subTeams={subTeams}
            requireSubTeam={requireSubTeam}
          />
        ))}
      </div>

      {/* Desktop: table (hidden below sm) */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="px-300 py-200 text-body-sm font-semibold text-neutral-600">
                Volunteer
              </th>
              <th className="px-300 py-200 text-body-sm font-semibold text-neutral-600">
                Sub-team
              </th>
              <th className="px-300 py-200 text-body-sm font-semibold text-neutral-600">
                Role
              </th>
              <th className="px-300 py-200 text-body-sm font-semibold text-neutral-600">
                Status
              </th>
              {!readOnly && (
                <th className="px-300 py-200 text-body-sm font-semibold text-neutral-600">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {assignments.map((a) => (
              <tr
                key={a.id}
                className="transition-colors duration-fast hover:bg-surface-cool/50"
              >
                <AssignmentRow
                  assignment={a}
                  readOnly={readOnly}
                  subTeams={subTeams}
                  requireSubTeam={requireSubTeam}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
