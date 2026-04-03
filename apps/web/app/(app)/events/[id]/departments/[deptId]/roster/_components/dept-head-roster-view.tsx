"use client";

import { useState } from "react";
import type { AssignmentWithContext, VolunteerForAssignment } from "@/lib/assignments/types";
import type { DepartmentWithSubTeams } from "@/lib/departments/types";
import { AssignmentList } from "./assignment-list";
import { AssignVolunteerForm } from "./assign-volunteer-form";
import { GapSummary } from "./gap-summary";
import type { RosterGapSummary } from "@/lib/skills/gap-types";

interface DeptHeadRosterViewProps {
  eventId: string;
  deptId: string;
  eventTitle: string;
  department: DepartmentWithSubTeams;
  assignments: AssignmentWithContext[];
  volunteers: VolunteerForAssignment[];
  gapSummary: RosterGapSummary;
}

export function DeptHeadRosterView({
  eventId,
  deptId,
  eventTitle,
  department,
  assignments,
  volunteers,
  gapSummary,
}: DeptHeadRosterViewProps) {
  const [showForm, setShowForm] = useState(false);

  const subTeams = department.sub_teams.filter((st) => st.deleted_at === null);

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
          onClick={() => setShowForm((v) => !v)}
          className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
        >
          {showForm ? "Cancel" : "Assign volunteer"}
        </button>
      </div>

      <GapSummary summary={gapSummary} />

      {/* Assign form */}
      {showForm && (
        <AssignVolunteerForm
          eventId={eventId}
          deptId={deptId}
          volunteers={volunteers}
          subTeams={subTeams}
          requireSubTeam={false}
          requiredSkills={gapSummary.required}
        />
      )}

      {/* Assignment list */}
      <AssignmentList
        assignments={assignments}
        readOnly={false}
        subTeams={subTeams}
        requireSubTeam={false}
      />
    </div>
  );
}
