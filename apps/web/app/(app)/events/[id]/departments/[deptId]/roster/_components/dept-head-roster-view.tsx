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
import { HeadcountGapSection } from "./headcount-gap-section";
import { MarkServedButton } from "./mark-served-button";
import { CrossTeamSuggestionsPanel } from "./cross-team-suggestions-panel";
import type { RosterGapSummary, HeadcountGapSummary } from "@/lib/skills/gap-types";
import type { CrossTeamSuggestion } from "@/lib/assignments/queries";
import type { EventTaskSlot, VolunteerTaskCandidate } from "@/lib/tasks/types";
import { TaskAssignmentSection } from "./task-assignment-section";

interface DeptHeadRosterViewProps {
  eventId: string;
  deptId: string;
  eventTitle: string;
  department: DepartmentWithTeams;
  assignments: AssignmentWithContext[];
  volunteers: VolunteerForAssignment[];
  gapSummary: RosterGapSummary;
  headcountGaps: HeadcountGapSummary;
  substituteOptions: TeamHeadOption[];
  crossTeamSuggestions: CrossTeamSuggestion[];
  taskSlots: EventTaskSlot[];
  candidatesByTask: Record<string, VolunteerTaskCandidate[]>;
}

export function DeptHeadRosterView({
  eventId,
  deptId,
  eventTitle,
  department,
  assignments,
  gapSummary,
  headcountGaps,
  substituteOptions,
  crossTeamSuggestions,
  taskSlots,
  candidatesByTask,
}: DeptHeadRosterViewProps) {
  const [showTeamForm, setShowTeamForm] = useState(false);
  const subTeams = department.teams.filter((t) => t.deleted_at === null);
  const acceptedAssignments = assignments.filter(
    (a) => a.status === "accepted",
  );

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
      <HeadcountGapSection summary={headcountGaps} />
      <CrossTeamSuggestionsPanel
        eventId={eventId}
        deptId={deptId}
        initialSuggestions={crossTeamSuggestions}
      />

      {/* Confirmed — mark served */}
      {acceptedAssignments.length > 0 && (
        <section className="flex flex-col gap-200">
          <div>
            <h2 className="font-display text-h2 text-neutral-950">Confirmed</h2>
            <p className="text-body-sm text-neutral-600">
              Mark assignments as served after the event.
            </p>
          </div>
          <div className="flex flex-col gap-150">
            {acceptedAssignments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-200 rounded-200 border border-neutral-200 bg-neutral-0 px-300 py-200"
              >
                <div className="flex flex-col gap-100">
                  <p className="text-body-sm font-medium text-neutral-950">
                    {a.volunteer_display_name}
                  </p>
                  {a.sub_team_name && (
                    <p className="text-body-sm text-neutral-500">
                      {a.sub_team_name}
                    </p>
                  )}
                </div>
                <MarkServedButton
                  assignmentId={a.id}
                  eventId={eventId}
                  deptId={deptId}
                />
              </div>
            ))}
          </div>
        </section>
      )}

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

      <TaskAssignmentSection
        eventId={eventId}
        deptId={deptId}
        slots={taskSlots}
        candidatesByTask={candidatesByTask}
        canAssign={true}
      />
    </div>
  );
}
