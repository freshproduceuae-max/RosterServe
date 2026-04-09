"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignSupporter, removeSupporter } from "@/lib/admin/actions";
import type { SupporterAssignment, LeaderOption } from "@/lib/admin/queries";

const ROLE_LABELS: Record<string, string> = {
  dept_head: "Dept Head",
  all_depts_leader: "All Depts Leader",
  team_head: "Team Head",
};

interface SupporterAssignmentsSectionProps {
  supporters: SupporterAssignment[];
  leaders: LeaderOption[];
}

export function SupporterAssignmentsSection({
  supporters,
  leaders,
}: SupporterAssignmentsSectionProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function handleAssign(supporterId: string, leaderId: string) {
    if (!leaderId) return;
    setActionError(null);
    setPendingId(supporterId);
    startTransition(async () => {
      const result = await assignSupporter(supporterId, leaderId);
      setPendingId(null);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleRemove(supporterId: string) {
    setActionError(null);
    setPendingId(supporterId);
    startTransition(async () => {
      const result = await removeSupporter(supporterId);
      setPendingId(null);
      if (result.error) {
        setActionError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <section className="flex flex-col gap-200">
      <h2 className="font-display text-h2 text-neutral-950">
        Supporter assignments
      </h2>
      <p className="text-body-sm text-neutral-600">
        Assign each supporter to a leader. The supporter will mirror that
        leader&apos;s operational permissions.
      </p>
      {actionError && (
        <p className="text-body-sm text-semantic-error">{actionError}</p>
      )}
      {supporters.length === 0 ? (
        <p className="text-body-sm text-neutral-500">
          No supporter profiles found.
        </p>
      ) : (
        <div className="flex flex-col gap-150">
          {supporters.map((supporter) => (
            <div
              key={supporter.supporterId}
              className="flex flex-col gap-200 rounded-200 border border-neutral-200 bg-neutral-0 px-300 py-200 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-050">
                <p className="text-body-sm font-medium text-neutral-950">
                  {supporter.supporterName}
                </p>
                {supporter.assignedLeaderName ? (
                  <p className="text-body-sm text-neutral-500">
                    Assigned to{" "}
                    <span className="font-medium text-neutral-700">
                      {supporter.assignedLeaderName}
                    </span>
                    {supporter.assignedLeaderRole && (
                      <span className="ml-100 text-neutral-400">
                        ({ROLE_LABELS[supporter.assignedLeaderRole] ?? supporter.assignedLeaderRole})
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-body-sm text-neutral-400">Unassigned</p>
                )}
              </div>

              <div className="flex items-center gap-200">
                <select
                  defaultValue=""
                  disabled={pendingId === supporter.supporterId}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAssign(supporter.supporterId, e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="rounded-200 border border-neutral-300 bg-neutral-0 px-250 py-150 text-body-sm text-neutral-950 focus:border-neutral-950 focus:outline-none disabled:opacity-50"
                >
                  <option value="" disabled>
                    {supporter.assignedLeaderName ? "Change leader" : "Assign leader"}
                  </option>
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name} ({ROLE_LABELS[leader.role] ?? leader.role})
                    </option>
                  ))}
                </select>

                {supporter.assignedLeaderId && (
                  <button
                    onClick={() => handleRemove(supporter.supporterId)}
                    disabled={pendingId === supporter.supporterId}
                    className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-150 text-body-sm font-semibold text-neutral-950 transition-opacity duration-fast hover:opacity-80 disabled:opacity-50"
                  >
                    {pendingId === supporter.supporterId ? "Removing…" : "Remove"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
