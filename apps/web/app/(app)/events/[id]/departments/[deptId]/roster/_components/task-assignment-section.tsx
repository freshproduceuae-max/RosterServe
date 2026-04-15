"use client";

import type { EventTaskSlot, VolunteerTaskCandidate } from "@/lib/tasks/types";
import { TaskSlotRow } from "./task-slot-row";

interface TaskAssignmentSectionProps {
  eventId: string;
  deptId: string;
  slots: EventTaskSlot[];
  candidatesByTask: Record<string, VolunteerTaskCandidate[]>;
  canAssign: boolean;
}

export function TaskAssignmentSection({
  eventId,
  deptId,
  slots,
  candidatesByTask,
  canAssign,
}: TaskAssignmentSectionProps) {
  const unassignedCount = slots.filter((s) => s.badge === "unassigned").length;

  return (
    <section className="flex flex-col gap-300">
      <h2 className="font-display text-h2 text-neutral-950">Task Assignments</h2>

      {slots.length === 0 ? (
        <p className="text-body-sm text-neutral-500">
          No tasks configured for this department.
        </p>
      ) : (
        <>
          {unassignedCount > 0 && (
            <div className="rounded-200 border border-semantic-warning bg-semantic-warning/10 p-300">
              <p className="text-body-sm font-semibold text-semantic-warning">
                {unassignedCount === 1
                  ? "1 task not yet assigned"
                  : `${unassignedCount} tasks not yet assigned`}
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-200">
            {slots.map((slot) => (
              <TaskSlotRow
                key={slot.task_id}
                slot={slot}
                eventId={eventId}
                deptId={deptId}
                candidates={candidatesByTask[slot.task_id] ?? []}
                canAssign={canAssign}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
