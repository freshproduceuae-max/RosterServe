"use client";

import { useState, useTransition } from "react";
import type { VolunteerForAssignment, AssignmentRole } from "@/lib/assignments/types";
import type { SubTeam } from "@/lib/departments/types";
import { createAssignment } from "@/lib/assignments/actions";
import { VolunteerSelector } from "./volunteer-selector";

interface AssignVolunteerFormProps {
  eventId: string;
  deptId: string;
  volunteers: VolunteerForAssignment[];
  /** All sub-teams available for selection — already scoped by caller.
   *  Dept_head: all dept sub-teams.
   *  Sub_leader: owned sub-teams only (required, no "No sub-team" option). */
  subTeams: Pick<SubTeam, "id" | "name">[];
  /** When true the sub-team field is required and "No sub-team" is omitted. */
  requireSubTeam: boolean;
  requiredSkills?: string[];
}

export function AssignVolunteerForm({
  eventId,
  deptId,
  volunteers,
  subTeams,
  requireSubTeam,
  requiredSkills = [],
}: AssignVolunteerFormProps) {
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string | null>(null);
  const [role, setRole] = useState<AssignmentRole>("volunteer");
  const [subTeamId, setSubTeamId] = useState<string>(
    requireSubTeam && subTeams.length === 1 ? subTeams[0].id : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedVolunteerId) {
      setError("Please select a volunteer.");
      return;
    }
    if (requireSubTeam && !subTeamId) {
      setError("Please select a sub-team.");
      return;
    }

    startTransition(async () => {
      const result = await createAssignment(
        eventId,
        deptId,
        selectedVolunteerId,
        role,
        subTeamId || undefined,
      );
      if (result.error) {
        setError(result.error);
      } else {
        // Reset form on success
        setSelectedVolunteerId(null);
        setRole("volunteer");
        setSubTeamId(requireSubTeam && subTeams.length === 1 ? subTeams[0].id : "");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-300 rounded-200 border border-neutral-200 bg-neutral-50 p-400"
    >
      <h3 className="text-body-base font-semibold text-neutral-950">
        Assign volunteer
      </h3>

      {/* Sub-team */}
      {subTeams.length > 0 && (
        <div className="flex flex-col gap-100">
          <label className="text-body-sm font-medium text-neutral-700">
            Sub-team{requireSubTeam ? "" : " (optional)"}
          </label>
          <select
            value={subTeamId}
            onChange={(e) => setSubTeamId(e.target.value)}
            required={requireSubTeam}
            className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/30"
          >
            {!requireSubTeam && (
              <option value="">No sub-team</option>
            )}
            {subTeams.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Serving role */}
      <div className="flex flex-col gap-100">
        <label className="text-body-sm font-medium text-neutral-700">
          Serving role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AssignmentRole)}
          className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-200 text-body-sm text-neutral-950 focus:outline-none focus:ring-2 focus:ring-brand-calm-600/30"
        >
          <option value="volunteer">Volunteer</option>
          <option value="team_head">Team Head</option>
          {/* dept_head option is intentionally omitted */}
        </select>
      </div>

      {/* Volunteer selector */}
      <div className="flex flex-col gap-100">
        <label className="text-body-sm font-medium text-neutral-700">
          Volunteer
        </label>
        <VolunteerSelector
          volunteers={volunteers}
          selectedId={selectedVolunteerId}
          onChange={setSelectedVolunteerId}
          requiredSkills={requiredSkills}
        />
      </div>

      {error && (
        <p className="text-body-sm text-semantic-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-200 bg-brand-calm-600 px-400 py-200 text-body-sm font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90 disabled:opacity-50"
      >
        {isPending ? "Assigning…" : "Assign volunteer"}
      </button>
    </form>
  );
}
