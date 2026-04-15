"use client";

import type { AssignmentWithContext } from "@/lib/assignments/types";
import type { DepartmentWithTeams } from "@/lib/departments/types";
import type { RosterGapSummary, HeadcountGapSummary } from "@/lib/skills/gap-types";
import type { EventTaskSlot } from "@/lib/tasks/types";
import { AssignmentList } from "./assignment-list";
import { GapSummary } from "./gap-summary";
import { HeadcountGapSection } from "./headcount-gap-section";
import { TaskAssignmentSection } from "./task-assignment-section";

interface SuperAdminRosterViewProps {
  eventId: string;
  deptId: string;
  eventTitle: string;
  department: DepartmentWithTeams;
  assignments: AssignmentWithContext[];
  gapSummary: RosterGapSummary;
  headcountGaps: HeadcountGapSummary;
  taskSlots: EventTaskSlot[];
}

export function SuperAdminRosterView({
  eventId,
  deptId,
  eventTitle,
  department,
  assignments,
  gapSummary,
  headcountGaps,
  taskSlots,
}: SuperAdminRosterViewProps) {
  const subTeams = department.teams.filter((st) => st.deleted_at === null);

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

      <GapSummary summary={gapSummary} />
      <HeadcountGapSection summary={headcountGaps} />

      <AssignmentList
        assignments={assignments}
        readOnly={true}
        subTeams={subTeams}
        requireSubTeam={false}
      />

      <TaskAssignmentSection
        eventId={eventId}
        deptId={deptId}
        slots={taskSlots}
        candidatesByTask={{}}
        canAssign={false}
      />
    </div>
  );
}
