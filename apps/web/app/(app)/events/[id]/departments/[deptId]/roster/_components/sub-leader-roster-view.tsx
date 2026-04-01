"use client";

import { useState } from "react";
import type { AssignmentWithContext, VolunteerForAssignment } from "@/lib/assignments/types";
import type { SubTeam } from "@/lib/departments/types";
import { AssignmentList } from "./assignment-list";
import { AssignVolunteerForm } from "./assign-volunteer-form";

interface SubLeaderRosterViewProps {
  eventId: string;
  deptId: string;
  eventTitle: string;
  /** All sub-teams owned by this sub-leader in this dept */
  subTeams: Pick<SubTeam, "id" | "name">[];
  assignments: AssignmentWithContext[];
  volunteers: VolunteerForAssignment[];
}

export function SubLeaderRosterView({
  eventId,
  deptId,
  eventTitle,
  subTeams,
  assignments,
  volunteers,
}: SubLeaderRosterViewProps) {
  const [showForm, setShowForm] = useState(false);

  const heading =
    subTeams.length === 1 ? subTeams[0].name : "Your teams";

  return (
    <div className="flex flex-col gap-400">
      {/* Header */}
      <div className="flex flex-col gap-100 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-h1 text-neutral-950">{heading}</h1>
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

      {/* Assign form — sub-team required, limited to owned sub-teams */}
      {showForm && (
        <AssignVolunteerForm
          eventId={eventId}
          deptId={deptId}
          volunteers={volunteers}
          subTeams={subTeams}
          requireSubTeam={true}
        />
      )}

      {/* Assignment list */}
      {assignments.length === 0 ? (
        <p className="text-body-sm text-neutral-500">
          No one has been assigned to your teams yet.
        </p>
      ) : (
        <AssignmentList
          assignments={assignments}
          readOnly={false}
          subTeams={subTeams}
          requireSubTeam={true}
        />
      )}
    </div>
  );
}
