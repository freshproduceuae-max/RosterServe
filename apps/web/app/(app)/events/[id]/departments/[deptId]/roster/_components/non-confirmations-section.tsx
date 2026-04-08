"use client";

import { useState, useTransition } from "react";
import type { AssignmentWithContext } from "@/lib/assignments/types";
import type { TeamHeadOption } from "@/lib/assignments/types";
import { assignSubstituteTeamHead } from "@/lib/assignments/actions";

interface NonConfirmationsSectionProps {
  assignments: AssignmentWithContext[];
  substituteOptions: TeamHeadOption[];
}

export function NonConfirmationsSection({
  assignments,
  substituteOptions,
}: NonConfirmationsSectionProps) {
  const nonConfirmed = assignments.filter(
    (a) => a.status === "invited" || a.status === "declined",
  );

  if (nonConfirmed.length === 0) return null;

  return (
    <div className="flex flex-col gap-200 rounded-300 border border-semantic-warning/30 bg-semantic-warning/5 p-400">
      <h2 className="text-h3 text-neutral-950">Non-confirmations</h2>
      <div className="flex flex-col gap-200">
        {nonConfirmed.map((a) => (
          <NonConfirmationRow
            key={a.id}
            assignment={a}
            substituteOptions={substituteOptions}
          />
        ))}
      </div>
    </div>
  );
}

function NonConfirmationRow({
  assignment,
  substituteOptions,
}: {
  assignment: AssignmentWithContext;
  substituteOptions: TeamHeadOption[];
}) {
  const [showSubForm, setShowSubForm] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState(
    substituteOptions[0]?.volunteerId ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDeclinedTeamHead =
    assignment.status === "declined" && assignment.role === "team_head";

  function handleAssignSub(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await assignSubstituteTeamHead(
        assignment.id,
        selectedSubId,
      );
      if (result.error) {
        setError(result.error);
      } else {
        setShowSubForm(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-100 rounded-200 border border-neutral-200 bg-neutral-0 p-300">
      <div className="flex items-center justify-between gap-200">
        <div className="flex flex-col gap-50">
          <span className="text-body-sm font-medium text-neutral-950">
            {assignment.volunteer_display_name}
          </span>
          <span className="text-body-sm text-neutral-500">
            {assignment.sub_team_name ?? "No team"} ·{" "}
            {assignment.role === "team_head" ? "Team Head" : "Volunteer"}
          </span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-200 py-50 text-body-sm font-medium ${
            assignment.status === "declined"
              ? "bg-semantic-error/10 text-semantic-error border border-semantic-error/20"
              : "bg-neutral-100 text-neutral-600 border border-neutral-300"
          }`}
        >
          {assignment.status === "declined" ? "Declined" : "Pending"}
        </span>
      </div>

      {isDeclinedTeamHead && substituteOptions.length > 0 && (
        <div>
          {!showSubForm ? (
            <button
              type="button"
              onClick={() => setShowSubForm(true)}
              className="text-body-sm text-brand-calm-600 underline underline-offset-2 transition-opacity duration-fast hover:opacity-70"
            >
              Assign substitute team head
            </button>
          ) : (
            <form
              onSubmit={handleAssignSub}
              className="flex flex-col gap-150"
            >
              <label
                htmlFor={`sub-select-${assignment.id}`}
                className="text-body-sm font-medium text-neutral-700"
              >
                Substitute team head
              </label>
              <select
                id={`sub-select-${assignment.id}`}
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
                disabled={isPending}
                className="rounded-200 border border-neutral-300 bg-neutral-0 px-200 py-150 text-body-sm text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
              >
                {substituteOptions.map((opt) => (
                  <option key={opt.volunteerId} value={opt.volunteerId}>
                    {opt.displayName} ({opt.teamName})
                  </option>
                ))}
              </select>
              {error && (
                <p className="text-body-sm text-semantic-error">{error}</p>
              )}
              <div className="flex items-center gap-200">
                <button
                  type="submit"
                  disabled={!selectedSubId || isPending}
                  className="rounded-200 bg-brand-calm-600 px-300 py-150 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
                >
                  {isPending ? "Assigning…" : "Confirm substitute"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowSubForm(false);
                    setError(null);
                  }}
                  disabled={isPending}
                  className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors duration-fast hover:text-neutral-950 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {isDeclinedTeamHead && substituteOptions.length === 0 && (
        <p className="text-body-sm text-neutral-500">
          No other team heads available in this department to substitute.
        </p>
      )}
    </div>
  );
}
