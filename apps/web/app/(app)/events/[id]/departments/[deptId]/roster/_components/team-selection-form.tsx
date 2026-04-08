"use client";

import { useState, useTransition } from "react";
import type { Team } from "@/lib/departments/types";
import { selectTeamForEvent } from "@/lib/assignments/actions";

interface TeamSelectionFormProps {
  eventId: string;
  deptId: string;
  teams: Pick<Team, "id" | "name" | "rotation_label">[];
}

export function TeamSelectionForm({
  eventId,
  deptId,
  teams,
}: TeamSelectionFormProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (teams.length === 0) {
    return (
      <p className="text-body-sm text-neutral-600">
        No active teams in this department. Create a team before selecting one
        for this event.
      </p>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await selectTeamForEvent(eventId, deptId, selectedTeamId);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccessMsg(
          `Done — ${result.created} invited, ${result.skipped} already assigned.`,
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-300 rounded-300 border border-neutral-300 bg-neutral-0 p-400">
      <h2 className="text-h3 text-neutral-950">Select team for this event</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-200">
        <div className="flex flex-col gap-100">
          <label
            htmlFor="team-select"
            className="text-body-sm font-medium text-neutral-700"
          >
            Team
          </label>
          <select
            id="team-select"
            value={selectedTeamId}
            onChange={(e) => {
              setSelectedTeamId(e.target.value);
              setError(null);
              setSuccessMsg(null);
            }}
            disabled={isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body text-neutral-950 focus:border-brand-calm-600 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/20 disabled:opacity-50"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.rotation_label ? ` (${t.rotation_label})` : ""}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-body-sm text-semantic-error">{error}</p>}
        {successMsg && (
          <p className="text-body-sm text-semantic-success">{successMsg}</p>
        )}
        <button
          type="submit"
          disabled={!selectedTeamId || isPending}
          className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
        >
          {isPending ? "Sending invitations…" : "Send service requests"}
        </button>
      </form>
    </div>
  );
}
