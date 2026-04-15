"use client";

import { useState, useTransition } from "react";
import type { EventTaskSlot, VolunteerTaskCandidate } from "@/lib/tasks/types";
import { upsertEventTaskAssignment, removeEventTaskAssignment } from "@/lib/tasks/actions";
import { TaskVolunteerBadge } from "./task-volunteer-badge";

interface TaskSlotRowProps {
  slot: EventTaskSlot;
  eventId: string;
  deptId: string;
  candidates: VolunteerTaskCandidate[];
  canAssign: boolean;
}

export function TaskSlotRow({
  slot,
  eventId,
  deptId,
  candidates,
  canAssign,
}: TaskSlotRowProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAssign(volunteerId: string) {
    setError(null);
    startTransition(async () => {
      const result = await upsertEventTaskAssignment(
        eventId,
        deptId,
        slot.task_id,
        volunteerId,
      );
      if (result.error) setError(result.error);
    });
  }

  function handleRemove() {
    if (!slot.assignment_id) return;
    setError(null);
    startTransition(async () => {
      const result = await removeEventTaskAssignment(
        slot.assignment_id!,
        eventId,
        deptId,
      );
      if (result.error) setError(result.error);
    });
  }

  function badgeLabel(candidate: VolunteerTaskCandidate): string {
    if (candidate.badge === "skill_match") return " — Skill match";
    if (candidate.badge === "skill_gap") return " — Skill gap";
    if (candidate.badge === "availability_conflict") return " — Unavailable";
    return "";
  }

  return (
    <li className="flex flex-col gap-100 rounded-200 border border-neutral-200 bg-neutral-0 p-300">
      <div className="flex flex-col gap-100 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-50">
          <span className="text-body font-semibold text-neutral-950">
            {slot.task_name}
          </span>
          {slot.required_skill_name && (
            <span className="text-body-sm text-neutral-500">
              requires: {slot.required_skill_name}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-200">
          {slot.volunteer_id ? (
            <>
              <span className="text-body-sm font-medium text-neutral-800">
                {slot.volunteer_display_name}
              </span>
              <TaskVolunteerBadge badge={slot.badge} />
              {canAssign && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isPending}
                  className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950 disabled:opacity-50"
                >
                  {isPending ? "Saving…" : "Remove"}
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-body-sm text-neutral-400">Unassigned</span>
              {canAssign && candidates.length > 0 && (
                <select
                  defaultValue=""
                  disabled={isPending}
                  onChange={(e) => {
                    if (e.target.value) handleAssign(e.target.value);
                  }}
                  className="rounded-200 border border-neutral-300 bg-neutral-0 px-200 py-100 text-body-sm text-neutral-950 focus:border-brand-calm-600 focus:outline-none disabled:opacity-50"
                >
                  <option value="" disabled>
                    Assign volunteer…
                  </option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.display_name}{badgeLabel(c)}
                    </option>
                  ))}
                </select>
              )}
              {canAssign && candidates.length === 0 && (
                <span className="text-body-sm text-neutral-400">
                  No eligible volunteers
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {error && <p className="text-body-sm text-semantic-error">{error}</p>}
    </li>
  );
}
