"use client";

import { useState, useTransition } from "react";
import type { AssignmentForVolunteer, AssignmentStatus } from "@/lib/assignments/types";
import { respondToServiceRequest } from "@/lib/assignments/actions";

const statusStyles: Record<AssignmentStatus, string> = {
  invited: "bg-neutral-100 text-neutral-600 border border-neutral-300",
  accepted:
    "bg-semantic-success/10 text-semantic-success border border-semantic-success/20",
  declined:
    "bg-semantic-error/10 text-semantic-error border border-semantic-error/20",
  served: "bg-neutral-100 text-neutral-500 border border-neutral-200",
};

const statusLabels: Record<AssignmentStatus, string> = {
  invited: "Invited",
  accepted: "Accepted",
  declined: "Declined",
  served: "Served",
};

const roleLabels: Record<string, string> = {
  volunteer: "Volunteer",
  team_head: "Team Head",
  dept_head: "Dept Head",
};

export function ServiceRequestCard({
  assignment,
}: {
  assignment: AssignmentForVolunteer;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingResponse, setPendingResponse] = useState<
    "accepted" | "declined" | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function handleResponse(response: "accepted" | "declined") {
    if (
      response === "declined" &&
      !window.confirm(
        "Decline this service request? This cannot be undone.",
      )
    ) {
      return;
    }
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

  const formattedDate = (() => {
    if (!assignment.event_date) return "";
    const date = new Date(assignment.event_date + "T00:00:00");
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  })();

  return (
    <div className="flex flex-col gap-200 rounded-300 border border-neutral-300 bg-neutral-0 p-400">
      <div className="flex items-start justify-between gap-200">
        <div className="flex flex-col gap-50">
          <p className="text-body font-medium text-neutral-950">
            {assignment.event_title}
          </p>
          <p className="text-body-sm text-neutral-600">
            {assignment.department_name}
            {assignment.sub_team_name ? ` · ${assignment.sub_team_name}` : ""}
            {" · "}
            {roleLabels[assignment.role] ?? assignment.role}
          </p>
          {formattedDate && (
            <p className="text-body-sm text-neutral-500">{formattedDate}</p>
          )}
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-200 py-50 text-body-sm font-medium ${statusStyles[assignment.status]}`}
        >
          {statusLabels[assignment.status]}
        </span>
      </div>

      {assignment.status === "invited" && (
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
      )}

      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </div>
  );
}
