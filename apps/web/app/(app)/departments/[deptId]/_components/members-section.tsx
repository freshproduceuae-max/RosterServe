"use client";

import { useState, useTransition } from "react";
import type { MemberWithProfile } from "@/lib/memberships/types";
import type { Team } from "@/lib/departments/types";
import { placeInTeam, removeMembership } from "@/lib/memberships/actions";

function MemberRow({
  member,
  teams,
  canManage,
}: {
  member: MemberWithProfile;
  teams: Team[];
  canManage: boolean;
}) {
  const [removing, setRemoving] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string>(member.team_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleTeamChange(newTeamId: string) {
    setSelectedTeam(newTeamId);
    setError(null);
    startTransition(async () => {
      const result = await placeInTeam(member.id, newTeamId || null);
      if (result.error) setError(result.error);
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMembership(member.id);
      if (result.error) {
        setError(result.error);
        setRemoving(false);
      }
    });
  }

  return (
    <tr className="border-b border-neutral-200 last:border-0">
      <td className="py-200 pr-300 text-body text-neutral-950">
        {member.display_name}
      </td>
      <td className="py-200 pr-300">
        {canManage && teams.length > 0 ? (
          <select
            value={selectedTeam}
            onChange={(e) => handleTeamChange(e.target.value)}
            disabled={isPending}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-200 py-100 text-body-sm text-neutral-950 focus:border-brand-calm-600 focus:outline-none disabled:opacity-50"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-body-sm text-neutral-600">
            {member.team_name ?? "No team"}
          </span>
        )}
      </td>
      {canManage && (
        <td className="py-200 text-right">
          {removing ? (
            <div className="flex items-center justify-end gap-200">
              <span className="text-body-sm text-neutral-600">Remove?</span>
              <button
                onClick={handleRemove}
                disabled={isPending}
                className="text-body-sm font-semibold text-semantic-error underline underline-offset-2 disabled:opacity-50"
              >
                {isPending ? "Removing…" : "Confirm"}
              </button>
              <button
                onClick={() => setRemoving(false)}
                disabled={isPending}
                className="text-body-sm text-neutral-600 underline underline-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setRemoving(true)}
              className="text-body-sm text-neutral-600 underline underline-offset-2 transition-colors hover:text-neutral-950"
            >
              Remove
            </button>
          )}
          {error && (
            <p className="mt-100 text-body-sm text-semantic-error">{error}</p>
          )}
        </td>
      )}
    </tr>
  );
}

export function MembersSection({
  members,
  teams,
  canManage,
}: {
  members: MemberWithProfile[];
  teams: Team[];
  canManage: boolean;
}) {
  return (
    <section className="flex flex-col gap-300 rounded-300 border border-neutral-200 bg-neutral-0 p-400">
      <div>
        <h2 className="text-h3 text-neutral-950">Members</h2>
        <p className="text-body-sm text-neutral-600">
          Volunteers with approved membership in this department.
        </p>
      </div>

      {members.length === 0 ? (
        <p className="text-body-sm text-neutral-600">
          No members yet. Approved interest requests will appear here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="pb-200 pr-300 text-body-sm font-semibold text-neutral-600">
                  Volunteer
                </th>
                <th className="pb-200 pr-300 text-body-sm font-semibold text-neutral-600">
                  Team
                </th>
                {canManage && (
                  <th className="pb-200 text-right text-body-sm font-semibold text-neutral-600">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  teams={teams}
                  canManage={canManage}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
