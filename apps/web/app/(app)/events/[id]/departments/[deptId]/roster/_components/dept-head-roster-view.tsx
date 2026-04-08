"use client";

import { useState } from "react";
import type {
  AssignmentWithContext,
  TeamHeadOption,
  VolunteerForAssignment,
} from "@/lib/assignments/types";
import type { DepartmentWithTeams } from "@/lib/departments/types";
import { AssignmentList } from "./assignment-list";
import { TeamSelectionForm } from "./team-selection-form";
import { NonConfirmationsSection } from "./non-confirmations-section";
import { GapSummary } from "./gap-summary";
import type { RosterGapSummary } from "@/lib/skills/gap-types";

interface DeptHeadRosterViewProps {
  eventId: string;
  deptId: string;
  eventTitle: string;
  department: DepartmentWithTeams;
  assignments: AssignmentWithContext[];
  volunteers: VolunteerForAssignment[];
  gapSummary: RosterGapSummary;
  substituteOptions: TeamHeadOption[];
}

export function DeptHeadRosterView({
  eventId,
  deptId,
  eventTitle,
  department,
  assignments,
  gapSummary,
  substituteOptions,
}: DeptHeadRosterViewProps) {
  const [showTeamForm, setShowTeamForm] = useState(false);
  const subTeams = department.teams.filter((t) => t.deleted_at === null);

  return (
    <div className="flex flex-col gap-400">
      {/* Header */}
      <div className="flex flex-col gap-100 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-h1 text-neutral-950">
            Roster — {department.name}
          </h1>
          <p className="mt-100 text-body-sm text-neutral-600">{eventTitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowTeamForm((v) => !v)}
          className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
        >
          {showTeamForm ? "Cancel" : "Select team"}
        </button>
      </div>

      <GapSummary summary={gapSummary} />

      {/* Team selection form */}
      {showTeamForm && (
        <TeamSelectionForm
          eventId={eventId}
          deptId={deptId}
          teams={subTeams}
        />
      )}

      {/* Non-confirmations panel */}
      <NonConfirmationsSection
        assignments={assignments}
        substituteOptions={substituteOptions}
      />

      {/* Full assignment list */}
      <AssignmentList
        assignments={assignments}
        readOnly={false}
        subTeams={subTeams}
        requireSubTeam={false}
      />
    </div>
  );
}
