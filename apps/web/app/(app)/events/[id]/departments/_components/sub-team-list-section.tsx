"use client";

import Link from "next/link";
import { useState } from "react";
import type { Team } from "@/lib/departments/types";
import { softDeleteTeam } from "@/lib/departments/actions";
import { SubTeamEmptyState } from "./sub-team-empty-state";
import { DeleteConfirmModal } from "./delete-confirm-modal";

interface TeamListSectionProps {
  eventId: string;
  departmentId: string;
  subTeams: Team[];
  ownerNames: Record<string, string>;
  canManage: boolean; // super_admin or owning dept_head
}

export function TeamListSection({
  eventId,
  departmentId,
  subTeams,
  ownerNames,
  canManage,
}: TeamListSectionProps) {
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  return (
    <section className="flex flex-col gap-300">
      <div className="flex items-center justify-between">
        <h2 className="text-h2 font-semibold text-neutral-950">Sub-teams</h2>
        {canManage && (
          <Link
            href={`/events/${eventId}/departments/${departmentId}/sub-teams/new`}
            className="rounded-200 bg-brand-calm-600 px-400 py-200 text-body font-semibold text-neutral-0 transition-colors duration-fast hover:bg-brand-calm-600/90"
          >
            Add sub-team
          </Link>
        )}
      </div>

      {subTeams.length === 0 ? (
        <SubTeamEmptyState
          eventId={eventId}
          departmentId={departmentId}
          canCreate={canManage}
        />
      ) : (
        <ul className="flex flex-col gap-200">
          {subTeams.map((st) => (
            <li
              key={st.id}
              className="flex items-center justify-between rounded-200 border border-neutral-300 bg-neutral-0 p-400"
            >
              <div className="flex flex-col gap-100">
                <span className="text-body font-semibold text-neutral-950">{st.name}</span>
                <span className="text-body-sm text-neutral-600">
                  {ownerNames[st.owner_id ?? ""] ?? "Unassigned"}
                </span>
              </div>
              {canManage && (
                <div className="flex gap-200">
                  <Link
                    href={`/events/${eventId}/departments/${departmentId}/sub-teams/${st.id}/edit`}
                    className="rounded-200 border border-neutral-300 bg-neutral-0 px-300 py-100 text-body-sm text-neutral-600 transition-colors duration-fast hover:bg-neutral-100 hover:text-neutral-950"
                  >
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(st)}
                    className="rounded-200 border border-semantic-error/30 bg-neutral-0 px-300 py-100 text-body-sm text-semantic-error transition-colors duration-fast hover:bg-semantic-error/5"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          entityName={deleteTarget.name}
          consequenceText="This sub-team will be removed. This action cannot be undone."
          action={softDeleteTeam}
          hiddenFields={{ id: deleteTarget.id }}
        />
      )}
    </section>
  );
}
