"use client";

import { useActionState, startTransition } from "react";
import type { Team, TeamHeadcountRequirement } from "@/lib/departments/types";
import {
  setTeamHeadcountRequirement,
  deleteTeamHeadcountRequirement,
} from "@/lib/departments/actions";

interface HeadcountRequirementsSectionProps {
  teams: Team[];
  requirementsByTeam: Record<string, TeamHeadcountRequirement[]>;
  canManage: boolean;
}

export function HeadcountRequirementsSection({
  teams,
  requirementsByTeam,
  canManage,
}: HeadcountRequirementsSectionProps) {
  if (teams.length === 0) return null;

  return (
    <section className="flex flex-col gap-300">
      <h2 className="text-h2 font-semibold text-neutral-950">
        Headcount requirements
      </h2>
      <p className="text-body-sm text-neutral-600">
        Set the minimum volunteer count per team for each event type.
      </p>
      <div className="flex flex-col gap-400">
        {teams.map((team) => (
          <TeamHeadcountCard
            key={team.id}
            team={team}
            requirements={requirementsByTeam[team.id] ?? []}
            canManage={canManage}
          />
        ))}
      </div>
    </section>
  );
}

function TeamHeadcountCard({
  team,
  requirements,
  canManage,
}: {
  team: Team;
  requirements: TeamHeadcountRequirement[];
  canManage: boolean;
}) {
  const [addState, addDispatch] = useActionState(setTeamHeadcountRequirement, undefined);
  const [removeState, removeDispatch] = useActionState(deleteTeamHeadcountRequirement, undefined);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("teamId", team.id);
    startTransition(() => addDispatch(fd));
    (e.currentTarget as HTMLFormElement).reset();
  }

  function handleRemove(reqId: string) {
    const fd = new FormData();
    fd.set("id", reqId);
    startTransition(() => removeDispatch(fd));
  }

  return (
    <div className="rounded-200 border border-neutral-300 bg-neutral-0 p-400">
      <h3 className="text-body font-semibold text-neutral-950">{team.name}</h3>
      {requirements.length > 0 ? (
        <ul className="mt-200 flex flex-col gap-100">
          {requirements.map((req) => (
            <li key={req.id} className="flex items-center justify-between">
              <span className="text-body text-neutral-700">
                {req.event_type}:{" "}
                <span className="font-semibold text-neutral-950">
                  {req.required_count}
                </span>{" "}
                volunteer{req.required_count !== 1 ? "s" : ""}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleRemove(req.id)}
                  className="text-body-sm text-semantic-error hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-100 text-body-sm text-neutral-600">
          No requirements set.
        </p>
      )}
      {canManage && (
        <form onSubmit={handleAdd} className="mt-300 flex flex-wrap gap-200">
          <input
            name="eventType"
            type="text"
            placeholder="Event type (e.g. Sunday Service)"
            required
            maxLength={100}
            className="flex-1 rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-950 focus:border-brand-calm-600 focus:outline-none"
          />
          <input
            name="requiredCount"
            type="number"
            min={1}
            placeholder="Count"
            required
            className="w-24 rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-950 focus:border-brand-calm-600 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-200 bg-brand-calm-600 px-300 py-100 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
          >
            Set
          </button>
          {addState && "error" in addState && (
            <p className="w-full text-body-sm text-semantic-error">{addState.error}</p>
          )}
        </form>
      )}
      {removeState && "error" in removeState && (
        <p className="mt-100 text-body-sm text-semantic-error">{removeState.error}</p>
      )}
    </div>
  );
}
