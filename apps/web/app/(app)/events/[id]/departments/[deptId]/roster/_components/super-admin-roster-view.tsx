"use client";

import type { AssignmentWithContext } from "@/lib/assignments/types";
import type { DepartmentWithSubTeams } from "@/lib/departments/types";
import { AssignmentList } from "./assignment-list";

interface SuperAdminRosterViewProps {
  eventTitle: string;
  department: DepartmentWithSubTeams;
  assignments: AssignmentWithContext[];
}

export function SuperAdminRosterView({
  eventTitle,
  department,
  assignments,
}: SuperAdminRosterViewProps) {
  const subTeams = department.sub_teams.filter((st) => st.deleted_at === null);

  return (
    <div className="flex flex-col gap-400">
      <div>
        <div className="flex items-center gap-200">
          <h1 className="font-display text-h1 text-neutral-950">
            Roster — {department.name}
          </h1>
          <span className="text-body-sm text-neutral-500">(read only)</span>
        </div>
        <p className="mt-100 text-body-sm text-neutral-600">{eventTitle}</p>
      </div>

      <AssignmentList
        assignments={assignments}
        readOnly={true}
        subTeams={subTeams}
      />
    </div>
  );
}
