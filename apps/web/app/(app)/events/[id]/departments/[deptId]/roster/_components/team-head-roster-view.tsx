"use client";

import { useState, useTransition } from "react";
import type { AssignmentWithContext } from "@/lib/assignments/types";
import type { Team } from "@/lib/departments/types";
import { respondToServiceRequest } from "@/lib/assignments/actions";
import { AssignmentList } from "./assignment-list";
import { GapSummary } from "./gap-summary";
import type { RosterGapSummary } from "@/lib/skills/gap-types";

interface TeamHeadRosterViewProps {
  eventId: string;
  deptId: string;
  eventTitle: string;
  profileId: string;
  subTeams: Pick<Team, "id" | "name">[];
  assignments: AssignmentWithContext[];
  gapSummary: RosterGapSummary;
}

export function TeamHeadRosterView({
  eventTitle,
  profileId,
  subTeams,
  assignments,
  gapSummary,
}: TeamHeadRosterViewProps) {
  const heading = subTeams.length === 1 ? subTeams[0].name : "Your teams";

  // The team_head's own assignment in this event/dept
  const teamHeadAssignment = assignments.find(
    (a) => a.volunteer_id === profileId && a.role === "team_head",
  );

  return (
    <div className="flex flex-col gap-400">
      <div>
        <h1 className="font-display text-h1 text-neutral-950">{heading}</h1>
        <p className="mt-100 text-body-sm text-neutral-600">{eventTitle}</p>
      </div>

      {/* Team head's own invitation panel */}
      {teamHeadAssignment && (
        <TeamHeadInvitationPanel assignment={teamHeadAssignment} />
      )}

      <GapSummary summary={gapSummary} />

      {/* Team member assignment list */}
      {assignments.length === 0 ? (
        <p className="text-body-sm text-neutral-500">
          No service requests sent for your team yet.
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

function TeamHeadInvitationPanel({
  assignment,
}: {
  assignment: AssignmentWithContext;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<
    "accepted" | "declined" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function handleResponse(response: "accepted" | "declined") {
    setError(null);
    setPendingResponse(response);
    startTransition(async () => {
      const result = await respondToServiceRequest(assignment.id, response);
      if (result.error) {
        setError(result.error);
        setPendingResponse(null);
      }
    });
  }

  if (assignment.status === "accepted") {
    return (
      <div className="rounded-300 border border-semantic-success/30 bg-semantic-success/5 p-400">
        <p className="text-body-sm font-medium text-semantic-success">
          You have confirmed your team&apos;s service for this event.
        </p>
      </div>
    );
  }

  if (assignment.status === "declined") {
    return (
      <div className="rounded-300 border border-semantic-error/30 bg-semantic-error/5 p-400">
        <p className="text-body-sm font-medium text-semantic-error">
          You declined your team&apos;s service request for this event.
        </p>
      </div>
    );
  }

  // status === 'invited'
  return (
    <div className="flex flex-col gap-200 rounded-300 border border-brand-calm-600/30 bg-brand-calm-600/5 p-400">
      <div>
        <p className="text-body font-semibold text-neutral-950">
          You have been invited to lead your team for this event.
        </p>
        <p className="mt-50 text-body-sm text-neutral-600">
          Confirm or decline your team&apos;s participation.
        </p>
      </div>
      <div className="flex items-center gap-200">
        <button
          onClick={() => handleResponse("accepted")}
          disabled={isPending}
          className="rounded-200 bg-semantic-success px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-opacity duration-fast hover:opacity-90 disabled:opacity-50"
        >
          {pendingResponse === "accepted" ? "Saving…" : "Accept"}
        </button>
        <button
          onClick={() => handleResponse("declined")}
          disabled={isPending}
          className="rounded-200 border border-neutral-300 px-300 py-150 text-body-sm font-medium text-neutral-700 transition-colors duration-fast hover:border-neutral-400 hover:text-neutral-950 disabled:opacity-50"
        >
          {pendingResponse === "declined" ? "Saving…" : "Decline"}
        </button>
      </div>
      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </div>
  );
}
